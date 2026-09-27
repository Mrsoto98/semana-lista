export const MODEL = 'embed-multilingual-light-v3.0'
export const DIMENSIONS = 384

export async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.cohere.com/v2/embed', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [text.slice(0, 512)],
      model: MODEL,
      input_type: 'search_document',
      embedding_types: ['float'],
    }),
  })
  if (!res.ok) throw new Error(`Cohere API ${res.status}: ${await res.text()}`)
  const data = await res.json() as { embeddings: { float: number[][] } }
  return data.embeddings.float[0]
}

export async function warmupModel(): Promise<void> {
  console.log('[embedding] Verifying Cohere API connection...')
  await embed('calentamiento')
  console.log('[embedding] Model ready (Cohere embed-multilingual-light-v3.0)')
}
