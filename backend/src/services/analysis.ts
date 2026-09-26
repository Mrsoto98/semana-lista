// Groq — OpenAI-compatible API, free tier (1000 req/day, 30 req/min)
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  timeout: 30_000,
})

export const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `Eres un intérprete de sueños. Analizas sueños de forma simbólica y reflexiva, con un tono cercano y poético, nunca clínico ni como diagnóstico. Tu análisis es para reflexión personal y entretenimiento.

REGLAS:
- Detecta el idioma del sueño y responde SIEMPRE en ese mismo idioma
- No incluyas ni menciones datos personales del soñador
- Tono cálido, cercano, como un amigo que entiende de simbolismo onírico
- Responde ÚNICAMENTE con JSON válido`

interface DreamAnalysisResult {
  summary: string
  themes: string[]
  symbols: string[]
  emotional_tone: string
  interpretations: { text: string; confidence: number }[]
}

export async function analyzeDream(title: string | null, body: string): Promise<DreamAnalysisResult> {
  const dreamText = title ? `Título: ${title}\n\n${body}` : body

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analiza este sueño. Devuelve EXACTAMENTE este JSON sin texto extra:
{
  "summary": "interpretación simbólica en 2-3 oraciones, tono reflexivo",
  "themes": ["tema1", "tema2", "tema3"],
  "symbols": ["símbolo1", "símbolo2"],
  "emotional_tone": "descripción del tono emocional en una frase",
  "interpretations": [
    { "text": "lectura simbólica reflexiva (no diagnóstico)", "confidence": 0.85 }
  ]
}

Sueño: ${dreamText}`,
      },
    ],
    max_tokens: 700,
    temperature: 0.7,
  })

  const text = completion.choices[0]?.message?.content ?? '{}'

  try {
    return JSON.parse(text) as DreamAnalysisResult
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as DreamAnalysisResult
    throw new Error('No se pudo parsear la respuesta de Groq')
  }
}
