---
name: reel-agent-phase8-asset-generator
description: Phase 8 asset generation — generate Pollinations images + Azure TTS audio for each scene.
---

# Phase 8: Asset Generator

Takes `scenes.json` from Phase 7 and generates all images + audio for each scene.

## Pipeline

**Input:** `sessions/<slug>/<date>/scenes.json` (from Phase 7)

**Output:** `sessions/<slug>/<date>/assets/` directory with:
- `manifest.json` — full asset manifest
- `scene_XXX/image.png` — upscaled image (1920x1080 for 16:9, 1080x1920 for 9:16)
- `scene_XXX/audio.mp3` — Azure TTS narration

## Pre-Generation: Confirm Art Style, Era, and Voice

Read `sessions/<slug>/<date>/session.json` and confirm:
- `art_style` (e.g. "historical illustration")
- `era` (e.g. "1530s Inca Empire")
- `voice_shortname` (e.g. "en-US-AvaNeural")

If any are missing, ask the user before proceeding. Present available Azure voices:

```
## Available TTS Voices

Pick a voice for narration. Recommended for documentary:

1. **en-US-AndrewNeural** — Male, US, deep and authoritative (default)
2. **en-US-JennyNeural** — Female, US, warm and engaging
3. **en-GB-ThomasNeural** — Male, UK, measured and compelling
4. **en-GB-SoniaNeural** — Female, UK, refined and articulate
5. **en-IN-AartiNeural** — Female, India, clear and expressive
6. **en-IN-ArjunNeural** — Male, India, confident and clear
7. **en-AU-NatashaNeural** — Female, Australia, friendly and energetic
8. **en-AU-WilliamNeural** — Male, Australia, strong and grounded
9. **en-CA-ClaraNeural** — Female, Canada, crisp and professional
10. **en-CA-LiamNeural** — Male, Canada, steady and trustworthy

Enter voice_shortname: en-US-AndrewNeural
```

Save the chosen `voice_shortname` back to `session.json`.

## Dependencies

Installed by `setup.sh` in the reel-agent-toolkit root:
- `lib/pollinations.ts` — Pollinations image gen
- `lib/upscale.ts` — sharp Lanczos3 upscale to target resolution
- `lib/tts.ts` — Azure Cognitive Services TTS

## Hardcoded Parameters

### Image Generation
- Model: `flux` (free, best value)
- 16:9 → Pollinations renders at 1024x576 → upscale to **1920x1080**
- 9:16 → Pollinations renders at 576x1024 → upscale to **1080x1920**
- Upscale: sharp Lanczos3 + light sharpen + brightness/saturation boost
- Image saved as `scene_XXX/image.png`

### Audio Generation
- Provider: Azure Cognitive Services TTS
- Voice: loaded from `session.json` → `voice_shortname` (defaults to `en-US-AndrewNeural` if not set)
- Format: MP3, 16kHz, 128kbps
- Audio saved as `scene_XXX/audio.mp3`

### Concurrency
- Batch size: 3 concurrent image + audio calls

## Running the Script

```bash
cd ~/projects/reel-agent-toolkit
npx tsx scripts/generate-assets.ts <script-file.md> <slug> [16:9|9:16]
```

Or import the lib directly:
```typescript
import { generateAssets } from './lib/asset-generator.js'
const result = await generateAssets(slug, date, title, ratio, scenes)
```

## Session Directory Layout (Final)

```
sessions/<slug>/<date>/
├── LF1_168_Conquistadors_vs_12_Million.md    ← Phase 6
├── scenes.json                                 ← Phase 7
└── assets/                                     ← Phase 8
    ├── manifest.json                           ← asset manifest
    ├── scene_000/
    │   ├── image.png                           ← upscaled 16:9 or 9:16
    │   └── audio.mp3                          ← Azure TTS
    ├── scene_001/
    │   ├── image.png
    │   └── audio.mp3
    └── ...
```

## Verification After Running

1. Read `sessions/<slug>/<date>/assets/manifest.json`
2. Confirm `imagesGenerated == totalScenes` and `audiosGenerated == totalScenes`
3. List `assets/scene_XXX/` to verify both files exist per scene
4. Report result to user

## Aspect Ratio Rule (HARDCODE — DO NOT MISS)

- **Long-form videos:** Always **16:9 landscape** → upscale to **1920x1080**
- **Shorts:** Always **9:16 portrait** → upscale to **1080x1920**

This is a hard requirement. The agent MUST NOT generate wrong ratios.
