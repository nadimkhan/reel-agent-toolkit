/**
 * Pollinations.ai image generation — adapted from ytautomation.
 * Generates images via gen.pollinations.ai, returns base64.
 */
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || ''

export interface GenImageResult {
  base64: string
  url: string
  width: number
  height: number
  seed: number
  model: string
}

function dims(ratio: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1024, height: 576 },
    '9:16': { width: 576, height: 1024 },
    '1:1':  { width: 1024, height: 1024 },
  }
  return map[ratio] || map['16:9']
}

export async function generateImage(
  prompt: string,
  ratio: string = '16:9',
  model: string = 'flux',
  seed?: number,
): Promise<GenImageResult> {
  const { width, height } = dims(ratio)
  const s = seed ?? Math.floor(Math.random() * 1_000_000)
  const encoded = encodeURIComponent(prompt)
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    seed: String(s),
    nologo: 'true',
    ...(POLLINATIONS_API_KEY ? { key: POLLINATIONS_API_KEY } : {}),
  })
  const url = `https://gen.pollinations.ai/image/${encoded}?${params}`

  const res = await fetch(url, {
    headers: { Accept: 'image/png,image/jpeg,image/webp,*/*' },
  })
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('image')) throw new Error(`Expected image, got ${ct}`)

  const buf = await res.arrayBuffer()
  return { base64: Buffer.from(buf).toString('base64'), url, width, height, seed: s, model }
}
