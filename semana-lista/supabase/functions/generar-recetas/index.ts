// supabase/functions/generar-recetas/index.ts
import Anthropic from 'npm:@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RECETA_SCHEMA = {
  type: 'object',
  properties: {
    opciones: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          nombre:           { type: 'string' },
          tiempo_prep:      { type: 'number' },
          dificultad:       { type: 'string', enum: ['fácil', 'media', 'difícil'] },
          descripcion_corta:{ type: 'string' },
          calorias_aprox:   { type: 'number' },
          ingredientes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre:   { type: 'string' },
                cantidad: { type: 'number' },
                unidad:   { type: 'string', enum: ['g', 'kg', 'ml', 'l', 'ud', 'cucharada', 'pizca'] },
              },
              required: ['nombre', 'cantidad', 'unidad'],
              additionalProperties: false,
            },
          },
          pasos: { type: 'array', items: { type: 'string' } },
          tags:  { type: 'array', items: { type: 'string' } },
        },
        required: ['nombre', 'tiempo_prep', 'dificultad', 'descripcion_corta', 'calorias_aprox', 'ingredientes', 'pasos', 'tags'],
        additionalProperties: false,
      },
    },
  },
  required: ['opciones'],
  additionalProperties: false,
}

const FRANJA_LABEL: Record<string, string> = {
  comida: 'comida (mediodía)',
  cena: 'cena (noche)',
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo',
}

function construirPrompt(
  dia: string,
  franja: string,
  perfil: Record<string, unknown>,
  recetasYaUsadas: string[],
): string {
  const { personas, objetivo, ingredientes_no, ingredientes_si, nevera } = perfil as {
    personas: number
    objetivo: string
    ingredientes_no: string[]
    ingredientes_si: string[]
    nevera: string[]
  }

  let prompt = `Genera exactamente 3 recetas para la ${FRANJA_LABEL[franja] ?? franja} del ${DIA_LABEL[dia] ?? dia}.

Hogar: ${personas} persona${personas > 1 ? 's' : ''}.
Objetivo nutricional: ${objetivo}.`

  if (ingredientes_no?.length) {
    prompt += `\nIngredientes PROHIBIDOS (nunca incluir): ${ingredientes_no.join(', ')}.`
  }
  if (ingredientes_si?.length) {
    prompt += `\nIngredientes preferidos (incluir si encaja): ${ingredientes_si.join(', ')}.`
  }
  if (nevera?.length) {
    prompt += `\nYa tiene en casa esta semana (priorizar su uso): ${nevera.join(', ')}.`
  }
  if (recetasYaUsadas?.length) {
    prompt += `\nRecetas ya planificadas esta semana (NO repetir ni variantes similares): ${recetasYaUsadas.join(', ')}.`
  }

  prompt += '\n\nLas 3 opciones deben ser completamente distintas entre sí. Las cantidades de ingredientes deben ser para el número de personas indicado.'

  return prompt
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  let dia = '', franja = ''
  try {
    const body = await req.json()
    dia = body.dia
    franja = body.franja
    const { perfil, recetas_ya_usadas = [] } = body

    const prompt = construirPrompt(dia, franja, perfil, recetas_ya_usadas)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: RECETA_SCHEMA,
        },
      },
    } as Parameters<typeof anthropic.messages.create>[0])

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const datos = JSON.parse(text)

    return new Response(
      JSON.stringify({ dia, franja, opciones: datos.opciones }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    return new Response(
      JSON.stringify({ error: true, dia, franja, mensaje }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
