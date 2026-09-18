---
name: reel-agent-orchestrator
description: Main entry for the AI Viral Reel Script Toolkit. Handles both pipeline mode (new niche/topic) and daily content mode (generate videos and shorts on demand).
---

# Reel Agent Toolkit — Orchestrator

## Two Modes

### Mode 1: Pipeline Mode
Use when setting up a new niche or a new topic within an existing niche that needs full audience research.

**Trigger phrases:** "new niche", "new topic", "start project", "new reel", "setup niche"

### Mode 2: Daily Content Mode
Use when the user wants to generate video scripts or shorts for an already-researched niche without re-running research.

**Trigger phrases:** "generate", "create content", "make videos", "write scripts", "daily content", "video ideas", followed by a niche name

---

## Mode 1: Pipeline Mode

### Step 1: Collect Brief
Ask for:
1. Niche
2. Target Audience (one sentence)
3. Reel Topic / Idea
4. Reel Goal (followers / comments / saves / shares / leads-sales)
5. Language / Tone (Hindi / Hinglish / English / Other)

### Step 2: Initialize Memory
Memory file: `~/.hermes/reel-agent/niches/<niche-slug>/memory.json`
- If exists: load and check `research_completed`
- If not: create from template `~/.hermes/reel-agent-toolkit/memory-templates/niche-memory.json`
- Save project brief under `project_brief`
- Set `current_phase = 1`

### Step 3: Run Phases 1-5 with Verification
Sequentially, with human verification after each:

| Phase | Skill | Task |
|-------|-------|------|
| 1 | `reel-agent-phase1-audience-research` | Web research: 10 problems, frustrations, desires, questions, mistakes, objections, emotional drivers, exact language |
| 2 | `reel-agent-phase2-content-strategy` | Best content angle, belief shift, scroll-stopper, 3 angle options |
| 3 | `reel-agent-phase3-hook-generator` | 5 text hooks + 5 verbal hooks, pick strongest pair |
| 4 | `reel-agent-phase4-script-writer` | Full Hook→Value→Solution→CTA script, retention optimized |
| 5 | `reel-agent-phase5-cta-polish` | 5 CTA options, recommended CTA, on-screen text, hashtags, hook caption |

### Step 4: Save & Present Final Deliverable
After Phase 5 verification:
```
# FINAL DELIVERABLE — <Niche>

## Audience Insight
## Best Content Angle
## Best Text Hook
## Best Verbal Hook
## Final Reel Script
## Retention Improvements
## 5 CTA Options
## Final Recommended CTA
## On-Screen Text / Keywords

Saved to: ~/.hermes/reel-agent/niches/<slug>/memory.json
```

---

## Mode 2: Daily Content Mode

### Step 1: Identify Niche
Parse the user's request:
- Niche name
- Number of long-form videos
- Duration per video
- Number of shorts
- Duration per short

Example request: "generate 2 videos of 10 mins and 5 shorts of 30-60 sec for Historical Documentaries"

Extract:
- Niche: Historical Documentaries
- Long videos: 2 × 10 min
- Shorts: 5 × 30-60 sec

### Step 2: Load Niche Memory
Load `~/.hermes/reel-agent/niches/<niche-slug>/memory.json`
- Verify `research_completed = true` and `audience_profile` has data
- If no memory file exists or research not done: tell the user to run Pipeline Mode first

### Step 3: Generate Topic Ideas
Using niche memory data (audience profile, content angles, hooks, exact language):
- Generate N topic ideas for long-form videos (matching the stored content angles)
- Generate M topic ideas for shorts

Present topics for user approval.

### Step 4: On Topic Approval — Generate Full Scripts
For each approved topic:
- Write full script (Hook → Value → Solution → CTA)
- Duration: calibrated to requested length (10 min ≈ 1300-1500 words, 30-60 sec ≈ 80-130 words)
- Use stored audience language, hooks, and content angle
- Save each script to `~/.hermes/reel-agent/niches/<slug>/sessions/<session-date>/`

### Step 5: Present Output
Present all scripts in clean format with:
- Topic name
- Duration
- Full script (TTS-ready)
- CTA

### Step 6: Save Session
Save session summary to niche memory under `sessions` array.

---

## Memory File Schema

```json
{
  "niche": "string",
  "niche_slug": "string",
  "audience": "string",
  "project_brief": {
    "reel_topic": "string",
    "reel_goal": "string",
    "language_tone": "string",
    "created_at": "ISO date"
  },
  "research_completed": false,
  "audience_profile": {
    "problems": [],
    "frustrations": [],
    "desired_outcomes": [],
    "questions": [],
    "mistakes": [],
    "objections": [],
    "emotional_drivers": [],
    "exact_language": []
  },
  "strongest_reel_topic": { ... },
  "content_angle": { ... },
  "hooks": {
    "text": [],
    "verbal": [],
    "best_text_hook": "string",
    "best_verbal_hook": "string"
  },
  "script": {
    "final": "string",
    "retention_improvements": []
  },
  "cta": {
    "options": [],
    "recommended": "string",
    "hook_caption": "string",
    "on_screen_text": [],
    "hashtags": []
  },
  "current_phase": 0,
  "phases": {
    "phase1": { "status": "pending", "verified": false, "output": null },
    "phase2": { "status": "pending", "verified": false, "output": null },
    "phase3": { "status": "pending", "verified": false, "output": null },
    "phase4": { "status": "pending", "verified": false, "output": null },
    "phase5": { "status": "pending", "verified": false, "output": null }
  },
  "all_phases_complete": false,
  "sessions": [
    {
      "session_id": "string",
      "date": "ISO date",
      "long_videos": [{ "topic": "string", "duration": "string", "script": "string" }],
      "shorts": [{ "topic": "string", "duration": "string", "script": "string" }]
    }
  ],
  "created_at": "ISO date",
  "updated_at": "ISO date"
}
```

---

## Niche Memory Location

All niche data: `~/.hermes/reel-agent/niches/<niche-slug>/memory.json`
Source repo: `~/.hermes/reel-agent-toolkit/`
