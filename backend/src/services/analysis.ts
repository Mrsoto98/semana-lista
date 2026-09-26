// Groq — OpenAI-compatible API, free tier (1000 req/day, 30 req/min)
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  timeout: 30_000,
})

export const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `Eres un intérprete de sueños experto en psicología junguiana, simbolismo universal y tradiciones oníricas. Ofreces análisis profundos, reveladores y personales que ayudan al soñador a entender qué le está comunicando su inconsciente.

REGLAS:
- Detecta el idioma del sueño y responde SIEMPRE en ese mismo idioma
- No incluyas ni menciones datos personales del soñador
- Tono cálido y cercano, nunca clínico ni académico
- El análisis debe sentirse revelador y significativo, no genérico
- Conecta los símbolos con emociones, miedos, deseos o etapas vitales
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
        content: `Analiza este sueño en profundidad. Devuelve EXACTAMENTE este JSON sin texto extra:
{
  "summary": "2-3 oraciones concisas que expliquen el significado del sueño: qué mensaje lanza el inconsciente, qué refleja emocionalmente. Sé específico con los elementos del sueño, no genérico.",
  "themes": ["tema central 1", "tema central 2", "tema central 3"],
  "symbols": ["símbolo clave 1 con su significado breve", "símbolo clave 2 con su significado breve"],
  "emotional_tone": "descripción precisa de la atmósfera emocional del sueño en una frase",
  "interpretations": [
    { "text": "Interpretación profunda de 3-4 oraciones: conecta los símbolos con posibles experiencias, miedos, deseos o procesos que el soñador podría estar atravesando. Ofrece una lectura que invite a la reflexión.", "confidence": 0.85 }
  ]
}

Sueño a analizar: ${dreamText}`,
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
