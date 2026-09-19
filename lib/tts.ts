/**
 * Azure Cognitive Services TTS — adapted from ytautomation.
 * Uses en-US-JennyNeural by default. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.
 */
import 'dotenv/config'

const AZURE_KEY = process.env.AZURE_SPEECH_KEY || process.env.AZURE_SPEECH_SUBSCRIPTION_KEY || ''
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'centralindia'
const VOICE = process.env.AZURE_VOICE_NAME || 'en-US-JennyNeural'
const OUTPUT_FORMAT = 'audio-16khz-128kbitrate-mono-mp3'

function ssml(text: string, voice = VOICE, rate = '1.0'): string {
  const t = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  return `<speak version="1.0" xml:lang="en-US"><voice name="${voice}"><prosody rate="${rate}" pitch="+0%">${t}</prosody></voice></speak>`
}

export async function generateNarration(
  text: string,
  outputPath: string,
  voice = VOICE,
): Promise<string> {
  if (!AZURE_KEY) throw new Error('AZURE_SPEECH_KEY not set in .env')
  if (!text.trim()) throw new Error('Empty narration text')

  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
    },
    body: ssml(text, voice),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Azure TTS HTTP ${res.status}: ${err}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const finalPath = outputPath.endsWith('.mp3') ? outputPath : outputPath + '.mp3'
  const { writeFileSync, mkdirSync } = await import('node:fs')
  const { dirname } = await import('node:path')
  mkdirSync(dirname(finalPath), { recursive: true })
  writeFileSync(finalPath, buf)
  return finalPath
}

export function azureVoiceList(): string[] {
  return [
    'en-US-JennyNeural',      // default, friendly
    'en-US-GuyNeural',        // male, authoritative
    'en-US-SaraNeural',       // female, calm
    'en-US-BrandonNeural',    // male, deep
    'en-GB-RyanNeural',      // British male
    'en-AU-NatashaNeural',   // Australian female
  ]
}
