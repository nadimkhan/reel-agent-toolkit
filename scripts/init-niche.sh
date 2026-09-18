#!/bin/bash
# init-niche.sh — Clone the reel-agent-toolkit for a new niche
# Usage: ./scripts/init-niche.sh <niche-name>
#
# Example: ./scripts/init-niche.sh "fitness"

set -e

NICHE_NAME="${1:-}"
TOOLKIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_FILE="$TOOLKIT_DIR/memory-templates/niche-memory.json"
NICHES_DIR="$HOME/.hermes/reel-agent/niches"

if [ -z "$NICHE_NAME" ]; then
    echo "Usage: ./scripts/init-niche.sh <niche-name>"
    echo "Example: ./scripts/init-niche.sh fitness"
    exit 1
fi

# Compute slug
NICHE_SLUG=$(python3 -c "import sys; print(sys.argv[1].lower().replace(' ', '-').replace('/' , '-'))" "$NICHE_NAME")
NICHE_DIR="$NICHES_DIR/$NICHE_SLUG"
MEMORY_FILE="$NICHE_DIR/memory.json"

# Check if already exists
if [ -d "$NICHE_DIR" ]; then
    echo "[!] Niche '$NICHE_NAME' (slug: $NICHE_SLUG) already initialized."
    echo "    Memory file: $MEMORY_FILE"
    echo "    To re-initialize, delete the directory first:"
    echo "    rm -rf $NICHE_DIR"
    exit 1
fi

# Create directory
mkdir -p "$NICHE_DIR"

# Copy template
cp "$TEMPLATE_FILE" "$MEMORY_FILE"

# Fill in niche name and slug
python3 -c "
import json
with open('$MEMORY_FILE', 'r') as f:
    data = json.load(f)
data['niche'] = '$NICHE_NAME'
data['niche_slug'] = '$NICHE_SLUG'
data['created_at'] = __import__('datetime').datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open('$MEMORY_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"

echo "[+] Niche initialized: $NICHE_NAME"
echo "    Slug: $NICHE_SLUG"
echo "    Memory: $MEMORY_FILE"
echo ""
echo "To start the pipeline:"
echo "  hermes"
echo "  > load skill: reel-agent-orchestrator"
echo "  > new reel — niche: $NICHE_NAME"
