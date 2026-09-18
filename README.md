# AI Viral Reel Script Toolkit

A multi-agent system that autonomously builds high-retention Instagram Reel scripts — with human verification after every phase.

## Architecture

```
You (chat) → Orchestrator → Phase 1 Agent → [YOU VERIFY] → Phase 2 Agent → [YOU VERIFY] → ... → Final Output
```

Five specialized sub-agents, each handling one phase. One orchestrator that coordinates and manages the memory state between phases.

## Phase Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| 1 | `phase1-audience-research` | Web research: 10 problems, frustrations, desires, questions, mistakes, objections, emotional drivers, exact language |
| 2 | `phase2-content-strategy` | Identify best content angle, belief shift, emotional hook |
| 3 | `phase3-hook-generator` | 5 text hooks + 5 verbal hooks, pick strongest pair |
| 4 | `phase4-script-writer` | Full Hook→Value→Solution→CTA script, retention optimized |
| 5 | `phase5-cta-polish` | 5 CTA options, final recommendation, on-screen text |

## Directory Structure

```
reel-agent-toolkit/
├── orchestrator/                  # Main entry skill
│   └── SKILL.md
├── phase-agents/
│   ├── phase1-audience-research/
│   ├── phase2-content-strategy/
│   ├── phase3-hook-generator/
│   ├── phase4-script-writer/
│   └── phase5-cta-polish/
├── memory-templates/
│   └── niche-memory.json           # Template per-niche memory
├── examples/
│   └── niche-historical-documentaries/
├── scripts/
│   ├── init-niche.sh               # Clone toolkit for a new niche
│   └── run-pipeline.sh             # Launch pipeline for a niche
└── tests/
```

## Cloning for a New Niche

```bash
./scripts/init-niche.sh <niche-name>
```

This creates `~/.hermes/reel-agent/niches/<niche-slug>/memory.json` from the template, ready for Phase 1.

## Current Niche Memory Location

All niche data lives at:
```
~/.hermes/reel-agent/niches/<niche-slug>/memory.json
```

## Stack

- **Orchestration:** Hermes Agent
- **Sub-agents:** spawned via `delegate_task`
- **LLM:** Groq (primary), Minimax (fallback)
- **Memory:** JSON files per niche

## Status

- [x] Repo scaffold
- [ ] Phase 1 agent validated
- [ ] Phase 2 agent validated
- [ ] Phase 3 agent validated
- [ ] Phase 4 agent validated
- [ ] Phase 5 agent validated
- [ ] Orchestrator validated
- [ ] init-niche.sh script
- [ ] Telegram integration (Phase 2)
