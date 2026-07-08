// Uses Z.ai (ZhipuAI) — OpenAI-compatible API, free tier
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY,
  baseURL: 'https://api.z.ai/api/paas/v4',
  timeout: 60_000,
})

export const MODEL = 'glm-4.5-air'  // lighter & faster than glm-4.6

const SYSTEM_PROMPT = `Eres un intérprete onírico. Analizas sueños de forma simbólica y reflexiva,
nunca como diagnóstico médico o psicológico. Responde ÚNICAMENTE con JSON válido, sin texto extra.`

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
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analiza este sueño. Devuelve SOLO este JSON:
{
  "summary": "resumen en 2-3 oraciones",
  "themes": ["tema1", "tema2"],
  "symbols": ["símbolo1", "símbolo2"],
  "emotional_tone": "tono emocional en una frase",
  "interpretations": [
    { "text": "interpretación reflexiva (no diagnóstico)", "confidence": 0.85 }
  ]
}

Sueño: ${dreamText}`,
      },
    ],
    max_tokens: 600,
  })

  const text = completion.choices[0]?.message?.content ?? '{}'
  const clean = text.replace(/^```json?\s*/m, '').replace(/```\s*$/m, '').trim()

  try {
    return JSON.parse(clean) as DreamAnalysisResult
  } catch {
    // Fallback if model wraps output in extra text
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as DreamAnalysisResult
    throw new Error('No se pudo parsear la respuesta de Z.ai')
  }
}
