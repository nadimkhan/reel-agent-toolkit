---
name: reel-agent-phase9-video-renderer
description: Phase 9 video renderer — assemble scenes into MP4 via Remotion. Logo top-left (60x60, 15px margin), subtitles bottom, Bebas Neue font.
---

# Phase 9: Video Renderer

Takes `sessions/<slug>/<date>/assets/manifest.json` and renders a complete MP4 video using Remotion.

## Pipeline

**Input:** `sessions/<slug>/<date>/assets/manifest.json` (from Phase 8)

**Output:** `sessions/<slug>/<date>/output/<title>.mp4`

## Logo Configuration (One-Time Per Niche)

Update in `scripts/render-remotion.ts`:

```typescript
const LOGO_CONFIG = {
  src: join(PROJECT_ROOT, 'public/images/logos/rw_logo.png'),
  position: 'top-left' as const,  // top-left | top-right | bottom-left | bottom-right
  sizePx: 60,                     // logo size in pixels
  marginPx: 15,                    // distance from edges (min 15px)
};
```

To change logo position, size, or margin — edit those 4 values in `render-remotion.ts` before running.

## Subtitle Configuration

Subtitles are ALWAYS enabled. Style is locked to ytautomation spec:
- Font: Bebas Neue (Google Fonts, loaded in Subtitle component)
- ALL CAPS transformation applied automatically
- Background: `rgba(0, 0, 0, 0.75)`, 10px border-radius
- Position: bottom of screen (12% from bottom)
- Font size: 44px, letter-spacing 2.5px
- Text shadow for readability

To disable subtitles: set `subtitleEnabled: false` in `render-remotion.ts`.

## Hardcoded Parameters

| Parameter | Value |
|-----------|-------|
| Logo position | top-left |
| Logo size | 60x60 px |
| Logo margin | 15px from edges |
| Logo opacity | 0.92 |
| Subtitle font | Bebas Neue |
| Subtitle position | bottom |
| Subtitle bg | rgba(0,0,0,0.75) |
| Video FPS | 30 |
| Codec | h264 |
| CRF | 23 |
| Pixel format | yuv420p |

## Running the Render

```bash
cd ~/projects/reel-agent-toolkit
npx tsx scripts/render-remotion.ts <slug> <date> <title> [16:9|9:16]
```

Example:
```bash
npx tsx scripts/render-remotion.ts historical-documentaries 2026-09-19 "168_Conquistadors" 16:9
```

## Output Layout

```
sessions/<slug>/<date>/
├── assets/
│   ├── manifest.json
│   └── scene_XXX/
│       ├── image.png          ← upscaled 16:9 or 9:16
│       └── audio.mp3
└── output/
    └── 168_Conquistadors.mp4  ← final rendered video
```

## Aspect Ratio Rules (HARDCODE)

- **Long-form videos:** Always **16:9 landscape** → **1920x1080**
- **Shorts:** Always **9:16 portrait** → **1080x1920**

## Verification After Render

1. Check `sessions/<slug>/<date>/output/<title>.mp4` exists
2. Verify file size > 0
3. Check duration matches estimated total from manifest
4. Report result to user with file path
