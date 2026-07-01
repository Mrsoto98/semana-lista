# DreamLog — Guía de arranque (stack 100% gratis)

## Servicios necesarios (todos gratis)

| Servicio | Para qué | Límite gratis |
|---|---|---|
| Supabase | Base de datos PostgreSQL + pgvector | 500 MB, usuarios ilimitados |
| Railway | Hosting del backend Node.js | ~$5 crédito/mes (suficiente para un proyecto pequeño) |
| Vercel | Hosting del frontend React | Ilimitado |
| Groq | IA para análisis de sueños (Llama 3.1) | Gratis generosamente |
| HuggingFace | Embeddings para coincidencias | ~30k peticiones/mes gratis |
| Resend | Emails de verificación | 100 emails/día gratis |

---

## Paso 1 — Crear las cuentas

### Supabase (base de datos)
1. Ve a https://supabase.com → "Start your project"
2. Regístrate con GitHub o email
3. Crea un nuevo proyecto:
   - Name: `dreamlog`
   - Database password: genera una fuerte y **guárdala**
   - Region: `West EU (Ireland)` o la más cercana a ti
4. Espera ~2 minutos a que se cree
5. Ve a **Settings → API** y copia:
   - `Project URL`
   - `anon public key`
   - `service_role key` ← secreta, nunca la pongas en el frontend
6. Ve a **Settings → Database → Connection String** (modo `URI`)
   - Reemplaza `[YOUR-PASSWORD]` con la contraseña que creaste

### Groq (IA gratis)
1. Ve a https://console.groq.com → regístrate
2. Ve a **API Keys → Create API Key** → copia la clave (`gsk_...`)

### HuggingFace (embeddings gratis)
1. Ve a https://huggingface.co → regístrate
2. Ve a tu perfil → **Settings → Access Tokens → New token**
   - Name: `dreamlog`, Role: `Read`
   - Copia la clave (`hf_...`)

### Resend (emails)
1. Ve a https://resend.com → regístrate
2. Ve a **API Keys → Create API Key** → copia la clave (`re_...`)
3. (Opcional) Añade tu dominio en Domains para usar tu propio email.
   Sin dominio propio, puedes usar `onboarding@resend.dev` para pruebas.

### Vercel (frontend)
1. Ve a https://vercel.com → regístrate con GitHub

### Railway (backend)
1. Ve a https://railway.app → regístrate con GitHub

---

## Paso 2 — Crear la base de datos en Supabase

1. En tu proyecto Supabase ve a **SQL Editor** (icono de base de datos en la barra lateral)
2. Crea una nueva query y pega el contenido del archivo `backend/src/db/migrate.ts`
   (solo la parte del SQL entre las comillas de la variable `MIGRATION`)
3. Haz clic en **Run** → deberías ver "Success. No rows returned"

Si ves un error de `pgvector not installed`:
- Ve a **Database → Extensions** → busca `vector` → actívala → vuelve a ejecutar el SQL

---

## Paso 3 — Configurar el backend localmente

```bash
cd backend
npm install
cp .env.example .env
```

Abre `.env` y rellena todas las variables con tus claves.

Para generar los JWT secrets, ejecuta esto en la terminal:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Ejecuta ese comando dos veces: una para `JWT_ACCESS_SECRET` y otra para `JWT_REFRESH_SECRET`.

Arrancar en local:
```bash
npm run dev
# API disponible en http://localhost:3001
```

---

## Paso 4 — Configurar el frontend localmente

```bash
cd frontend
npm install
npm run dev
# App disponible en http://localhost:5173
```

---

## Paso 5 — Desplegar en producción

### Backend → Railway
1. Ve a https://railway.app → New Project → Deploy from GitHub repo
2. Selecciona tu repo → Railway detectará el `package.json`
3. En **Variables** añade todas las variables de tu `.env` (con la URL de producción)
4. Railway te dará una URL tipo `https://dreamlog-backend.up.railway.app`
5. Copia esa URL

### Frontend → Vercel
1. Ve a https://vercel.com → New Project → importa tu repo de GitHub
2. En **Root Directory** pon `dreamlog/frontend`
3. En **Environment Variables** añade:
   ```
   VITE_API_URL=https://dreamlog-backend.up.railway.app
   ```
4. Deploy → Vercel te dará una URL tipo `https://dreamlog.vercel.app`

### Actualizar FRONTEND_URL en Railway
- Ve a tu proyecto en Railway → Variables → `FRONTEND_URL=https://dreamlog.vercel.app`

---

## Estructura de archivos

```
dreamlog/
├── backend/src/
│   ├── routes/     auth · dreams · feed · friends · analysis · coincidences · stats · user
│   ├── services/   embedding (HuggingFace) · analysis (Groq/Llama)
│   ├── jobs/       embedding.queue (síncrono, sin Redis)
│   ├── db/         client · migrate
│   ├── utils/      jwt · email
│   └── middleware/ auth · validate
└── frontend/src/
    ├── pages/      Login · Register · Diary · FriendsFeed · PublicFeed · Coincidences · Stats · Friends
    ├── components/ ui/ · layout/ · dreams/
    └── lib/        api · store · queries · utils
```

## Preguntas frecuentes

**¿Cuánto cuesta en la práctica?**
Con un uso moderado (< 1000 usuarios), $0. Railway tiene un crédito de $5/mes que
cubre perfectamente un backend pequeño. Si creces mucho, upgradeaas solo lo que necesites.

**¿Puedo usar Supabase Auth en vez de JWT propio?**
Sí, y es más fácil. Está preparado para migrar: la tabla `profiles` ya referencia `auth.users`.
Para una primera versión el JWT propio es más didáctico.

**¿Qué pasa si HuggingFace va lento?**
El modelo `all-MiniLM-L6-v2` a veces tarda unos segundos la primera vez (cold start).
Los embeddings se calculan en background (`setImmediate`) así que el usuario no espera.
