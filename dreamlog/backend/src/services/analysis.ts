// Uses Groq free tier (Llama 3.1) instead of Anthropic Claude
import Groq from 'groq-sdk'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const MODEL = 'llama-3.1-8b-instant'

const SYSTEM_PROMPT = `Eres un asistente de interpretación onírica. Analizas sueños desde una perspectiva
simbólica y reflexiva, sin diagnósticos médicos ni psicológicos. Siempre recuerda que tus
interpretaciones son especulativas y de exploración personal, no verdades literales.
Responde SIEMPRE en JSON válido con la estructura indicada, sin texto adicional fuera del JSON.`

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
        content: `Analiza este sueño y devuelve un JSON con esta estructura exacta:
{
  "summary": "resumen en 2-3 oraciones",
  "themes": ["tema1", "tema2"],
  "symbols": ["símbolo1", "símbolo2"],
  "emotional_tone": "tono emocional predominante en una frase",
  "interpretations": [
    { "text": "interpretación simbólica (interpretación reflexiva, no diagnóstico)", "confidence": 0.8 }
  ]
}

Incluye 2-4 interpretaciones ordenadas de más a menos probable.

Sueño:
${dreamText}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  })

  const text = completion.choices[0]?.message?.content ?? '{}'
  return JSON.parse(text) as DreamAnalysisResult
}
