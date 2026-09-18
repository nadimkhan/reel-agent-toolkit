# AI Viral Reel Script Toolkit

A multi-agent system that autonomously builds high-retention Instagram Reel scripts — with human verification after every phase. Supports both setup mode (new niches) and daily content mode (ongoing content generation).

## Two Modes

### Pipeline Mode
Full 5-phase research + verification for new niches or new topics within an existing niche. Human verifies after each phase.

### Daily Content Mode
On-demand content generation for already-researched niches. User requests topics → approves → gets full scripts ready to record.

## Architecture

```
User → Orchestrator → [Pipeline Mode: Phase 1-5 agents]
                    → [Daily Mode: Phase 6 agent]
```

## Phase Agents

| Phase | Skill | Responsibility |
|-------|-------|----------------|
| 1 | `reel-agent-phase1-audience-research` | Web research: audience profile (10 problems, frustrations, desires, etc.) |
| 2 | `reel-agent-phase2-content-strategy` | Best content angle, belief shift, scroll-stopper, 3 angle options |
| 3 | `reel-agent-phase3-hook-generator` | 5 text hooks + 5 verbal hooks, pick strongest pair |
| 4 | `reel-agent-phase4-script-writer` | Full Hook→Value→Solution→CTA script, retention optimized |
| 5 | `reel-agent-phase5-cta-polish` | 5 CTA options, recommended CTA, on-screen text, hashtags |
| 6 | `reel-agent-phase6-daily-content-generator` | On-demand topic + script generation for existing niches |

## Setup

```bash
# One-command setup (clone repo, install skills, check env vars)
./setup.sh

# Sync latest from GitHub
./scripts/sync.sh

# Initialize a new niche
./scripts/init-niche.sh <niche-name>
```

## Directory Structure

```
reel-agent-toolkit/
├── setup.sh                          # One-command setup
├── scripts/
│   ├── init-niche.sh                 # Initialize new niche
│   └── sync.sh                       # Sync from GitHub + refresh skills
├── orchestrator/                     # Main orchestrator skill (routes between modes)
├── phase-agents/
│   ├── phase1-audience-research/
│   ├── phase2-content-strategy/
│   ├── phase3-hook-generator/
│   ├── phase4-script-writer/
│   ├── phase5-cta-polish/
│   └── phase6-daily-content-generator/
├── memory-templates/
│   └── niche-memory.json             # Template per-niche memory
├── examples/
│   └── niche-historical-documentaries/
│       ├── memory.json               # Fully researched example
│       ├── script.final.md
│       ├── script.v1.md
│       └── script.retention_improvements.md
```

## How to Use

### Pipeline Mode (New Niche)

```bash
hermes
> load skill: reel-agent-orchestrator
> new niche — niche: Fitness, audience: ..., topic: ..., goal: shares, tone: English
```

Then verify after each phase. Full pipeline: Phase 1 → 2 → 3 → 4 → 5.

### Daily Content Mode (Existing Niche)

```bash
hermes
> load skill: reel-agent-orchestrator
> generate 2 videos of 10 mins and 5 shorts of 30-60 sec for Historical Documentaries
```

Agent reads existing niche memory, generates topics → you approve → full scripts delivered.

## Niche Memory Location

All niche data lives at:
```
~/.hermes/reel-agent/niches/<niche-slug>/memory.json
```

Sessions are saved at:
```
~/.hermes/reel-agent/niches/<niche-slug>/sessions/<YYYY-MM-DD>/
```

## Stack

- **Orchestration:** Hermes Agent
- **Sub-agents:** spawned via `delegate_task`
- **LLM:** Groq (primary), Minimax (fallback)
- **Memory:** JSON files per niche

## Skills Installation

Skills are installed into:
```
~/.hermes/skills/reel-agent-*/
```

Run `./setup.sh` after cloning. Run `./scripts/sync.sh` to pull updates.

## Status

- [x] Repo scaffold
- [x] Phase 1 agent validated
- [x] Phase 2 agent validated
- [x] Phase 3 agent validated
- [x] Phase 4 agent validated
- [x] Phase 5 agent validated
- [x] Phase 6 daily generator built
- [x] Orchestrator (both modes)
- [x] setup.sh
- [x] sync.sh
- [x] Historical Documentaries example
