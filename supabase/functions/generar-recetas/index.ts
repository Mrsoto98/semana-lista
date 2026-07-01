// supabase/functions/generar-recetas/index.ts
import INGREDIENTES_JSON from './ingredientes.json' with { type: 'json' }

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function ingredientesParaPrompt(): string {
  const lineas: string[] = ['PRODUCTOS DISPONIBLES EN MERCADONA (usa SOLO estos nombres exactos para los ingredientes):']
  for (const [cat, nombres] of Object.entries(INGREDIENTES_JSON as Record<string, string[]>)) {
    lineas.push(`${cat}: ${(nombres as string[]).join(', ')}`)
  }
  return lineas.join('\n')
}

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
const FRANJAS = ['comida','cena']

function dificultadInstruccion(d?: string): string {
  if (d === 'fácil')   return 'Todas las recetas deben ser fáciles (≤30 min, técnicas simples).'
  if (d === 'media')   return 'Recetas de dificultad media (30-60 min, técnicas habituales).'
  if (d === 'difícil') return 'Recetas elaboradas y de alta dificultad (>45 min, técnicas avanzadas).'
  return 'Mezcla variada de dificultades: fácil, media y difícil.'
}

function promptSemana(perfil: Record<string, unknown>, recetasYaUsadas: string[]): string {
  const { personas, objetivo, ingredientes_no, nevera, extra_instrucciones, dificultad_recetas } = perfil as {
    personas: number; objetivo: string; ingredientes_no: string[]; nevera: string[]; extra_instrucciones?: string; dificultad_recetas?: string
  }

  const ctx: string[] = [
    `Eres un chef español. Crea un menú semanal para ${personas} persona${personas > 1 ? 's' : ''}, objetivo: ${objetivo}.`,
    `SOLO comidas y cenas principales. NO postres, NO desayunos, NO meriendas, NO bebidas.`,
    `Variedad: proteína distinta cada día (lun=pollo, mar=pescado, mié=legumbre/huevo, jue=cerdo/ternera, vie=pescado2, sáb=libre, dom=guiso). Comida y cena del mismo día sin repetir proteína. Técnicas variadas. 28 nombres distintos.`,
    dificultadInstruccion(dificultad_recetas),
  ]
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.join(', ')}.`)
  if (nevera?.length) ctx.push(`Ingredientes a usar: ${nevera.join(', ')}.`)
  if (recetasYaUsadas?.length) ctx.push(`No repetir estas recetas: ${recetasYaUsadas.slice(0, 8).join(', ')}.`)
  if (extra_instrucciones) ctx.push(extra_instrucciones)

  ctx.push(ingredientesParaPrompt())
  ctx.push(`Responde SOLO JSON válido sin texto extra. 14 claves (lunes_comida, lunes_cena, martes_comida, martes_cena, miercoles_comida, miercoles_cena, jueves_comida, jueves_cena, viernes_comida, viernes_cena, sabado_comida, sabado_cena, domingo_comida, domingo_cena), cada una con array de 2 recetas:
[{"nombre":"X","tiempo_prep":30,"dificultad":"fácil","descripcion_corta":"desc","calorias_aprox":400,"ingredientes":[{"nombre":"a","cantidad":200,"unidad":"g"}],"tags":["t"]},{"nombre":"Y",...}]
CRÍTICO: "ingredientes" debe incluir TODOS los ingredientes necesarios. Mínimo 4 ingredientes por receta. Usa EXACTAMENTE los nombres del catálogo Mercadona de arriba.
Dificultad: fácil/media/difícil. Unidades: g,kg,ml,l,ud,cucharada,pizca.`)

  return ctx.join('\n')
}

function promptSlot(dia: string, franja: string, perfil: Record<string, unknown>): string {
  const { personas, objetivo, ingredientes_no, nevera, extra_instrucciones, dificultad_recetas } = perfil as {
    personas: number; objetivo: string; ingredientes_no: string[]; nevera: string[]; extra_instrucciones?: string; dificultad_recetas?: string
  }
  const franjaLabel = franja === 'comida' ? 'mediodía' : 'noche'
  const diaLabel: Record<string, string> = {
    lunes:'lunes',martes:'martes',miercoles:'miércoles',
    jueves:'jueves',viernes:'viernes',sabado:'sábado',domingo:'domingo',
  }

  const ctx: string[] = [
    `Eres un chef español. Crea 2 recetas alternativas para ${franjaLabel} del ${diaLabel[dia] ?? dia}. ${personas} persona${personas > 1 ? 's' : ''}, objetivo: ${objetivo}. SOLO platos principales, NO postres.`,
    dificultadInstruccion(dificultad_recetas),
  ]
  if (ingredientes_no?.length) ctx.push(`Ingredientes prohibidos: ${ingredientes_no.join(', ')}.`)
  if (nevera?.length) ctx.push(`En casa: ${nevera.join(', ')}.`)
  if (extra_instrucciones) ctx.push(extra_instrucciones)
  ctx.push(ingredientesParaPrompt())
  ctx.push(`JSON sin texto extra, array de 2 recetas:
[{"nombre":"A","tiempo_prep":30,"dificultad":"fácil","descripcion_corta":"desc","calorias_aprox":400,"ingredientes":[{"nombre":"x","cantidad":200,"unidad":"g"}],"tags":["t"]},{"nombre":"B","tiempo_prep":20,"dificultad":"media","descripcion_corta":"desc2","calorias_aprox":350,"ingredientes":[{"nombre":"y","cantidad":150,"unidad":"g"}],"tags":["t2"]}]
CRÍTICO: "ingredientes" debe incluir TODOS los ingredientes necesarios. Mínimo 4 ingredientes. Usa EXACTAMENTE los nombres del catálogo Mercadona de arriba.
Dificultad: "fácil","media" o "difícil". Unidades: g,kg,ml,l,ud,cucharada,pizca.`)

  return ctx.join('\n')
}

async function llamarClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
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
  return text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const body = await req.json()
    const { perfil, recetas_ya_usadas = [], dia, franja } = body

    // Modo pasos: generar pasos de cocina para una receta
    if (body.action === 'pasos') {
      const { nombre, ingredientes, descripcion } = body as {
        nombre: string
        ingredientes: Array<{ nombre: string; cantidad: number; unidad: string }>
        descripcion: string
      }
      const ingStr = ingredientes.map((i: { nombre: string; cantidad: number; unidad: string }) => `${i.cantidad} ${i.unidad} ${i.nombre}`).join(', ')
      const prompt = `Escribe los pasos de cocina numerados para: ${nombre}. Ingredientes: ${ingStr}. ${descripcion}. Solo JSON: {"pasos":["1. ...","2. ...",...]}. Máximo 6 pasos concisos.`
      const raw = await llamarClaude(prompt, 500)
      const parsed = JSON.parse(raw)
      return new Response(
        JSON.stringify({ pasos: parsed.pasos ?? [] }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // Modo slot único: regenerar una celda concreta
    if (dia && franja) {
      const prompt = promptSlot(dia, franja, perfil)
      const raw = await llamarClaude(prompt, 1000)
      const opciones = JSON.parse(raw)
      const arr = Array.isArray(opciones) ? opciones : [opciones]
      return new Response(
        JSON.stringify({ dia, franja, opciones: arr }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // Modo semana completa
    const prompt = promptSemana(perfil, recetas_ya_usadas)
    const raw = await llamarClaude(prompt, 8000)
    let semana: Record<string, unknown>
    try {
      semana = JSON.parse(raw)
    } catch {
      throw new Error(`JSON inválido del modelo. Inicio: ${raw.substring(0, 200)}`)
    }

    const resultado: Record<string, { opciones: unknown[] }> = {}
    for (const d of DIAS) {
      for (const f of FRANJAS) {
        const clave = `${d}_${f}`
        const val = semana[clave]
        if (val) {
          const arr = Array.isArray(val) ? val : [val]
          resultado[clave] = { opciones: arr }
        }
      }
    }

    return new Response(
      JSON.stringify({ semana: resultado }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    console.error('Error en generar-recetas:', mensaje)
    return new Response(
      JSON.stringify({ error: true, mensaje }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
