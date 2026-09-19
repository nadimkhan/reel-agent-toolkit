#!/bin/bash
# setup.sh — One-command setup for the reel-agent-toolkit
# Run once on a fresh system or after cloning

set -e

REPO_URL="https://github.com/nadimkhan/reel-agent-toolkit.git"
REPO_DIR="$HOME/projects/reel-agent-toolkit"
HERMES_SKILLS="$HOME/.hermes/skills"
NICHE_DIR="$HOME/.hermes/reel-agent/niches"
YTAUTOMATION_DIR="$HOME/projects/ytautomation"

echo "=== Reel Agent Toolkit Setup ==="

# Step 1: Prerequisites
echo ""
echo "[1/7] Checking prerequisites..."

if ! command -v gh &> /dev/null; then
    echo "ERROR: gh CLI not found. Install: https://cli.github.com"
    exit 1
fi
if ! gh auth status &> /dev/null; then
    echo "ERROR: Not logged into GitHub. Run: gh auth login"
    exit 1
fi
echo "  gh CLI: OK"

# Step 2: Clone or update repo
echo ""
echo "[2/7] Cloning / updating repo..."

if [ -d "$REPO_DIR/.git" ]; then
    echo "  Repo exists, pulling latest..."
    cd "$REPO_DIR" && git pull origin master
else
    echo "  Cloning repo..."
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone "$REPO_URL" "$REPO_DIR"
fi

# Step 3: Install Node dependencies
echo ""
echo "[3/7] Installing Node dependencies..."
cd "$REPO_DIR"

# Create .env by symlinking to ytautomation's keys (same machine)
if [ -f "$YTAUTOMATION_DIR/.env" ]; then
    if [ ! -f .env ]; then
        ln -s "$YTAUTOMATION_DIR/.env" .env
        echo "  .env symlinked to ytautomation .env"
    else
        echo "  .env already exists"
    fi
else
    echo "  WARNING: ytautomation .env not found — copy .env.example and fill in keys manually"
    if [ ! -f .env.example ]; then
        cat > .env.example << 'ENVEXAMPLE'
# API Keys — copy to .env and fill in
GROQ_API_KEY=your_groq_key_here
KIRA_API_KEY=your_kira_key_here
POLLINATIONS_API_KEY=your_pollinations_key_here
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=centralindia
AZURE_VOICE_NAME=en-US-AndrewNeural
ENVEXAMPLE
        echo "  .env.example created — copy to .env and fill in keys"
    fi
fi

npm install 2>&1 | tail -3
echo "  Node deps: OK"

# Step 4: Hermes skills
echo ""
echo "[4/7] Installing skills into Hermes..."

mkdir -p "$HERMES_SKILLS"

SKILL_MAP=(
    "orchestrator:reel-agent-orchestrator"
    "phase-agents/phase1-audience-research:reel-agent-phase1-audience-research"
    "phase-agents/phase2-content-strategy:reel-agent-phase2-content-strategy"
    "phase-agents/phase3-hook-generator:reel-agent-phase3-hook-generator"
    "phase-agents/phase4-script-writer:reel-agent-phase4-script-writer"
    "phase-agents/phase5-cta-polish:reel-agent-phase5-cta-polish"
    "phase-agents/phase6-daily-content-generator:reel-agent-phase6-daily-content-generator"
    "phase-agents/phase7-scene-generator:reel-agent-phase7-scene-generator"
    "phase-agents/phase8-asset-generator:reel-agent-phase8-asset-generator"
    "phase-agents/phase9-video-renderer:reel-agent-phase9-video-renderer"
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

# Step 5: Copy supporting files from ytautomation (lib stubs already here)
echo ""
echo "[5/7] Checking library dependencies..."

# Verify lib files exist
for lib in llm pollinations upscale tts asset-generator scene-splitter; do
    if [ -f "$REPO_DIR/lib/${lib}.ts" ]; then
        echo "  lib/${lib}.ts: OK"
    else
        echo "  WARNING: lib/${lib}.ts missing"
    fi
done

# Step 5b: Copy logo from ytautomation (one-time per niche — update logo path here)
echo ""
echo "[5b] Checking logo..."
LOGO_SRC="$YTAUTOMATION_DIR/public/images/logos/rw_logo.png"
LOGO_DST="$REPO_DIR/public/images/logos/"
if [ -f "$LOGO_SRC" ]; then
    mkdir -p "$LOGO_DST"
    cp "$LOGO_SRC" "$LOGO_DST"
    echo "  Logo copied: $LOGO_DST"
else
    echo "  WARNING: Logo not found at $LOGO_SRC — copy manually if needed"
fi

# Step 6: Create session base directory
echo ""
echo "[6/8] Creating session and niche directories..."
mkdir -p "$REPO_DIR/sessions"
mkdir -p "$NICHE_DIR"
echo "  $REPO_DIR/sessions: OK"
echo "  $NICHE_DIR: OK"

# Step 7: Env var check
echo ""
echo "[7/8] Checking environment variables..."

check_env() {
    if [ -z "${!1}" ]; then
        echo "  WARNING: $1 not set"
    else
        echo "  $1: OK"
    fi
}

check_env GROQ_API_KEY
check_env POLLINATIONS_API_KEY
check_env AZURE_SPEECH_KEY

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Skills installed: 9 phases + orchestrator"
echo "Sessions: $REPO_DIR/sessions/"
echo "Niche memories: $NICHE_DIR/"
echo "Logo: $LOGO_DST"
echo ""
echo "Daily workflow:"
echo "  1. Phase 6: Generate scripts"
echo "  2. Phase 7: Split into scenes"
echo "  3. Phase 8: Generate images + audio"
echo "  4. Phase 9: Render video"
echo ""
echo "Render: npx tsx scripts/render-remotion.ts <slug> <date> <title> [16:9|9:16]"
