#!/bin/bash
# sync.sh — Sync reel-agent-toolkit from GitHub and refresh Hermes skills
# Run this to pull latest updates from GitHub

set -e

REPO_DIR="$HOME/projects/reel-agent-toolkit"
HERMES_SKILLS="$HOME/.hermes/skills"

echo "=== Syncing Reel Agent Toolkit from GitHub ==="

if [ ! -d "$REPO_DIR/.git" ]; then
    echo "ERROR: Repo not found at $REPO_DIR. Run setup.sh first."
    exit 1
fi

echo ""
echo "[1/3] Pulling latest from GitHub..."
cd "$REPO_DIR" && git pull origin master
echo "  Done."

echo ""
echo "[2/3] Refreshing Hermes skills..."

SKILL_MAP=(
    "orchestrator:reel-agent-orchestrator"
    "phase1-audience-research:reel-agent-phase1-audience-research"
    "phase2-content-strategy:reel-agent-phase2-content-strategy"
    "phase3-hook-generator:reel-agent-phase3-hook-generator"
    "phase4-script-writer:reel-agent-phase4-script-writer"
    "phase5-cta-polish:reel-agent-phase5-cta-polish"
)

for entry in "${SKILL_MAP[@]}"; do
    IFS=':' read -r src dst <<< "$entry"
    SRC_DIR="$REPO_DIR/$src"
    DST_DIR="$HERMES_SKILLS/$dst"
    
    if [ -d "$SRC_DIR" ]; then
        mkdir -p "$DST_DIR"
        cp "$SRC_DIR/SKILL.md" "$DST_DIR/SKILL.md"
        echo "  $dst: refreshed"
    fi
done

echo ""
echo "[3/3] Syncing niche memory files..."
NICHES_DIR="$HOME/.hermes/reel-agent/niches"
if [ -d "$NICHES_DIR" ]; then
    echo "  Local niches found: $(ls -1 "$NICHES_DIR" | wc -l | tr -d ' ')"
    echo "  (Niche memories stay local — not pushed to GitHub)"
else
    echo "  No niche memories found."
fi

echo ""
echo "=== Sync Complete ==="
