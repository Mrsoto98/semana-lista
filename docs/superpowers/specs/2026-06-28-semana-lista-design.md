# Semana Lista — Spec de Diseño
**Fecha:** 2026-06-28
**Estado:** Aprobado

## Resumen

Aplicación web mobile-first para planificación de menús semanales. Genera recetas con IA (Claude), construye la lista de la compra agregada y la valora con precios reales de Mercadona.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Auth + DB | Supabase (email/password + Google OAuth) |
| Backend / secretos | Supabase Edge Functions (Deno) |
| IA — recetas | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| Precios | API pública no oficial de Mercadona (`tienda.mercadona.es/api/`) |
| Despliegue | Vercel (frontend) + Supabase (funciones y DB) |

---

## Arquitectura global

```
Browser (React + Vite + Tailwind)
    │
    ├── Supabase JS Client — auth + DB directo (anon key pública)
    │
    └── fetch() → Supabase Edge Functions (Deno)
                      ├── generar-recetas       → Anthropic API
                      └── precios-mercadona     → tienda.mercadona.es
                                ↕
                          Supabase DB (Postgres)
```

**Regla de oro de seguridad:** `ANTHROPIC_API_KEY` y toda llamada a Mercadona viven exclusivamente en Edge Functions. El frontend nunca llama a ninguna API externa directamente. Ninguna clave secreta toca el código de Vite ni variables `VITE_*`.

---

## Variables de entorno

**Secretas (solo Supabase Edge Functions):**
```
ANTHROPIC_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**Públicas del frontend (Vite):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Base de datos — Tablas Supabase

### Tablas con RLS (por usuario)

```sql
usuarios (
  id uuid PRIMARY KEY references auth.users,
  email text,
  created_at timestamptz DEFAULT now()
)

perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  personas int,
  presupuesto numeric,          -- € semanales
  codigo_postal text,
  supermercado text DEFAULT 'mercadona',  -- extensible
  objetivo text,                -- 'sin_restriccion'|'bajar_peso'|'mas_proteina'|'vegetariano'|'vegano'|'sin_gluten'
  ingredientes_si text[],       -- tags de ingredientes frecuentes
  ingredientes_no text[],       -- ingredientes prohibidos
  nevera text[]                 -- lo que ya tiene en casa
)

semanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  fecha_inicio date,
  recetas_elegidas jsonb,       -- { lunes_comida: receta, ... }
  lista_compra jsonb,           -- ingredientes agregados + precios
  total_precio numeric
)

historial_recetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  nombre_receta text,
  fecha_uso date
)
```

### Tablas compartidas (sin RLS de usuario)

```sql
catalogo_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termino text UNIQUE,          -- término de búsqueda normalizado
  payload jsonb,                -- respuesta de Mercadona
  actualizado_en timestamptz    -- TTL: 24h
)

mapa_ingredientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingrediente_normalizado text UNIQUE,
  mercadona_product_id text,
  confirmado boolean DEFAULT false   -- true si el usuario lo validó manualmente
)
```

---

## Edge Functions

### `generar-recetas`

**Input:**
```json
{
  "dia": "lunes",
  "franja": "comida",
  "perfil": { "personas": 2, "objetivo": "vegetariano", "ingredientes_no": ["marisco"], "ingredientes_si": ["legumbres"], "nevera": ["tomates"] },
  "recetas_ya_usadas": ["Lentejas al curry", "Gazpacho"]
}
```

**Comportamiento:**
- Construye prompt con perfil completo + lista de recetas ya usadas (para no repetir)
- Llama a `claude-haiku-4-5-20251001` con `output_config.format.type = "json_schema"`
- El JSON Schema fuerza estructura válida — no requiere try/catch de parseo
- Devuelve exactamente 3 opciones de receta para esa franja

**Schema de respuesta de Claude:**
```json
{
  "opciones": [{
    "nombre": "string",
    "tiempo_prep": "number (minutos)",
    "dificultad": "fácil|media|difícil",
    "descripcion_corta": "string",
    "calorias_aprox": "number",
    "ingredientes": [{ "nombre": "string", "cantidad": "number", "unidad": "g|kg|ml|l|ud|cucharada|pizca" }],
    "pasos": ["string"],
    "tags": ["string"]
  }]
}
```

**Output al frontend:**
```json
{ "dia": "lunes", "franja": "comida", "opciones": [...] }
```

**Error handling:** Si Claude falla, devuelve `{ error: true, dia, franja }` — la celda muestra "Reintentar" sin afectar a otras celdas.

---

### `precios-mercadona`

**Input:**
```json
{
  "ingredientes": [{ "nombre": "lentejas", "cantidad": 400, "unidad": "g" }]
}
```

**Comportamiento:**
1. Normaliza cada nombre: minúsculas, sin tildes, singular, quita marcas comerciales
2. Consulta `mapa_ingredientes` para equivalencias ya conocidas
3. Si no hay mapa, busca en `catalogo_cache` (TTL 24h)
4. Si no hay caché o expiró, llama a Mercadona API y cachea resultado
5. Selecciona el producto más barato por unidad como match por defecto
6. Calcula: `envases_a_comprar = ceil(cantidad_necesaria / tamaño_envase)`
7. Calcula: `coste_real = envases_a_comprar × precio_envase`
8. Si no hay match fiable → marca como `sin_precio: true` (nunca inventa precio)

**Endpoints Mercadona utilizados:**
- Fijar almacén: `PUT https://tienda.mercadona.es/api/postal-codes/actions/change-pc/`
- Búsqueda en categoría: `GET https://tienda.mercadona.es/api/categories/{id}/`
- Producto: `GET https://tienda.mercadona.es/api/products/{id}/`

**Interfaz estable interna:** `buscarProducto(termino) → { nombre, precio, formato, precio_por_unidad }`. Si Mercadona cambia su API, solo se toca esta función.

**Output:**
```json
{
  "resultados": [{
    "ingrediente": "lentejas",
    "cantidad_necesaria": 400,
    "unidad": "g",
    "producto_mercadona": "Lenteja pardina Hacendado",
    "precio_envase": 1.45,
    "tamaño_envase": 1000,
    "unidad_envase": "g",
    "envases_a_comprar": 1,
    "coste_real": 1.45,
    "sobrante": 600,
    "sin_precio": false
  }]
}
```

---

## Flujo de pantallas

```
/ (landing + login/registro)
    └── /onboarding          ← solo primera vez (sin perfil en DB)
         └── /menu           ← planificador semanal
              └── /lista     ← lista de compra + precios
                   └── /exportar  ← PDF, clipboard, link público
```

**Estado persistido en `localStorage`:** recetas generadas, selecciones actuales, lista de compra. Si el usuario cierra la pestaña, recupera el estado al volver.

---

## Pantalla `/onboarding`

Formulario en pasos (wizard):
1. Nº de personas en el hogar
2. Presupuesto semanal (€)
3. Código postal (para precios Mercadona)
4. Objetivo nutricional (radio buttons)
5. Ingredientes frecuentes (tag input)
6. Ingredientes prohibidos (tag input)
7. ¿Qué tienes en la nevera esta semana? (tag input, opcional)

Guarda en tabla `perfiles` al finalizar.

---

## Pantalla `/menu`

**Cuadrícula 7 filas (Lun–Dom) × 2 columnas (Comida | Cena)**

Al pulsar "Generar mi semana":
1. Lanza 14 fetch en paralelo a `generar-recetas`
2. Cada celda: skeleton animado (pulse) con mensaje "Cocinando..."
3. Conforme llegan respuestas: cards aparecen con animación `fade-in + slide-up`
4. Primera opción preseleccionada por defecto (highlight verde)
5. Si una llamada falla: celda muestra botón "Reintentar" (aislada del resto)
6. Barra de progreso: "X/14 comidas elegidas"
7. Botón "Sorpréndeme": autoselecciona una opción aleatoria en celdas sin elegir

**Card de receta:**
- Nombre + emoji de categoría
- Tiempo de preparación
- Badge de dificultad (`fácil`/`media`/`difícil`)
- Calorías aprox.
- Swipeable entre las 3 opciones (en móvil)

**En móvil:** cuadrícula colapsa a cards verticales; navegación día a día con scroll lateral entre comida/cena.

---

## Pantalla `/lista`

1. Agrega ingredientes de las 14 recetas seleccionadas
2. Normaliza y deduplica (suma cantidades del mismo ingrediente)
3. Descuenta ingredientes del campo `nevera` del perfil
4. Llama a `precios-mercadona` con la lista consolidada
5. Skeleton mientras cargan precios

**Vista de la lista:**
- Agrupada por categoría: Verduras y frutas · Carnes y pescados · Lácteos y huevos · Legumbres y cereales · Enlatados y conservas · Otros
- Checkboxes para tachar en el súper
- Por ítem: nombre ingrediente, producto Mercadona encontrado, nº envases, precio
- Ítems `sin_precio` marcados con icono de advertencia

**Totales:**
- Total estimado de la compra
- Si supera presupuesto → alerta roja + las 3 recetas más caras destacadas
- "Precio medio por persona y día: X €"

---

## Pantalla `/exportar`

- **PDF:** `jsPDF` + `html2canvas` — menú semanal + lista con precios
- **Clipboard:** `navigator.clipboard.writeText()` — lista en texto plano (para WhatsApp)
- **Link público:** ruta `/menu/[semana_id]` — datos en Supabase con acceso público de solo lectura
- **Historial:** guarda la semana en `semanas` + los nombres de recetas en `historial_recetas` (para prompts futuros)

---

## Diseño visual

| Elemento | Valor |
|---|---|
| Fondo | `#FAFAF8` (blanco cálido) |
| Verde selección | `#4CAF50` |
| Naranja acento | `#FF7043` |
| Cards | Sombra suave, border-radius 12px |
| Tipografía | Inter (variable) |
| Emojis | Nativos del sistema |
| Dark mode | `class="dark"` Tailwind, toggle en header |
| Animaciones | Skeletons pulse, cards `fade-in + slide-up` |
| Mobile-first | Breakpoints: base (móvil) → md (tablet) → lg (escritorio) |

---

## Generación de recetas — Estrategia de prompts

El prompt a Claude incluye:
- Perfil completo del hogar (personas, objetivo, restricciones)
- Lista de `recetas_ya_usadas` (historial de las últimas 4 semanas)
- Ingredientes que tiene en nevera (para usarlos preferentemente)
- Instrucción: generar exactamente 3 recetas distintas adaptadas al perfil
- El JSON Schema fuerza la estructura — no hace falta decirle "responde solo JSON"

---

## Notas de implementación

- **Nunca hardcodear recetas:** siempre vía Claude con structured outputs.
- **Caché Mercadona agresiva:** TTL 24h en `catalogo_cache`. Tratar la API como frágil.
- **Ingrediente sin match:** marcar `sin_precio: true`, nunca inventar.
- **`localStorage` como capa de resiliencia:** guardar progreso del flujo en cada paso.
- **Prioridad móvil:** todas las decisiones de layout favorecen la pantalla pequeña.
- **Columna `supermercado` en `perfiles`:** reservada para futuras ampliaciones (solo Mercadona en MVP).
