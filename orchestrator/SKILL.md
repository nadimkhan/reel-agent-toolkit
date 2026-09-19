---
name: reel-agent-orchestrator
description: Main entry for the AI Viral Reel Script Toolkit. Handles both pipeline mode (new niche) and daily content mode (generate videos and shorts on demand).
---

# Reel Agent Orchestrator

Multi-agent system for AI Viral Reel content. Two modes:

## Mode A: New Niche Pipeline

```
Pipeline Mode (new niche):
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

Daily Content Mode (existing niche):
Phase 6 → Phase 7 → Phase 8 → Phase 9
```

Run niche init: `npx tsx scripts/init-niche.ts <slug>`

## Mode B: Daily Content (existing niche)

```
User → Phase 6 (script) → Phase 7 (scenes) → Phase 8 (assets) → Remotion render
```

## Pipeline Phases

| Phase | Name | Output |
|-------|------|--------|
| 1 | Audience Research | `memory.json` — niche, category, platform |
| 2 | Content Strategy | `memory.json` — angles, hooks, top topics |
| 3 | (pipeline mode only) | |
| 4 | (pipeline mode only) | |
| 5 | (pipeline mode only) |
| 6 | Daily Content | `sessions/<date>/LF*.md`, `SHORT*.md` |
| 7 | Scene Generator | `sessions/<slug>/<date>/scenes.json` |
| 8 | Asset Generator | `sessions/<slug>/<date>/assets/` |

## Memory Files

Niche memories: `~/.hermes/reel-agent/niches/<slug>/memory.json`
Sessions: `sessions/<slug>/<date>/`

## Aspect Ratio Rules (HARDCODE)

- Long-form videos (10 min): **16:9 landscape** → upscale to **1920x1080**
- Shorts (30-60 sec): **9:16 portrait** → upscale to **1080x1920**

## Daily Content Workflow

1. User: "generate 2 long-form videos + 2 shorts for [niche]"
2. Orchestrator: Run Phase 6 → present topics for approval
3. User: "approve"
4. Orchestrator: Generate full scripts → save to session dir
5. User: "approve scenes"
6. Orchestrator: Run Phase 7 → split scripts into scenes → present scene table
7. User: "approve"
8. Orchestrator: Run Phase 8 → generate images + audio
9. Orchestrator: Report asset manifest → Remotion render ready

## Remotion Render

```bash
cd ~/projects/reel-agent-toolkit
npx tsx scripts/render-remotion.ts <slug> <date> <video-title>
```

## Session Directory Layout

```
sessions/<slug>/<date>/
├── memory.json                       ← niche memory snapshot
├── LF1_<title>.md                    ← Phase 6 long-form scripts
├── LF2_<title>.md
├── SHORT1_<title>.md                 ← Phase 6 short scripts
├── SHORT2_<title>.md
├── scenes.json                       ← Phase 7 scene breakdown
└── assets/                           ← Phase 8 assets
    ├── manifest.json
    ├── scene_000/
    │   ├── image.png                 ← upscaled 16:9 or 9:16
    │   └── audio.mp3                 ← Azure TTS
    └── ...
```

## Hardcoded Dependencies

- LLM: Groq (qwen3.8-27b) → Kira fallback
- Image gen: Pollinations (`flux` model) → sharp upscale to target res
- TTS: Azure Cognitive Services (`en-US-AndrewNeural`)
- Video assembly: Remotion
