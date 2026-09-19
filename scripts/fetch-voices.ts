/**
 * fetch-voices.ts
 *
 * Fetches all available Azure TTS voices and saves to lib/azure-voices.json
 * Run once to refresh voice list.
 *
 * Usage: npx tsx scripts/fetch-voices.ts
 */

import fs from 'node:fs';
import https from 'node:https';

const ENV_FILE = '/home/nadim/projects/reel-agent-toolkit/.env';

function loadEnv() {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      env[key.trim()] = rest.join('=').trim();
    }
  }
  return env;
}

async function fetchVoices(region: string, key: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
    const options = {
      hostname: `${region}.tts.speech.microsoft.com`,
      path: '/cognitiveservices/voices/list',
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const env = loadEnv();
  const region = env.AZURE_SPEECH_REGION || 'centralindia';
  const key = env.AZURE_SPEECH_KEY;

  if (!key) {
    console.error('[fetch-voices] ERROR: AZURE_SPEECH_KEY not found in .env');
    process.exit(1);
  }

  console.log(`[fetch-voices] Fetching voices from ${region}...`);
  const voices = await fetchVoices(region, key);
  console.log(`[fetch-voices] Total voices: ${voices.length}`);

  const outPath = '/home/nadim/projects/reel-agent-toolkit/lib/azure-voices.json';

  // Save full list
  fs.writeFileSync(outPath, JSON.stringify(voices, null, 2));
  console.log(`[fetch-voices] Saved ${voices.length} voices to ${outPath}`);

  // Create a curated subset for display (English + popular voices)
  const englishVoices = voices.filter((v: any) => v.Locale.startsWith('en-'));
  const popularVoices = englishVoices.filter((v: any) =>
    ['en-US', 'en-GB', 'en-IN', 'en-AU'].includes(v.Locale) &&
    v.VoiceType === 'Neural'
  );

  // Pick best representatives per locale/gender
  const curated: any[] = [];
  const seen = new Set<string>();
  for (const v of popularVoices) {
    const key = `${v.Locale}-${v.Gender}`;
    if (!seen.has(key) && curated.length < 24) {
      seen.add(key);
      curated.push({
        shortName: v.ShortName,
        displayName: v.DisplayName,
        gender: v.Gender,
        locale: v.Locale,
        localeName: v.LocaleName,
        voiceType: v.VoiceType,
        wordsPerMinute: v.WordsPerMinute || null,
      });
    }
  }

  const curatedPath = '/home/nadim/projects/reel-agent-toolkit/lib/azure-voices-curated.json';
  fs.writeFileSync(curatedPath, JSON.stringify(curated, null, 2));
  console.log(`[fetch-voices] Saved ${curated.length} curated English voices to ${curatedPath}`);

  // Group by locale for display
  const byLocale: Record<string, any[]> = {};
  for (const v of englishVoices) {
    if (!byLocale[v.Locale]) byLocale[v.Locale] = [];
    byLocale[v.Locale].push(v);
  }
  console.log('\nEnglish voices by locale:');
  for (const [loc, vs] of Object.entries(byLocale).sort()) {
    console.log(`  ${loc}: ${vs.length} voices`);
  }
}

main().catch(e => { console.error('[fetch-voices] FATAL:', e); process.exit(1); });
