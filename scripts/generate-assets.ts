/**
 * generate-assets.ts
 *
 * Standalone script: takes a script file + niche slug, runs:
 *   1. Scene Splitter  → scenes with narration + image prompts
 *   2. Asset Generator → Pollinations images (→ upscaled) + Azure TTS audio
 *
 * Usage:
 *   npx tsx scripts/generate-assets.ts <script-file.md> <slug> [16:9|9:16]
 *
 * Output:
 *   sessions/<slug>/<YYYY-MM-DD>/scenes.json        — scene breakdown
 *   sessions/<slug>/<YYYY-MM-DD>/assets/manifest.json — asset manifest
 *   sessions/<slug>/<YYYY-MM-DD>/assets/scene_XXX/image.png
 *   sessions/<slug>/<YYYY-MM-DD>/assets/scene_XXX/audio.mp3
 *
 * Env (.env in project root):
 *   GROQ_API_KEY, KIRA_API_KEY
 *   POLLINATIONS_API_KEY
 *   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_VOICE_NAME
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { generateText } from '../lib/llm.js'
import { generateImage } from '../lib/pollinations.js'
import { upscaleBase64 } from '../lib/upscale.js'
import { generateNarration } from '../lib/tts.js'

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim()
    if (k && !process.env[k]) process.env[k] = v
  }
}

const PROJECT_ROOT = process.cwd()
const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

// ── CLI args ───────────────────────────────────────────────────────────────────
const scriptFile = process.argv[2]
const slug = process.argv[3]
const ratio = (process.argv[4] || '16:9') as '16:9' | '9:16'

if (!scriptFile || !slug) {
  console.error('Usage: npx tsx scripts/generate-assets.ts <script.md> <slug> [16:9|9:16]')
  process.exit(1)
}
if (!existsSync(scriptFile)) {
  console.error(`Script not found: ${scriptFile}`)
  process.exit(1)
}

// ── Load script ────────────────────────────────────────────────────────────────
const scriptContent = readFileSync(scriptFile, 'utf-8')
const titleMatch = scriptContent.match(/^#\s+(.+)/m)
const scriptTitle = titleMatch ? titleMatch[1].trim() : slug

// Strip markdown noise for scene splitting
const scriptBody = scriptContent
  .replace(/^#.*$/gm, '')
  .replace(/\*\*.*?\*\*/g, '')
  .replace(/\[.*?\]\(.*?\)/g, '')
  .replace(/\[SPEAK\].*?\[\/SPEAK\]/gis, '')
  .replace(/\[TEXT ON SCREEN\].*?\[\/TEXT ON SCREEN\]/gis, '')
  .replace(/^.*?(?:HOOK|SCRIPT BODY|SOLUTION|CTA).*$/gim, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

// ── Session dirs ──────────────────────────────────────────────────────────────
const sessionDir = join(PROJECT_ROOT, 'sessions', slug, today)
const assetsDir = join(sessionDir, 'assets')
mkdirSync(assetsDir, { recursive: true })

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function clampWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= max) return text.trim()
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]
  let partial = ''
  for (const s of sentences) {
    const cand = (partial + ' ' + s).trim()
    if (cand.split(/\s+/).filter(Boolean).length <= max) partial = cand
    else break
  }
  return partial.trim() || words.slice(0, max).join(' ')
}

function extractJson(text: string): any | null {
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
  if (s >= 0 && e > s) try { return JSON.parse(cleaned.slice(s, e + 1)) } catch { /* fall through */ }
  return null
}

// ── Step 1: Scene Splitting ───────────────────────────────────────────────────
console.log(`[generate-assets] Step 1: Splitting "${scriptTitle}" into scenes (${ratio})`)

const systemPrompt = `You are a YouTube video director.
Split the script into scenes. CRITICAL RULES:
- Long video (16:9): each scene max 8 seconds of narration (~18-22 words)
- Short (9:16): each scene max 6 seconds (~12-14 words)
- If a scene's narration is too long, SPLIT IT — never cram
- Each scene's image prompt must depict EXACTLY what that scene's narration describes
- Image prompts: cinematic, detailed, no text, no people, historical documentary aesthetic
- Preserve exact character/entity names — do not alter spellings
- Return ONLY valid JSON (no markdown, no preamble)

Return:
{
  "scenes": [
    {
      "narration": "exact narration for this scene",
      "imagePrompt": "visual description matching the narration"
    }
  ]
}`

const llmResult = await generateText(systemPrompt, `${scriptTitle}\n\n${scriptBody.slice(0, 8000)}`, {
  temperature: 0.3,
  maxTokens: 4000,
})

const parsed = extractJson(llmResult?.content || '')
if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
  console.error('[generate-assets] Scene parsing failed:', (llmResult?.content || '').slice(0, 300))
  process.exit(1)
}

// Build timed scenes
const maxWords = ratio === '16:9' ? 22 : 14
const maxSecs = ratio === '16:9' ? 8 : 6
const scenes: any[] = []
let elapsed = 0

for (const raw of parsed.scenes) {
  let narration = (raw.narration || '').trim()
  const imagePrompt = (raw.imagePrompt || '').trim()
  if (!narration) continue
  if (narration.split(/\s+/).filter(Boolean).length > maxWords) {
    narration = clampWords(narration, maxWords)
  }
  const words = narration.split(/\s+/).filter(Boolean).length
  const dur = Math.min(Math.max(Math.round((words / 150) * 60), 4), maxSecs)
  scenes.push({
    index: scenes.length,
    narration,
    imagePrompt,
    timestampStart: fmtTime(elapsed),
    timestampEnd: fmtTime(elapsed + dur),
    wordCount: words,
    estimatedDurationSec: dur,
  })
  elapsed += dur
}

const splitResult = {
  scriptTitle,
  scenes,
  totalDurationSec: elapsed,
  ratio,
  generatedAt: new Date().toISOString(),
}

const scenesJsonPath = join(sessionDir, 'scenes.json')
writeFileSync(scenesJsonPath, JSON.stringify(splitResult, null, 2))
console.log(`[generate-assets] ${scenes.length} scenes saved → ${scenesJsonPath}`)
console.log(`[generate-assets] Total duration: ~${elapsed}s`)

// ── Step 2: Asset Generation ───────────────────────────────────────────────────
console.log(`[generate-assets] Step 2: Generating ${scenes.length} scene assets`)

const azureVoice = process.env.AZURE_VOICE_NAME || 'en-US-JennyNeural'
let imgOk = 0, imgFail = 0, audOk = 0, audFail = 0

const BATCH = 3
for (let i = 0; i < scenes.length; i += BATCH) {
  const batch = scenes.slice(i, i + BATCH)
  await Promise.all(batch.map(async (scene) => {
    const sceneAssetDir = join(assetsDir, `scene_${String(scene.index).padStart(3, '0')}`)
    mkdirSync(sceneAssetDir, { recursive: true })
    const imgPath = join(sceneAssetDir, 'image.png')
    const audPath = join(sceneAssetDir, 'audio.mp3')

    // Image
    try {
      const imgResult = await generateImage(scene.imagePrompt, ratio, 'flux')
      const upscaled = await upscaleBase64(imgResult.base64, ratio, true)
      writeFileSync(imgPath, Buffer.from(upscaled, 'base64'))
      scene.imagePath = imgPath
      imgOk++
      console.log(`[generate-assets] Scene ${scene.index} image OK`)
    } catch (e: any) {
      scene.imageError = e.message
      imgFail++
      console.error(`[generate-assets] Scene ${scene.index} image FAIL: ${e.message}`)
    }

    // Audio
    try {
      await generateNarration(scene.narration, audPath, azureVoice)
      scene.audioPath = audPath
      audOk++
      console.log(`[generate-assets] Scene ${scene.index} audio OK`)
    } catch (e: any) {
      scene.audioError = e.message
      audFail++
      console.error(`[generate-assets] Scene ${scene.index} audio FAIL: ${e.message}`)
    }
  }))

  const done = Math.min(i + BATCH, scenes.length)
  console.log(`[generate-assets] Progress: ${done}/${scenes.length} scenes`)
}

// Save final manifest
const manifest = {
  slug,
  date: today,
  ratio,
  scriptTitle,
  totalScenes: scenes.length,
  imagesGenerated: imgOk,
  imagesFailed: imgFail,
  audiosGenerated: audOk,
  audiosFailed: audFail,
  scenes,
  completedAt: new Date().toISOString(),
}

const manifestPath = join(assetsDir, 'manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

// Overwrite scenes.json with full asset data
writeFileSync(scenesJsonPath, JSON.stringify(manifest, null, 2))

console.log('\n[generate-assets] === DONE ===')
console.log(`Images: ${imgOk}/${scenes.length} OK  |  Audio: ${audOk}/${scenes.length} OK`)
console.log(`Manifest: ${manifestPath}`)
