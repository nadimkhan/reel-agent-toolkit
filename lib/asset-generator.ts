/**
 * Asset Generator for reel-agent-toolkit.
 * Generates Pollinations images + Azure TTS narration for each scene.
 * All outputs saved to sessions/<slug>/<date>/assets/
 *
 * Hardcoded ratios:
 *   Long video  → 16:9 landscape  (1024x576 → upscale to 1920x1080)
 *   Short       →  9:16 portrait (576x1024 → upscale to 1080x1920)
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { generateImage } from './pollinations.js'
import { upscaleImage, upscaleBase64 } from './upscale.js'
import { generateNarration } from './tts.js'
import { generateText } from './llm.js'

export interface SceneAsset {
  sceneIndex: number
  narration: string
  imagePrompt: string
  timestampStart: string
  timestampEnd: string

  imagePath?: string      // local path to upscaled image
  audioPath?: string      // local path to MP3

  imageSuccess: boolean
  audioSuccess: boolean
  error?: string
}

export interface AssetGenResult {
  slug: string
  date: string
  ratio: '16:9' | '9:16'
  scriptTitle: string
  scenes: SceneAsset[]
  totalScenes: number
  imagesGenerated: number
  imagesFailed: number
  audiosGenerated: number
  audiosFailed: number
  startedAt: string
  completedAt?: string
}

// Asset output directory
function assetDir(slug: string, date: string): string {
  return join(process.cwd(), 'sessions', slug, date, 'assets')
}

function sceneDir(slug: string, date: string, idx: number): string {
  return join(assetDir(slug, date), `scene_${String(idx).padStart(3, '0')}`)
}

/**
 * Generate all assets for a list of scenes.
 * Skips scenes that already have imagePath + audioPath (idempotent).
 */
export async function generateAssets(
  slug: string,
  date: string,
  scriptTitle: string,
  ratio: '16:9' | '9:16',
  scenes: Array<{
    index: number
    narration: string
    imagePrompt: string
    timestampStart: string
    timestampEnd: string
  }>,
  options: {
    forceRegenerate?: boolean
    azureVoice?: string
    imageModel?: string
    imageSeed?: number
  } = {},
): Promise<AssetGenResult> {
  const outDir = assetDir(slug, date)
  mkdirSync(outDir, { recursive: true })

  const result: AssetGenResult = {
    slug,
    date,
    ratio,
    scriptTitle,
    scenes: [],
    totalScenes: scenes.length,
    imagesGenerated: 0,
    imagesFailed: 0,
    audiosGenerated: 0,
    audiosFailed: 0,
    startedAt: new Date().toISOString(),
  }

  const BATCH_SIZE = 3 // concurrent image gen + TTS calls

  for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
    const batch = scenes.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (scene) => {
        const asset = await generateSceneAsset(
          slug, date, ratio, scene, options
        )
        result.scenes.push(asset)
        if (asset.imageSuccess) result.imagesGenerated++
        else result.imagesFailed++
        if (asset.audioSuccess) result.audiosGenerated++
        else result.audiosFailed++
      })
    )
    // Progress log
    const done = result.imagesGenerated + result.imagesFailed
    console.log(`[asset-gen] ${done}/${scenes.length} scenes complete`)
  }

  result.completedAt = new Date().toISOString()

  // Save manifest
  const manifestPath = join(outDir, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(result, null, 2))
  console.log(`[asset-gen] Manifest saved: ${manifestPath}`)

  return result
}

/**
 * Generate image + audio for ONE scene.
 */
async function generateSceneAsset(
  slug: string,
  date: string,
  ratio: '16:9' | '9:16',
  scene: {
    index: number
    narration: string
    imagePrompt: string
    timestampStart: string
    timestampEnd: string
  },
  options: {
    forceRegenerate?: boolean
    azureVoice?: string
    imageModel?: string
    imageSeed?: number
  } = {},
): Promise<SceneAsset> {
  const sd = sceneDir(slug, date, scene.index)
  mkdirSync(sd, { recursive: true })

  const imgFile = join(sd, 'image.png')
  const audioFile = join(sd, 'audio.mp3')

  const asset: SceneAsset = {
    sceneIndex: scene.index,
    narration: scene.narration,
    imagePrompt: scene.imagePrompt,
    timestampStart: scene.timestampStart,
    timestampEnd: scene.timestampEnd,
    imageSuccess: false,
    audioSuccess: false,
  }

  // ── Image ────────────────────────────────────────────────────────────────
  const skipImage = !options.forceRegenerate && existsSync(imgFile)
  if (!skipImage) {
    try {
      console.log(`[asset-gen] Scene ${scene.index} generating image...`)
      const imgResult = await generateImage(
        scene.imagePrompt,
        ratio,
        options.imageModel || 'flux',
        options.imageSeed,
      )

      // Upscale via base64 → sharp (keeps memory low)
      const upscaled = await upscaleBase64(imgResult.base64, ratio, true)
      writeFileSync(imgFile, Buffer.from(upscaled, 'base64'))

      asset.imagePath = imgFile
      asset.imageSuccess = true
      console.log(`[asset-gen] Scene ${scene.index} image OK → ${imgFile}`)
    } catch (e: any) {
      asset.error = `image: ${e.message}`
      console.error(`[asset-gen] Scene ${scene.index} image FAILED: ${e.message}`)
    }
  } else {
    asset.imagePath = imgFile
    asset.imageSuccess = true
    console.log(`[asset-gen] Scene ${scene.index} image SKIPPED (exists)`)
  }

  // ── Audio ────────────────────────────────────────────────────────────────
  const skipAudio = !options.forceRegenerate && existsSync(audioFile)
  if (!skipAudio) {
    try {
      console.log(`[asset-gen] Scene ${scene.index} generating audio...`)
      const voice = options.azureVoice || 'en-US-JennyNeural'
      await generateNarration(scene.narration, audioFile, voice)
      asset.audioPath = audioFile
      asset.audioSuccess = true
      console.log(`[asset-gen] Scene ${scene.index} audio OK → ${audioFile}`)
    } catch (e: any) {
      asset.error = (asset.error ? asset.error + '; ' : '') + `audio: ${e.message}`
      console.error(`[asset-gen] Scene ${scene.index} audio FAILED: ${e.message}`)
    }
  } else {
    asset.audioPath = audioFile
    asset.audioSuccess = true
    console.log(`[asset-gen] Scene ${scene.index} audio SKIPPED (exists)`)
  }

  return asset
}
