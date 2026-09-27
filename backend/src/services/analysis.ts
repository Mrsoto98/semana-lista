// Groq — OpenAI-compatible API, free tier (1000 req/day, 30 req/min)
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  timeout: 30_000,
})

export const MODEL = 'openai/gpt-oss-120b'

const SYSTEM_PROMPT = `Eres un intérprete de sueños experto en psicología junguiana, simbolismo universal y tradiciones oníricas. Ofreces análisis profundos, reveladores y personales que ayudan al soñador a entender qué le está comunicando su inconsciente.

REGLAS:
- Detecta el idioma del sueño y responde SIEMPRE en ese mismo idioma
- No incluyas ni menciones datos personales del soñador
- Tono cálido y cercano, nunca clínico ni académico
- El análisis debe sentirse revelador y significativo, no genérico
- Conecta los símbolos con emociones, miedos, deseos o etapas vitales
- Responde ÚNICAMENTE con JSON válido`

export async function analyzeConnection(
  myTitle: string | null, myBody: string,
  theirTitle: string | null, theirBody: string,
): Promise<string> {
  const dreamA = myTitle ? `${myTitle}: ${myBody.slice(0, 300)}` : myBody.slice(0, 300)
  const dreamB = theirTitle ? `${theirTitle}: ${theirBody.slice(0, 300)}` : theirBody.slice(0, 300)

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Eres un intérprete de sueños. Responde con UNA sola frase corta (máx 120 caracteres) que revele la conexión onírica entre dos sueños de personas distintas. Sé específico, poético y revelador. Sin comillas ni texto extra.',
      },
      {
        role: 'user',
        content: `Sueño A: ${dreamA}\n\nSueño B: ${dreamB}\n\n¿Qué conexión profunda comparten estos dos sueños?`,
      },
    ],
    max_tokens: 120,
    temperature: 0.85,
  })

  return completion.choices[0]?.message?.content?.trim() ?? 'Ambos soñadores comparten un espacio onírico común.'
}

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
    // response_format not supported by reasoning models (openai/gpt-oss-120b)
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analiza este sueño en profundidad. Devuelve EXACTAMENTE este JSON sin texto extra ni marcadores de código:
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
    max_completion_tokens: 2048,
    temperature: 1,
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
