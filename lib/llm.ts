/**
 * Unified LLM wrapper for reel-agent-toolkit.
 * Loads .env from project root, tries Groq → Kira → Omniroute.
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const KIRA_BASE = 'https://kiraai.vn/api/v1'
const OMNIROUTE_BASE = 'http://localhost:20128/v1'

const DEFAULT_GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'groq/compound-mini',
  'allam-2-7b',
]
const DEFAULT_KIRA_MODELS = ['kira-mini-1.0']
const DEFAULT_OMNIROUTE_MODELS = ['auto/best-free', 'auto/llama', 'auto/auto']

interface GenResult {
  content: string
  provider: string
  model: string
  latencyMs: number
}

function parseList(env: string, defaults: string[]): string[] {
  if (!env) return defaults
  return env.split(',').map(s => s.trim()).filter(Boolean)
}

function getEnv(key: string, fallback = ''): string {
  // Node env already loaded via require('node:process')
  const val = process.env[key]
  return val !== undefined ? val : fallback
}

async function tryProvider(
  base: string, key: string, model: string,
  system: string, user: string,
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number },
  logTag: string,
): Promise<GenResult | null> {
  const { temperature = 0.9, maxTokens = 2000, timeoutMs = 30_000 } = opts
  if (!key) return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const t0 = Date.now()

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: ctrl.signal,
    })

    const ms = Date.now() - t0
    if (!res.ok) {
      console.error(`[${logTag}] HTTP ${res.status} time=${ms}ms`)
      return null
    }

    const data = await res.json() as any
    const content = data.choices?.[0]?.message?.content || ''
    if (!content) {
      console.error(`[${logTag}] empty content`)
      return null
    }

    console.log(`[${logTag}] ${model} OK ${ms}ms`)
    return { content, provider: logTag, model, latencyMs: ms }
  } catch (e: any) {
    console.error(`[${logTag}] ${model} EXCEPTION: ${e.message?.slice(0, 100)}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Generate text via Groq → Kira → Omniroute.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; model?: string } = {},
): Promise<GenResult | null> {
  // Load .env from project root if not already loaded
  if (!process.env.GROQ_API_KEY) {
    const envPath = `${process.cwd()}/.env`
    try {
      const content = await import('node:fs').then(fs => fs.readFileSync(envPath, 'utf-8'))
      for (const line of content.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq < 0) continue
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim()
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch { /* no .env */ }
  }

  const groqKey = getEnv('GROQ_API_KEY')
  const kiraKey = getEnv('KIRA_API_KEY')
  const omnirouteKey = getEnv('OMNIROUTE_API_KEY')
  const groqModels = parseList(getEnv('GROQ_MODELS', ''), DEFAULT_GROQ_MODELS)
  const kiraModels = parseList(getEnv('KIRA_MODELS', ''), DEFAULT_KIRA_MODELS)
  const omnirouteModels = parseList(getEnv('OMNIROUTE_MODELS', ''), DEFAULT_OMNIROUTE_MODELS)

  // Groq primary
  if (groqKey) {
    const models = opts.model ? [opts.model] : groqModels
    for (const model of models) {
      const r = await tryProvider(GROQ_BASE, groqKey, model, systemPrompt, userPrompt, opts, 'groq')
      if (r) return r
    }
  }

  // Kira fallback
  if (kiraKey) {
    for (const model of kiraModels) {
      const r = await tryProvider(KIRA_BASE, kiraKey, model, systemPrompt, userPrompt, opts, 'kira')
      if (r) return r
    }
  }

  // Omniroute last resort
  if (omnirouteKey) {
    for (const model of omnirouteModels) {
      const r = await tryProvider(OMNIROUTE_BASE, omnirouteKey, model, systemPrompt, userPrompt, opts, 'omniroute')
      if (r) return r
    }
  }

  console.error('[generateText] All providers failed')
  return null
}
