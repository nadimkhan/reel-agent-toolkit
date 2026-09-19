---
name: reel-agent-phase7-scene-generator
description: Phase 7 scene generation — split approved script into timed scenes with narration + image prompts.
---

# Phase 7: Scene Generator

Takes an approved script from Phase 6, splits it into timed scenes, and saves the scene breakdown.

## Pipeline

**Input:** Approved script file from `sessions/<slug>/<date>/LF*.md` or `SHORT*.md`

**Output:** `sessions/<slug>/<date>/scenes.json` — scene breakdown with narration + image prompts per scene

## Hardcoded Rules

| Type | Ratio | Max sec/scene | Max words/scene |
|------|-------|---------------|-----------------|
| Long video | 16:9 | 8 sec | 22 words |
| Short | 9:16 | 6 sec | 14 words |

**Image prompts:** cinematic, detailed, no text, no people, historical documentary aesthetic.
**Preserve** exact character/entity names — do not alter spellings.

## Steps

1. Read the approved script file
2. Read `session.json` in the same directory — extract `art_style`, `era`, and `voice_shortname`
3. Run scene splitter with era + art style:
   ```
   npx tsx lib/scene-splitter.ts <script.md> [16:9|9:16]
   ```
   (The generate-assets script passes era + art style through env or args — if using the lib directly, call `splitScriptIntoScenes(..., { era, artStyle })`)
4. Present scene table to user for verification:
   ```
   | Scene | Timestamp | Narration (first 50 chars) | Image Prompt |
   |-------|-----------|-------------------------------|--------------|
   ```
5. End with: `--- [ VERIFY SCENES ] Say "approve" to generate assets, or tell me what to adjust.`

## Output Format (scenes.json)

```json
{
  "scriptTitle": "...",
  "ratio": "16:9",
  "totalDurationSec": 480,
  "scenes": [
    {
      "index": 0,
      "narration": "168 conquistadors faced an empire of 12 million people.",
      "imagePrompt": "A small band of armored Spanish soldiers stand before the vast Inca empire...",
      "timestampStart": "0:00",
      "timestampEnd": "0:08",
      "wordCount": 10,
      "estimatedDurationSec": 8
    }
  ],
  "generatedAt": "2026-09-19T..."
}
```

## Session Directory Layout

```
sessions/<slug>/<date>/
├── LF1_168_Conquistadors_vs_12_Million.md   ← Phase 6 script
├── LF2_The_Accidents_That_Built_the_Modern_World.md
├── scenes.json                               ← Phase 7 output
└── assets/                                   ← Phase 8 output
    ├── manifest.json
    └── scene_000/
        ├── image.png
        └── audio.mp3
```

## Aspect Ratio Rule

- **Long-form videos (10 min):** ALWAYS 16:9 landscape — hardcode this
- **Shorts (30-60 sec):** ALWAYS 9:16 portrait — hardcode this

Do not ask. Do not guess. Hardcode based on the content type.
