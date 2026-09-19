/**
 * Image upscaler — adapted from ytautomation.
 * Uses sharp for high-quality Lanczos3 resampling + sharpening.
 *
 * Target resolutions:
 *   16:9 → 1920 x 1080
 *    9:16 → 1080 x 1920
 *    1:1  → 1080 x 1080
 *
 * Also exports upscaleBase64() for direct base64→base64 pipeline.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const TARGETS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
}

export interface UpscaleResult {
  outputPath: string
  originalSize: string
  upscaledSize: string
}

function fmt(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const s = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]
}

async function sharpPipeline(input: Buffer, ratio: string, enhance = true) {
  const target = TARGETS[ratio] || TARGETS['16:9']
  const { default: sharp } = await import('sharp')

  let p = sharp(input, { failOnError: false })
    .resize({ width: target.width, height: target.height, fit: 'fill', kernel: 'lanczos3' })
    .sharpen({ sigma: 1.2, m1: 0.5, m2: 0.8 })

  if (enhance) {
    p = p.modulate({ brightness: 1.05, saturation: 1.05 })
  }

  return { pipeline: p, target }
}

/**
 * Upscale a local image file to target resolution.
 * Returns the path to the upscaled PNG.
 */
export async function upscaleImage(
  inputPath: string,
  ratio: string = '16:9',
  enhance = true,
): Promise<UpscaleResult> {
  if (!existsSync(inputPath)) throw new Error(`File not found: ${inputPath}`)

  const inputBuf = readFileSync(inputPath)
  const { pipeline, target } = await sharpPipeline(inputBuf, ratio, enhance)
  const outputPath = inputPath.replace(/(\.[^.]+)$/, '_upscaled.png')

  await pipeline.png({ quality: 95, compressionLevel: 6 }).toFile(outputPath)

  const origSize = fmt(inputBuf.byteLength)
  const upSize = fmt(readFileSync(outputPath).byteLength)
  console.log(`[upscale] ${target.width}x${target.height} | ${origSize} → ${upSize} | ${outputPath}`)

  return { outputPath, originalSize: origSize, upscaledSize: upSize }
}

/**
 * Upscale a base64-encoded image and return base64 of the result.
 */
export async function upscaleBase64(
  base64Data: string,
  ratio: string = '16:9',
  enhance = true,
): Promise<string> {
  const buf = Buffer.from(base64Data, 'base64')
  const { pipeline } = await sharpPipeline(buf, ratio, enhance)
  const outBuf = await pipeline.png({ quality: 95 }).toBuffer()
  return outBuf.toString('base64')
}

/**
 * Check if an image needs upscaling.
 */
export function needsUpscaling(width: number, height: number, ratio: string): boolean {
  const t = TARGETS[ratio] || TARGETS['16:9']
  return width < t.width || height < t.height
}
