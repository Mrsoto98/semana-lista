// supabase/functions/generar-recetas/index.ts
import INGREDIENTES_JSON from './ingredientes.json' with { type: 'json' }
import INGREDIENTES_COCINAS from './ingredientes-cocinas.json' with { type: 'json' }
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://semana-lista.vercel.app'

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = origin === ALLOWED_ORIGIN || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost') ? origin : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// Sanitiza campos de usuario antes de incluirlos en el prompt
// para prevenir prompt injection
function sanitizarParaPrompt(s: string, maxLen = 200): string {
  return s
    .slice(0, maxLen)
    .replace(/[<>{}`]/g, '')   // caracteres de template/markup
    .replace(/[\n\r]/g, ' ')   // saltos de línea
    .replace(/\binstrucci[oó]n\b|\bsystem\b|\brole\b|\bignora\b|\bolvida\b|\bignore\b|\bforget\b/gi, '') // palabras de jailbreak
    .trim()
}

// Verifica el JWT localmente (sin red): decodifica el payload y comprueba
// que tiene sub (user ID) y que no ha expirado.
function verificarJWT(req: Request): { userId: string | null; error: string | null } {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return { userId: null, error: 'Token requerido' }
    const token = authHeader.slice(7)
    const parts = token.split('.')
    if (parts.length !== 3) return { userId: null, error: 'Token malformado' }
    // Decodificar payload (base64url → JSON)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload?.sub) return { userId: null, error: 'Token sin usuario' }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { userId: null, error: 'Token expirado' }
    return { userId: payload.sub as string, error: null }
  } catch {
    return { userId: null, error: 'Token inválido' }
  }
}

// Mapea el valor de "cocina" que elige el usuario en la UI al código de
// etiqueta usado en ingredientes-cocinas.json. Los valores sin entrada aquí
// (combinado, aleatorio, variada e internacional...) no filtran la lista.
const CODIGO_COCINA: Record<string, string> = {
  'española y mediterránea': 'E',
  'italiana': 'I',
  'asiática': 'AS',
  'americana': 'AM',
  'mexicana': 'M',
  'tradicional española': 'T',
  'saludable y ligera': 'S',
}

function ingredientesParaPrompt(cocina?: string): string {
  const codigo = cocina ? CODIGO_COCINA[cocina] : undefined
  const tags = INGREDIENTES_COCINAS as Record<string, string[]>

  const lineas: string[] = ['PRODUCTOS DISPONIBLES EN MERCADONA (usa SOLO estos nombres exactos para los ingredientes):']
  for (const [cat, nombres] of Object.entries(INGREDIENTES_JSON as Record<string, string[]>)) {
    const filtrados = codigo
      ? (nombres as string[]).filter(n => {
          const t = tags[n]
          return !t || t.includes('ALL') || t.includes(codigo)
        })
      : (nombres as string[])
    if (filtrados.length) lineas.push(`${cat}: ${filtrados.join(', ')}`)
  }
  return lineas.join('\n')
}

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
const FRANJAS = ['comida','cena']

function idiomaInstruccion(lang: string): string {
  if (lang === 'ca') return 'IMPORTANT: El nom de la recepta, la descripció_curta i els tags han d\'estar completament en català correcte. Exemples: "pollastre" (no "pollo"), "porc" (no "cerdo"), "vedella" (no "ternera"), "bacallà" (no "bacalao"), "gambes" (no "gambas"), "ou" (no "huevo"), "patata" (no "patatas" però sí en plural "patates"). Els noms dels ingredients han de ser els del catàleg Mercadona (en castellà), però el nom i descripció de la recepta han d\'estar en català.'
  return ''
}

function restriccionDieta(objetivo: string): string {
  const obj = objetivo.toLowerCase()
  if (obj.includes('vegano')) {
    return 'DIETA VEGANA — PROHIBICIÓN ABSOLUTA: NINGUNA receta puede contener carne, pescado, marisco, huevos, lácteos (leche, queso, mantequilla, yogur) ni ningún producto de origen animal. Proteínas SOLO de: legumbres (lentejas, garbanzos, alubias, tofu, tempeh), frutos secos, semillas, cereales. Si incluyes cualquier ingrediente animal, el menú es incorrecto.'
  }
  if (obj.includes('vegetar')) {
    return 'DIETA VEGETARIANA — PROHIBICIÓN ABSOLUTA: NINGUNA receta puede contener carne (pollo, cerdo, ternera, cordero, pavo...), pescado (bacalao, merluza, salmón, atún, dorada...) ni marisco (gambas, mejillones, almejas, calamares...). Proteínas permitidas SOLO: huevos, queso, legumbres (lentejas, garbanzos, alubias), tofu, frutos secos. Revisa cada receta antes de responder — si cualquier receta contiene carne, pescado o marisco, el menú es incorrecto.'
  }
  return ''
}

function dificultadInstruccion(d?: string): string {
  if (d === 'fácil')   return 'Todas las recetas deben ser fáciles (≤30 min, técnicas simples).'
  if (d === 'media')   return 'Recetas de dificultad media (30-60 min, técnicas habituales).'
  if (d === 'difícil') return 'Recetas elaboradas y de alta dificultad (>45 min, técnicas avanzadas).'
  return 'Mezcla variada de dificultades: fácil, media y difícil.'
}

const DESCRIPCION_COCINA: Record<string, string> = {
  'española y mediterránea': 'cocina española y mediterránea. Platos posibles: paella de marisco, arroz al horno, fideuà, gazpacho, salmorejo, pisto manchego, tortilla española, merluza a la vasca, bacalao al pil-pil, dorada al horno con patatas, calamares en su tinta, albóndigas en salsa, pollo al ajillo, lentejas con chorizo, garbanzos con espinacas, pimientos rellenos, berenjenas con miel, ensalada catalana.',
  'italiana': 'cocina italiana AUTÉNTICA. IMPORTANTE: el menú semanal debe incluir máximo 2 recetas de pasta. Usa también: risotto (ai funghi, alla milanese, al limone), gnocchi al gorgonzola, pizza casera, ossobuco, saltimbocca alla romana, pollo alla cacciatora, parmigiana di melanzane, vitello tonnato, fritto misto, zuppa di pesce, ribollita, minestrone, arancini, frittata di verdure, branzino al forno, scaloppine al limone. Varía la forma: platos de pasta, arroces, carnes, pescados, verduras.',
  'asiática': 'cocina asiática variada. IMPORTANTE: alterna entre cocinas japonesa, tailandesa, china, coreana e india. No repitas la misma técnica. Platos: ramen de pollo, pad thai, curry thai verde, curry japonés katsu, pollo teriyaki, gyozas con caldo, arroz frito con huevo y verduras, yakitori, bibimbap coreano, bulgogi, dumplings al vapor, laksa de coco, pho vietnamita, pollo kung pao, mapo tofu, salmón en miso, udon con gambas.',
  'americana': 'cocina americana y tex-mex. IMPORTANTE: máximo 1 hamburguesa en todo el menú. Platos: pulled pork con coleslaw, costillas BBQ al horno, mac and cheese gratinado, chili con carne, pollo Nashville hot, alitas de búfalo, burritos de ternera, fajitas de pollo, tacos de pescado, nachos con guacamole, sopa de almejas (clam chowder), lobster roll de gambas, cheesesteak de ternera, hot dog estilo Chicago, quesadillas de pollo, enchiladas verdes.',
  'mexicana': 'cocina mexicana auténtica. IMPORTANTE: máximo 2 recetas de tacos en todo el menú, alterna con otras preparaciones. Platos: enchiladas verdes, enchiladas rojas, chiles rellenos en nogada, pozole rojo, tostadas de tinga, flautas de pollo, sopa de lima yucateca, tamales de rajas, cochinita pibil, birria de ternera, quesadillas de huitlacoche, molletes, huevos rancheros, chile con carne, carnitas estofadas, camarones a la diabla, aguachile.',
  'tradicional española': 'cocina tradicional española. IMPORTANTE: varía entre guisos, fritos, asados y platos en salsa. Platos: cocido madrileño, fabada asturiana, pote gallego, callos a la madrileña, menestra de verduras, croquetas caseras de jamón, albóndigas en salsa española, pollo asado con patatas, cordero al chilindrón, rabo de toro, huevos rotos con jamón, migas extremeñas, pisto con huevo, berberecho con tomate, bacalao a la vizcaína, escudella, gazpacho andaluz, olla podrida.',
  'saludable y ligera': 'cocina saludable y ligera. IMPORTANTE: varía entre ensaladas, proteína magra y platos de verduras. No repitas el mismo tipo de plato. Opciones: bowl de quinoa con salmón, ensalada de lentejas y espinacas, pechuga al horno con verduras asadas, gambas al ajillo con calabacín, tortilla de claras con espárragos, sopa miso con tofu, pollo tikka sin nata, lubina al vapor con brócoli, ensalada de garbanzos y aguacate, revuelto de champiñones y espárragos, tataki de atún, gazpacho, carpaccio de ternera con rúcula.',
}

// Instrucción extra de variedad por cocina (previene formatos repetitivos)
const VARIEDAD_COCINA: Record<string, string> = {
  'italiana': 'VARIEDAD OBLIGATORIA: planifica el menú completo antes de asignarlo. De las recetas italianas, máximo 2 pueden ser de pasta (spaghetti, penne, tagliatelle, etc.). El resto deben ser risotto, gnocchi, pizza, secondi di carne, secondi di pesce o contorni importantes.',
  'mexicana': 'VARIEDAD OBLIGATORIA: planifica el menú completo antes de asignarlo. De las recetas mexicanas, máximo 2 pueden ser tacos de cualquier tipo. El resto deben ser enchiladas, pozole, chiles rellenos, tostadas, tamales, sopa, etc.',
  'americana': 'VARIEDAD OBLIGATORIA: planifica el menú completo antes de asignarlo. Máximo 1 hamburguesa en toda la semana. Rota entre pulled pork, costillas, mac&cheese, chili, alitas, burritos, fajitas, chowder, etc.',
  'asiática': 'VARIEDAD OBLIGATORIA: planifica el menú completo antes de asignarlo. Alterna obligatoriamente entre al menos 3 cocinas asiáticas distintas (japonesa, thai, china, coreana, india, vietnamita). No repitas la misma cocina más de 2 veces.',
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo',
}

function promptSemana(perfil: Record<string, unknown>, recetasYaUsadas: string[], claves: string[], lang = 'es'): string {
  const { personas, objetivo, ingredientes_no, nevera, extra_instrucciones, dificultad_recetas, cocina } = perfil as {
    personas: number; objetivo: string; ingredientes_no: string[]; nevera: string[]; extra_instrucciones?: string; dificultad_recetas?: string; cocina?: string
  }

  const desc = cocina ? DESCRIPCION_COCINA[cocina] : undefined
  const variedadExtra = cocina ? VARIEDAD_COCINA[cocina] : undefined
  const ctx: string[] = [
    `Eres un chef español. Crea un menú para ${personas} persona${personas > 1 ? 's' : ''} (${claves.length} franja${claves.length > 1 ? 's' : ''} de comida en total), objetivo: ${objetivo}.`,
    `SOLO comidas y cenas principales. NO postres, NO desayunos, NO meriendas, NO bebidas.`,
    `CANTIDADES OBLIGATORIAS: las raciones deben ser para ${personas} persona${personas > 1 ? 's' : ''} como plato principal completo y saciante. Para ${personas} persona${personas > 1 ? 's' : ''}: mínimo ${personas * 150}-${personas * 200}g de proteína principal, ${personas * 150}-${personas * 250}g de carbohidrato si lo lleva, verduras y acompañamientos proporcionados. No escatimes — un plato principal no es una tapa.`,
    desc ? `ESTILO DE COCINA OBLIGATORIO: ${desc}. TODAS las recetas deben pertenecer claramente a este estilo. NO mezcles con otros estilos.` : '',
    variedadExtra ?? '',
    restriccionDieta(objetivo),
    restriccionDieta(objetivo) ? '' : `VARIEDAD DE PROTEÍNAS: NO pongas pollo en más de la mitad de las recetas. Rota entre: pollo, cerdo, ternera/vacuno, huevos, legumbres, pescado/marisco. Si un mismo día tiene comida y cena, usa proteínas distintas. ${claves.length} nombres de receta distintos en total.`,
    `ANTI-REPETICIÓN DE FORMATO: antes de asignar cada receta, revisa mentalmente el listado completo del menú. Ningún tipo de plato base (pasta, tacos, curry, hamburguesa, ensalada, wok...) puede aparecer más de 2 veces en toda la semana.`,
    `CONSISTENCIA NOMBRE-INGREDIENTES OBLIGATORIA: si el nombre de la receta menciona una proteína (ternera, pollo, cerdo, salmón, gambas, bacalao, cordero, atún...), ESA proteína DEBE ser el ingrediente principal. NUNCA escribas "de ternera" y uses cerdo. NUNCA escribas "de pollo" y uses otro animal. El nombre y los ingredientes deben describir exactamente el mismo plato.`,
    dificultadInstruccion(dificultad_recetas),
  ].filter(Boolean)
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.slice(0, 30).map((s: string) => sanitizarParaPrompt(s, 50)).join(', ')}.`)
  if (nevera?.length) ctx.push(`Ingredientes a usar: ${nevera.slice(0, 30).map((s: string) => sanitizarParaPrompt(s, 50)).join(', ')}.`)
  if (recetasYaUsadas?.length) ctx.push(`No repetir estas recetas: ${recetasYaUsadas.slice(0, 8).map((s: string) => sanitizarParaPrompt(s, 80)).join(', ')}.`)
  if (extra_instrucciones) ctx.push(sanitizarParaPrompt(extra_instrucciones, 200))
  const idiomaStr = idiomaInstruccion(lang)
  if (idiomaStr) ctx.push(idiomaStr)

  ctx.push(ingredientesParaPrompt(cocina))
  ctx.push(`Responde SOLO JSON válido sin texto extra. ${claves.length} clave${claves.length > 1 ? 's' : ''} (${claves.join(', ')}), cada una con UNA sola receta (no un array):
{"lunes_comida":{"nombre":"X","tiempo_prep":30,"dificultad":"fácil","descripcion_corta":"desc","calorias_aprox":400,"ingredientes":[{"nombre":"a","cantidad":200,"unidad":"g"}],"tags":["t"]}, "lunes_cena":{...}, ...}
CRÍTICO: "ingredientes" debe incluir TODOS los ingredientes necesarios. Mínimo 4 ingredientes por receta. Usa EXACTAMENTE los nombres del catálogo Mercadona de arriba.
Dificultad: fácil/media/difícil. Unidades: g,kg,ml,l,ud,cucharada,pizca.`)

  return ctx.join('\n')
}

function promptSlot(dia: string, franja: string, perfil: Record<string, unknown>, lang = 'es'): string {
  const { personas, objetivo, ingredientes_no, nevera, extra_instrucciones, dificultad_recetas, cocina } = perfil as {
    personas: number; objetivo: string; ingredientes_no: string[]; nevera: string[]; extra_instrucciones?: string; dificultad_recetas?: string; cocina?: string
  }
  const franjaLabel = franja === 'comida' ? 'mediodía' : 'noche'

  const desc = cocina ? DESCRIPCION_COCINA[cocina] : undefined
  const ctx: string[] = [
    `Eres un chef español. Crea 1 receta para ${franjaLabel} del ${DIA_LABEL[dia] ?? dia}. ${personas} persona${personas > 1 ? 's' : ''}, objetivo: ${objetivo}. SOLO platos principales, NO postres.`,
    `CANTIDADES OBLIGATORIAS: raciones para ${personas} persona${personas > 1 ? 's' : ''} como plato principal completo y saciante. Mínimo ${personas * 150}-${personas * 200}g de proteína principal, carbohidratos y acompañamientos proporcionales. No escatimes — un plato principal no es una tapa.`,
    desc ? `ESTILO DE COCINA OBLIGATORIO: ${desc}. La receta debe pertenecer claramente a este estilo.` : '',
    restriccionDieta(objetivo),
    `CONSISTENCIA NOMBRE-INGREDIENTES OBLIGATORIA: si el nombre menciona una proteína (ternera, pollo, cerdo, salmón, gambas...), ESA proteína DEBE ser el ingrediente principal. NUNCA escribas "de ternera" y uses cerdo, ni viceversa.`,
    dificultadInstruccion(dificultad_recetas),
  ].filter(Boolean)
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.slice(0, 30).map((s: string) => sanitizarParaPrompt(s, 50)).join(', ')}.`)
  if (nevera?.length) ctx.push(`En casa: ${nevera.slice(0, 30).map((s: string) => sanitizarParaPrompt(s, 50)).join(', ')}.`)
  if (extra_instrucciones) ctx.push(sanitizarParaPrompt(extra_instrucciones, 200))
  const idiomaStrSlot = idiomaInstruccion(lang)
  if (idiomaStrSlot) ctx.push(idiomaStrSlot)
  ctx.push(ingredientesParaPrompt(cocina))
  ctx.push(`JSON sin texto extra, UNA sola receta (no un array):
{"nombre":"A","tiempo_prep":30,"dificultad":"fácil","descripcion_corta":"desc","calorias_aprox":400,"ingredientes":[{"nombre":"x","cantidad":200,"unidad":"g"}],"tags":["t"]}
CRÍTICO: "ingredientes" debe incluir TODOS los ingredientes necesarios. Mínimo 4 ingredientes. Usa EXACTAMENTE los nombres del catálogo Mercadona de arriba.
Dificultad: "fácil","media" o "difícil". Unidades: g,kg,ml,l,ud,cucharada,pizca.`)

  return ctx.join('\n')
}

function promptOpcionExtra(dia: string, franja: string, perfil: Record<string, unknown>, recetaExistente: string, lang = 'es'): string {
  const { personas, objetivo, ingredientes_no, nevera, extra_instrucciones, dificultad_recetas, cocina } = perfil as {
    personas: number; objetivo: string; ingredientes_no: string[]; nevera: string[]; extra_instrucciones?: string; dificultad_recetas?: string; cocina?: string
  }
  const franjaLabel = franja === 'comida' ? 'mediodía' : 'noche'

  const desc = cocina ? DESCRIPCION_COCINA[cocina] : undefined
  const ctx: string[] = [
    `Eres un chef español. El usuario ya tiene la receta "${recetaExistente}" para ${franjaLabel} del ${DIA_LABEL[dia] ?? dia} y quiere una SEGUNDA opción alternativa distinta para elegir. ${personas} persona${personas > 1 ? 's' : ''}, objetivo: ${objetivo}. SOLO platos principales, NO postres.`,
    `La nueva receta debe ser claramente distinta de "${recetaExistente}" (proteína o técnica diferente).`,
    `CANTIDADES OBLIGATORIAS: raciones para ${personas} persona${personas > 1 ? 's' : ''} como plato principal completo y saciante. Mínimo ${personas * 150}-${personas * 200}g de proteína principal. No escatimes.`,
    desc ? `ESTILO DE COCINA OBLIGATORIO: ${desc}. La receta debe pertenecer claramente a este estilo.` : '',
    restriccionDieta(objetivo),
    `CONSISTENCIA NOMBRE-INGREDIENTES OBLIGATORIA: si el nombre menciona una proteína (ternera, pollo, cerdo, salmón, gambas...), ESA proteína DEBE ser el ingrediente principal. NUNCA escribas "de ternera" y uses cerdo, ni viceversa.`,
    dificultadInstruccion(dificultad_recetas),
  ].filter(Boolean)
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.slice(0, 30).map((s: string) => sanitizarParaPrompt(s, 50)).join(', ')}.`)
  if (nevera?.length) ctx.push(`En casa: ${nevera.slice(0, 30).map((s: string) => sanitizarParaPrompt(s, 50)).join(', ')}.`)
  if (extra_instrucciones) ctx.push(sanitizarParaPrompt(extra_instrucciones, 200))
  const idiomaStrExtra = idiomaInstruccion(lang)
  if (idiomaStrExtra) ctx.push(idiomaStrExtra)
  ctx.push(ingredientesParaPrompt(cocina))
  ctx.push(`JSON sin texto extra, UNA sola receta (no un array):
{"nombre":"A","tiempo_prep":30,"dificultad":"fácil","descripcion_corta":"desc","calorias_aprox":400,"ingredientes":[{"nombre":"x","cantidad":200,"unidad":"g"}],"tags":["t"]}
CRÍTICO: "ingredientes" debe incluir TODOS los ingredientes necesarios. Mínimo 4 ingredientes. Usa EXACTAMENTE los nombres del catálogo Mercadona de arriba.
Dificultad: "fácil","media" o "difícil". Unidades: g,kg,ml,l,ud,cucharada,pizca.`)

  return ctx.join('\n')
}

async function llamarClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic ${res.status}: ${err}`)
  }
  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  if (!text) throw new Error(`Anthropic devolvió contenido vacío`)
  const stripped = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = stripped.search(/[{\[]/)
  return start > 0 ? stripped.slice(start) : stripped
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  // Verificar JWT — endpoint no disponible sin sesión activa
  const { userId, error: authErr } = verificarJWT(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'No autorizado', detail: authErr }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { perfil, recetas_ya_usadas = [], dia, franja, accion, receta_existente, dias: diasReq, franjas: franjasReq, lang = 'es' } = body

    // Modo pasos: generar pasos de cocina para una receta
    if (body.action === 'pasos') {
      const { nombre, ingredientes, descripcion } = body as {
        nombre: string
        ingredientes: Array<{ nombre: string; cantidad: number; unidad: string }>
        descripcion: string
      }
      const nombreSafe = sanitizarParaPrompt(nombre ?? '', 100)
      const descSafe = sanitizarParaPrompt(descripcion ?? '', 200)
      const ingStr = (Array.isArray(ingredientes) ? ingredientes.slice(0, 20) : [])
        .map((i: { nombre: string; cantidad: number; unidad: string }) =>
          `${Number(i.cantidad) || 0} ${sanitizarParaPrompt(String(i.unidad ?? ''), 10)} ${sanitizarParaPrompt(String(i.nombre ?? ''), 50)}`)
        .join(', ')
      const idiomaStr = idiomaInstruccion(lang)
      const prompt = `Escribe los pasos de cocina numerados para: ${nombreSafe}. Ingredientes: ${ingStr}. ${descSafe}. Solo JSON: {"pasos":["1. ...","2. ...",...]}. Máximo 6 pasos concisos.${idiomaStr ? ' ' + idiomaStr : ''}`
      const raw = await llamarClaude(prompt, 1000)
      const parsed = JSON.parse(raw)
      return new Response(
        JSON.stringify({ pasos: parsed.pasos ?? [] }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Modo opción extra: añadir una segunda receta alternativa a una celda ya generada
    if (dia && franja && accion === 'opcion_extra') {
      const prompt = promptOpcionExtra(dia, franja, perfil, receta_existente ?? '', lang)
      const raw = await llamarClaude(prompt, 2000)
      const receta = JSON.parse(raw)
      return new Response(
        JSON.stringify({ dia, franja, receta }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Modo slot único: regenerar una celda concreta (1 receta fresca)
    if (dia && franja) {
      const prompt = promptSlot(dia, franja, perfil, lang)
      const raw = await llamarClaude(prompt, 2000)
      const receta = JSON.parse(raw)
      return new Response(
        JSON.stringify({ dia, franja, opciones: [receta] }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Modo semana (completa o parcial, según lo que pidió el usuario) — 1 receta por franja
    const dias: string[] = Array.isArray(diasReq) && diasReq.length ? diasReq : DIAS
    const franjas: string[] = Array.isArray(franjasReq) && franjasReq.length ? franjasReq : FRANJAS
    const claves = dias.flatMap((d: string) => franjas.map((f: string) => `${d}_${f}`))
    const maxTokens = Math.min(16000, 2000 + claves.length * 800)

    const prompt = promptSemana(perfil, recetas_ya_usadas, claves, lang)
    const raw = await llamarClaude(prompt, maxTokens)
    let semana: Record<string, unknown>
    try {
      semana = JSON.parse(raw)
    } catch {
      throw new Error(`JSON inválido del modelo. Inicio: ${raw.substring(0, 200)}`)
    }

    const resultado: Record<string, { opciones: unknown[] }> = {}
    for (const clave of claves) {
      const val = semana[clave]
      if (val) {
        const arr = Array.isArray(val) ? val : [val]
        resultado[clave] = { opciones: arr }
      }
    }

    return new Response(
      JSON.stringify({ semana: resultado }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Error interno'
    console.error('Error en generar-recetas:', raw)
    // No exponer detalles internos al cliente
    const esLimite = raw.includes('límite') || raw.includes('limite') || raw.includes('generaciones')
    const mensaje = esLimite ? raw : 'Error al generar recetas. Inténtalo de nuevo.'
    return new Response(
      JSON.stringify({ error: true, mensaje }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
