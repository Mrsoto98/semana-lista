// supabase/functions/generar-recetas/index.ts
import INGREDIENTES_JSON from './ingredientes.json' with { type: 'json' }
import INGREDIENTES_COCINAS from './ingredientes-cocinas.json' with { type: 'json' }

const ZHIPU_API_KEY = Deno.env.get('ZHIPU_API_KEY')!
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const ZHIPU_MODEL = 'glm-4.6'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://semana-lista.vercel.app'

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = origin === ALLOWED_ORIGIN || origin.endsWith('.vercel.app') ? origin : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
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

function dificultadInstruccion(d?: string): string {
  if (d === 'fácil')   return 'Todas las recetas deben ser fáciles (≤30 min, técnicas simples).'
  if (d === 'media')   return 'Recetas de dificultad media (30-60 min, técnicas habituales).'
  if (d === 'difícil') return 'Recetas elaboradas y de alta dificultad (>45 min, técnicas avanzadas).'
  return 'Mezcla variada de dificultades: fácil, media y difícil.'
}

const DESCRIPCION_COCINA: Record<string, string> = {
  'española y mediterránea': 'cocina española y mediterránea (paellas, potajes, gazpacho, tortilla, pescados al horno, sofrito, pisto...)',
  'italiana': 'cocina italiana (pasta, risotto, pizza, gnocchi, parmigiana, bruschetta, carpaccio...)',
  'asiática': 'cocina asiática (wok, curry, ramen, gyozas, yakitori, arroz frito, dim sum, teriyaki...)',
  'americana': 'cocina americana/tex-mex (hamburguesas, costillas BBQ, fajitas, mac and cheese, hot dogs, coleslaw, pulled pork, burritos, nachos, alitas...)',
  'mexicana': 'cocina mexicana (tacos, enchiladas, quesadillas, guacamole, chile con carne, tamales, burritos...)',
  'tradicional española': 'cocina tradicional española (cocido, fabada, callos, gazpacho, salmorejo, croquetas, potaje, pisto...)',
  'saludable y ligera': 'cocina saludable y ligera (ensaladas, salteados de verduras, proteína a la plancha, batidos, smoothie bowls...)',
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
  const ctx: string[] = [
    `Eres un chef español. Crea un menú para ${personas} persona${personas > 1 ? 's' : ''} (${claves.length} franja${claves.length > 1 ? 's' : ''} de comida en total), objetivo: ${objetivo}.`,
    `SOLO comidas y cenas principales. NO postres, NO desayunos, NO meriendas, NO bebidas.`,
    `CANTIDADES OBLIGATORIAS: las raciones deben ser para ${personas} persona${personas > 1 ? 's' : ''} como plato principal completo y saciante. Para ${personas} persona${personas > 1 ? 's' : ''}: mínimo ${personas * 150}-${personas * 200}g de proteína principal, ${personas * 150}-${personas * 250}g de carbohidrato si lo lleva, verduras y acompañamientos proporcionados. No escatimes — un plato principal no es una tapa.`,
    desc ? `ESTILO DE COCINA OBLIGATORIO: ${desc}. TODAS las recetas deben pertenecer claramente a este estilo. NO mezcles con otros estilos.` : '',
    `VARIEDAD DE PROTEÍNAS: NO pongas pollo en más de la mitad de las recetas. Rota entre: pollo, cerdo, ternera/vacuno, huevos, legumbres, pescado/marisco. Si un mismo día tiene comida y cena, usa proteínas distintas. ${claves.length} nombres de receta distintos en total.`,
    dificultadInstruccion(dificultad_recetas),
  ].filter(Boolean)
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.join(', ')}.`)
  if (nevera?.length) ctx.push(`Ingredientes a usar: ${nevera.join(', ')}.`)
  if (recetasYaUsadas?.length) ctx.push(`No repetir estas recetas: ${recetasYaUsadas.slice(0, 8).join(', ')}.`)
  if (extra_instrucciones) ctx.push(extra_instrucciones)
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
    dificultadInstruccion(dificultad_recetas),
  ].filter(Boolean)
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.join(', ')}.`)
  if (nevera?.length) ctx.push(`En casa: ${nevera.join(', ')}.`)
  if (extra_instrucciones) ctx.push(extra_instrucciones)
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
    dificultadInstruccion(dificultad_recetas),
  ].filter(Boolean)
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.join(', ')}.`)
  if (nevera?.length) ctx.push(`En casa: ${nevera.join(', ')}.`)
  if (extra_instrucciones) ctx.push(extra_instrucciones)
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
  const res = await fetch(ZHIPU_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Zhipu ${res.status}: ${err}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) {
    const reason = data.choices?.[0]?.finish_reason ?? 'unknown'
    throw new Error(`Zhipu devolvió contenido vacío. finish_reason=${reason}. data=${JSON.stringify(data).substring(0, 300)}`)
  }
  // Strip markdown code blocks if present, then extract the JSON object/array
  const stripped = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
  // Find the first { or [ to skip any preamble text the model may have added
  const start = stripped.search(/[{\[]/)
  return start > 0 ? stripped.slice(start) : stripped
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

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
      const ingStr = ingredientes.map((i: { nombre: string; cantidad: number; unidad: string }) => `${i.cantidad} ${i.unidad} ${i.nombre}`).join(', ')
      const idiomaStr = idiomaInstruccion(lang)
      const prompt = `Escribe los pasos de cocina numerados para: ${nombre}. Ingredientes: ${ingStr}. ${descripcion}. Solo JSON: {"pasos":["1. ...","2. ...",...]}. Máximo 6 pasos concisos.${idiomaStr ? ' ' + idiomaStr : ''}`
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
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    console.error('Error en generar-recetas:', mensaje)
    return new Response(
      JSON.stringify({ error: true, mensaje }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
