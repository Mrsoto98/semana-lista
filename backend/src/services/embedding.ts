// Uses HuggingFace Inference API (free) with all-MiniLM-L6-v2 (384 dims)
// Free tier: ~30k requests/month

export const MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
export const DIMENSIONS = 384

export async function embed(text: string): Promise<number[]> {
  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text.slice(0, 512), // MiniLM max context
        options: { wait_for_model: true },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace embedding error: ${err}`)
  }

  const data = await response.json() as number[]
  return data
}
