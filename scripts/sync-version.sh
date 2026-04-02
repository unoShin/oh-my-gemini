#!/usr/bin/env bash
# sync-version.sh — called by npm "version" lifecycle hook
# Syncs the version from package.json to all satellite files:
#   - .gemini-plugin/plugin.json
#   - .gemini-plugin/marketplace.json
#   - docs/GEMINI.md (OMG:VERSION marker)
#
# Usage: automatically invoked by `npm version <bump>`
#        or manually: ./scripts/sync-version.sh [version]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"

echo "🔄 Syncing version $VERSION to satellite files..."

# 1. .gemini-plugin/plugin.json
PLUGIN="$ROOT/.gemini-plugin/plugin.json"
if [ -f "$PLUGIN" ]; then
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$PLUGIN"
  echo "  ✓ plugin.json → $VERSION"
fi

# 2. .gemini-plugin/marketplace.json (has 2 version fields)
MARKET="$ROOT/.gemini-plugin/marketplace.json"
if [ -f "$MARKET" ]; then
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/g" "$MARKET"
  echo "  ✓ marketplace.json → $VERSION"
fi

# 3. docs/GEMINI.md version marker
GEMINI_MD="$ROOT/docs/GEMINI.md"
if [ -f "$GEMINI_MD" ]; then
  sed -i "s/<!-- OMG:VERSION:[^ ]* -->/<!-- OMG:VERSION:$VERSION -->/" "$GEMINI_MD"
  echo "  ✓ docs/GEMINI.md → $VERSION"
fi

# Stage the changed files so they're included in the version commit
git add "$PLUGIN" "$MARKET" "$GEMINI_MD" 2>/dev/null || true

echo "✅ Version sync complete: $VERSION"
