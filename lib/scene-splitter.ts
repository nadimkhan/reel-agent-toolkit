/**
 * Scene Splitter — splits a full script into timed scenes with narration + Pollinations prompts.
 *
 * Hardcoded pacing:
 *   Long video (16:9) → max 8 sec per scene
 *   Short     (9:16)  → max 6 sec per scene
 *
 * Dependencies: lib/llm.ts
 * Env vars: GROQ_API_KEY, KIRA_API_KEY (optional)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { generateText } from './llm.js'

export interface Scene {
  index: number
  narration: string
  imagePrompt: string
  timestampStart: string
  timestampEnd: string
  wordCount: number
  estimatedDurationSec: number
}

export interface SplitResult {
  scriptTitle: string
  scenes: Scene[]
  totalDurationSec: number
  ratio: '16:9' | '9:16'
  generatedAt: string
}

function extractJson(text: string): any | null {
  if (!text) return null
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
  if (s >= 0 && e > s) try { return JSON.parse(cleaned.slice(s, e + 1)) } catch { /* fall through */ }
  return null
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function clampWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]
  let partial = ''
  for (const sent of sentences) {
    const cand = (partial + ' ' + sent).trim()
    if (cand.split(/\s+/).filter(Boolean).length <= maxWords) partial = cand
    else break
  }
  return partial.trim() || words.slice(0, maxWords).join(' ')
}

export async function splitScriptIntoScenes(
  scriptTitle: string,
  scriptText: string,
  ratio: '16:9' | '9:16' = '16:9',
): Promise<SplitResult> {
  const maxSecs = ratio === '16:9' ? 8 : 6
  const maxWords = ratio === '16:9' ? 22 : 14

  const systemPrompt = `You are a YouTube video director.
Split the script into scenes. CRITICAL RULES:
- Long video (16:9): each scene max 8 seconds of narration (~18-22 words)
- Short (9:16): each scene max 6 seconds (~12-14 words)
- If a scene's narration is too long, SPLIT IT across multiple scenes — never cram
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

  const content = await generateText(systemPrompt, `${scriptTitle}\n\n${scriptText.slice(0, 8000)}`, {
    temperature: 0.3,
    maxTokens: 4000,
  })

  const parsed = extractJson(content?.content || '')
  if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error(`Failed to parse scene JSON. Raw: ${(content?.content || '').slice(0, 300)}`)
  }

  const scenes: Scene[] = []
  let elapsed = 0

  for (const raw of parsed.scenes) {
    let narration = (raw.narration || '').trim()
    const imagePrompt = (raw.imagePrompt || '').trim()
    if (!narration) continue

    if (narration.split(/\s+/).filter(Boolean).length > maxWords) {
      narration = clampWords(narration, maxWords)
    }

    const words = narration.split(/\s+/).filter(Boolean).length
    const estDur = Math.round((words / 150) * 60) // 150 wpm
    const clamped = Math.min(Math.max(estDur, 4), maxSecs)
    const tsStart = fmtTime(elapsed)
    elapsed += clamped
    const tsEnd = fmtTime(elapsed)

    scenes.push({
      index: scenes.length,
      narration,
      imagePrompt,
      timestampStart: tsStart,
      timestampEnd: tsEnd,
      wordCount: words,
      estimatedDurationSec: clamped,
    })
  }

  return {
    scriptTitle,
    scenes,
    totalDurationSec: elapsed,
    ratio,
    generatedAt: new Date().toISOString(),
  }
}

export function saveScenes(result: SplitResult, outDir: string): string {
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, 'scenes.json')
  writeFileSync(path, JSON.stringify(result, null, 2))
  return path
}

// CLI usage: npx tsx lib/scene-splitter.ts <script.md> [16:9|9:16]
const _scriptFile = process.argv[2]
const _ratio = (process.argv[3] || '16:9') as '16:9' | '9:16'

if (_scriptFile) {
  if (!existsSync(_scriptFile)) {
    console.error(`Not found: ${_scriptFile}`)
    process.exit(1)
  }
  const content = readFileSync(_scriptFile, 'utf-8')
  const titleMatch = content.match(/^#\s+(.+)/m)
  const title = titleMatch ? titleMatch[1].trim() : _scriptFile

  // Strip markdown noise
  const body = content
    .replace(/^#.*$/gm, '')
    .replace(/\*\*.*?\*\*/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\[SPEAK\].*?\[\/SPEAK\]/gis, '')
    .replace(/\[TEXT ON SCREEN\].*?\[\/TEXT ON SCREEN\]/gis, '')
    .replace(/^.*?(?:HOOK|SCRIPT BODY|SOLUTION|CTA).*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  splitScriptIntoScenes(title, body, _ratio)
    .then(result => {
      const outDir = join(process.cwd(), 'sessions', 'tmp', String(Date.now()))
      const saved = saveScenes(result, outDir)
      console.log(`[scene-splitter] ${result.scenes.length} scenes → ${saved}`)
      console.log(`[scene-splitter] Total: ~${result.totalDurationSec}s (${_ratio})`)
      console.log(JSON.stringify(result, null, 2))
    })
    .catch(e => { console.error(e.message); process.exit(1) })
}
