#!/bin/bash
# setup.sh — One-command setup for the reel-agent-toolkit
# Run this once on a fresh system or after cloning the repo

set -e

REPO_URL="https://github.com/nadimkhan/reel-agent-toolkit.git"
REPO_DIR="$HOME/projects/reel-agent-toolkit"
HERMES_SKILLS="$HOME/.hermes/skills"
NICHE_DIR="$HOME/.hermes/reel-agent/niches"

echo "=== Reel Agent Toolkit Setup ==="

# Step 1: Check prerequisites
echo ""
echo "[1/5] Checking prerequisites..."

if ! command -v gh &> /dev/null; then
    echo "ERROR: 'gh' CLI not found. Install: https://cli.github.com"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "ERROR: Not logged into GitHub. Run: gh auth login"
    exit 1
fi
echo "  gh CLI: OK"

# Step 2: Clone or update repo
echo ""
echo "[2/5] Cloning / updating repo..."

if [ -d "$REPO_DIR/.git" ]; then
    echo "  Repo exists, pulling latest..."
    cd "$REPO_DIR" && git pull origin master
else
    echo "  Cloning repo..."
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone "$REPO_URL" "$REPO_DIR"
fi

# Step 3: Install skills into Hermes
echo ""
echo "[3/5] Installing skills into Hermes..."

mkdir -p "$HERMES_SKILLS"

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
        echo "  $dst: OK"
    else
        echo "  WARNING: $SRC_DIR not found, skipping"
    fi
done

# Step 4: Create niche memory base directory
echo ""
echo "[4/5] Creating niche memory directory..."
mkdir -p "$NICHE_DIR"
echo "  $NICHE_DIR: OK"

# Step 5: Check env vars
echo ""
echo "[5/5] Checking environment variables..."

check_env() {
    if [ -z "${!1}" ]; then
        echo "  WARNING: $1 not set"
    else
        echo "  $1: OK"
    fi
}

check_env GROQ_API_KEY
check_env MINIMAX_API_KEY

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the pipeline:"
echo "  hermes"
echo "  > load skill: reel-agent-orchestrator"
echo ""
echo "To initialize a new niche:"
echo "  ./scripts/init-niche.sh <niche-name>"
echo ""
echo "To sync from GitHub:"
echo "  ./scripts/sync.sh"
