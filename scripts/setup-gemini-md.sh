#!/usr/bin/env bash
# setup-gemini-md.sh - Unified GEMINI.md download/merge script
# Usage: setup-gemini-md.sh <local|global>
#
# Handles: version extraction, backup, download, marker stripping, merge, version reporting.
# For global mode, also cleans up legacy hooks.

set -euo pipefail

MODE="${1:?Usage: setup-gemini-md.sh <local|global>}"
DOWNLOAD_URL="https://raw.githubusercontent.com/unoShin/oh-my-gemini/main/docs/GEMINI.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Resolve active plugin root from installed_plugins.json.
# Handles stale GEMINI_PLUGIN_ROOT when a session was started before a plugin
# update (e.g. 4.8.2 session invoking setup after updating to 4.9.0).
# Same pattern as run.cjs resolveTarget() fallback.
resolve_active_plugin_root() {
  local config_dir="${GEMINI_CONFIG_DIR:-$HOME/.gemini}"
  local installed_plugins="${config_dir}/plugins/installed_plugins.json"

  if [ -f "$installed_plugins" ] && command -v jq >/dev/null 2>&1; then
    local active_path
    active_path=$(jq -r '
      (.plugins // .)
      | to_entries[]
      | select(.key | startswith("oh-my-gemini"))
      | .value[0].installPath // empty
    ' "$installed_plugins" 2>/dev/null)

    if [ -n "$active_path" ] && [ -d "$active_path" ]; then
      echo "$active_path"
      return 0
    fi
  fi

  # Fallback: scan sibling version directories for the latest (mirrors run.cjs)
  local cache_base
  cache_base="$(dirname "$SCRIPT_PLUGIN_ROOT")"
  if [ -d "$cache_base" ]; then
    local latest
    latest=$(ls -1 "$cache_base" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | sort -t. -k1,1nr -k2,2nr -k3,3nr | head -1)
    if [ -n "$latest" ] && [ -d "${cache_base}/${latest}" ]; then
      echo "${cache_base}/${latest}"
      return 0
    fi
  fi

  echo "$SCRIPT_PLUGIN_ROOT"
}

ACTIVE_PLUGIN_ROOT="$(resolve_active_plugin_root)"
CANONICAL_GEMINI_MD="${ACTIVE_PLUGIN_ROOT}/docs/GEMINI.md"
CANONICAL_OMG_REFERENCE_SKILL="${ACTIVE_PLUGIN_ROOT}/skills/omg-reference/SKILL.md"

ensure_local_omg_git_exclude() {
  local exclude_path

  if ! exclude_path=$(git rev-parse --git-path info/exclude 2>/dev/null); then
    echo "Skipped OMG git exclude setup (not a git repository)"
    return 0
  fi

  mkdir -p "$(dirname "$exclude_path")"

  local block_start="# BEGIN OMG local artifacts"

  if [ -f "$exclude_path" ] && grep -Fq "$block_start" "$exclude_path"; then
    echo "OMG git exclude already configured"
    return 0
  fi

  if [ -f "$exclude_path" ] && [ -s "$exclude_path" ]; then
    printf '\n' >> "$exclude_path"
  fi

  cat >> "$exclude_path" <<'EOF'
# BEGIN OMG local artifacts
.omg/*
!.omg/skills/
!.omg/skills/**
# END OMG local artifacts
EOF

  echo "Configured git exclude for local .omg artifacts (preserving .omg/skills/)"
}

# Determine target path
if [ "$MODE" = "local" ]; then
  mkdir -p .gemini/skills/omg-reference
  TARGET_PATH=".gemini/GEMINI.md"
  SKILL_TARGET_PATH=".gemini/skills/omg-reference/SKILL.md"
elif [ "$MODE" = "global" ]; then
  mkdir -p "$HOME/.gemini/skills/omg-reference"
  TARGET_PATH="$HOME/.gemini/GEMINI.md"
  SKILL_TARGET_PATH="$HOME/.gemini/skills/omg-reference/SKILL.md"
else
  echo "ERROR: Invalid mode '$MODE'. Use 'local' or 'global'." >&2
  exit 1
fi


install_omg_reference_skill() {
  local source_label=""
  local temp_skill
  temp_skill=$(mktemp /tmp/omg-reference-skill-XXXXXX.md)

  if [ -f "$CANONICAL_OMG_REFERENCE_SKILL" ]; then
    cp "$CANONICAL_OMG_REFERENCE_SKILL" "$temp_skill"
    source_label="$CANONICAL_OMG_REFERENCE_SKILL"
  elif [ -n "${GEMINI_PLUGIN_ROOT:-}" ] && [ -f "${GEMINI_PLUGIN_ROOT}/skills/omg-reference/SKILL.md" ]; then
    cp "${GEMINI_PLUGIN_ROOT}/skills/omg-reference/SKILL.md" "$temp_skill"
    source_label="${GEMINI_PLUGIN_ROOT}/skills/omg-reference/SKILL.md"
  else
    rm -f "$temp_skill"
    echo "Skipped omg-reference skill install (canonical skill source unavailable)"
    return 0
  fi

  if [ ! -s "$temp_skill" ]; then
    rm -f "$temp_skill"
    echo "Skipped omg-reference skill install (empty canonical skill source: $source_label)"
    return 0
  fi

  mkdir -p "$(dirname "$SKILL_TARGET_PATH")"
  cp "$temp_skill" "$SKILL_TARGET_PATH"
  rm -f "$temp_skill"
  echo "Installed omg-reference skill to $SKILL_TARGET_PATH"
}

# Extract old version before download
OLD_VERSION=$(grep -m1 'OMG:VERSION:' "$TARGET_PATH" 2>/dev/null | sed -E 's/.*OMG:VERSION:([^ ]+).*/\1/' || true)
if [ -z "$OLD_VERSION" ]; then
  OLD_VERSION=$(omg --version 2>/dev/null | head -1 || true)
fi
if [ -z "$OLD_VERSION" ]; then
  OLD_VERSION="none"
fi

# Backup existing
if [ -f "$TARGET_PATH" ]; then
  BACKUP_DATE=$(date +%Y-%m-%d_%H%M%S)
  BACKUP_PATH="${TARGET_PATH}.backup.${BACKUP_DATE}"
  cp "$TARGET_PATH" "$BACKUP_PATH"
  echo "Backed up existing GEMINI.md to $BACKUP_PATH"
fi

# Load canonical OMG content to temp file
TEMP_OMG=$(mktemp /tmp/omg-gemini-XXXXXX.md)
trap 'rm -f "$TEMP_OMG"' EXIT

SOURCE_LABEL=""
if [ -f "$CANONICAL_GEMINI_MD" ]; then
  cp "$CANONICAL_GEMINI_MD" "$TEMP_OMG"
  SOURCE_LABEL="$CANONICAL_GEMINI_MD"
elif [ -n "${GEMINI_PLUGIN_ROOT:-}" ] && [ -f "${GEMINI_PLUGIN_ROOT}/docs/GEMINI.md" ]; then
  cp "${GEMINI_PLUGIN_ROOT}/docs/GEMINI.md" "$TEMP_OMG"
  SOURCE_LABEL="${GEMINI_PLUGIN_ROOT}/docs/GEMINI.md"
else
  curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_OMG"
  SOURCE_LABEL="$DOWNLOAD_URL"
fi

if [ ! -s "$TEMP_OMG" ]; then
  echo "ERROR: Failed to download GEMINI.md. Aborting."
  echo "FALLBACK: Manually download from: $DOWNLOAD_URL"
  rm -f "$TEMP_OMG"
  exit 1
fi

if ! grep -q '<!-- OMG:START -->' "$TEMP_OMG" || ! grep -q '<!-- OMG:END -->' "$TEMP_OMG"; then
  echo "ERROR: Canonical GEMINI.md source is missing required OMG markers: $SOURCE_LABEL" >&2
  echo "Refusing to install a summarized or malformed GEMINI.md." >&2
  exit 1
fi

# Strip existing markers from downloaded content (idempotency)
# Use awk for cross-platform compatibility (GNU/BSD)
if grep -q '<!-- OMG:START -->' "$TEMP_OMG"; then
  awk '/<!-- OMG:END -->/{p=0} p; /<!-- OMG:START -->/{p=1}' "$TEMP_OMG" > "${TEMP_OMG}.clean"
  mv "${TEMP_OMG}.clean" "$TEMP_OMG"
fi

if [ ! -f "$TARGET_PATH" ]; then
  # Fresh install: wrap in markers
  {
    echo '<!-- OMG:START -->'
    cat "$TEMP_OMG"
    echo '<!-- OMG:END -->'
  } > "$TARGET_PATH"
  rm -f "$TEMP_OMG"
  echo "Installed GEMINI.md (fresh)"
else
  # Merge: preserve user content outside OMG markers
  if grep -q '<!-- OMG:START -->' "$TARGET_PATH"; then
    # Has markers: remove ALL complete OMG blocks, preserve only real user text
    # Use perl -0 for a global multiline regex replace (portable across GNU/BSD environments)
    perl -0pe 's/^<!-- OMG:START -->\R[\s\S]*?^<!-- OMG:END -->(?:\R)?//msg; s/^<!-- User customizations(?: \([^)]+\))? -->\R?//mg; s/\A(?:[ \t]*\R)+//; s/(?:\R[ \t]*)+\z//;' \
      "$TARGET_PATH" > "${TARGET_PATH}.preserved"

    if grep -Eq '^<!-- OMG:(START|END) -->$' "${TARGET_PATH}.preserved"; then
      # Corrupted/unmatched markers remain: preserve the whole original file for manual recovery
      OLD_CONTENT=$(cat "$TARGET_PATH")
      {
        echo '<!-- OMG:START -->'
        cat "$TEMP_OMG"
        echo '<!-- OMG:END -->'
        echo ""
        echo "<!-- User customizations (recovered from corrupted markers) -->"
        printf '%s\n' "$OLD_CONTENT"
      } > "${TARGET_PATH}.tmp"
    else
      PRESERVED_CONTENT=$(cat "${TARGET_PATH}.preserved")
      {
        echo '<!-- OMG:START -->'
        cat "$TEMP_OMG"
        echo '<!-- OMG:END -->'
        if printf '%s' "$PRESERVED_CONTENT" | grep -q '[^[:space:]]'; then
          echo ""
          echo "<!-- User customizations -->"
          printf '%s\n' "$PRESERVED_CONTENT"
        fi
      } > "${TARGET_PATH}.tmp"
    fi

    mv "${TARGET_PATH}.tmp" "$TARGET_PATH"
    rm -f "${TARGET_PATH}.preserved"
    echo "Updated OMG section (user customizations preserved)"
  else
    # No markers: wrap new content in markers, append old content as user section
    OLD_CONTENT=$(cat "$TARGET_PATH")
    {
      echo '<!-- OMG:START -->'
      cat "$TEMP_OMG"
      echo '<!-- OMG:END -->'
      echo ""
      echo "<!-- User customizations (migrated from previous GEMINI.md) -->"
      printf '%s\n' "$OLD_CONTENT"
    } > "${TARGET_PATH}.tmp"
    mv "${TARGET_PATH}.tmp" "$TARGET_PATH"
    echo "Migrated existing GEMINI.md (added OMG markers, preserved old content)"
  fi
  rm -f "$TEMP_OMG"
fi

if ! grep -q '<!-- OMG:START -->' "$TARGET_PATH" || ! grep -q '<!-- OMG:END -->' "$TARGET_PATH"; then
  echo "ERROR: Installed GEMINI.md is missing required OMG markers: $TARGET_PATH" >&2
  exit 1
fi

install_omg_reference_skill

if [ "$MODE" = "local" ]; then
  ensure_local_omg_git_exclude
fi

# Extract new version and report
NEW_VERSION=$(grep -m1 'OMG:VERSION:' "$TARGET_PATH" 2>/dev/null | sed -E 's/.*OMG:VERSION:([^ ]+).*/\1/' || true)
if [ -z "$NEW_VERSION" ]; then
  NEW_VERSION=$(omg --version 2>/dev/null | head -1 || true)
fi
if [ -z "$NEW_VERSION" ]; then
  NEW_VERSION="unknown"
fi
if [ "$OLD_VERSION" = "none" ]; then
  echo "Installed GEMINI.md: $NEW_VERSION"
elif [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
  echo "GEMINI.md unchanged: $NEW_VERSION"
else
  echo "Updated GEMINI.md: $OLD_VERSION -> $NEW_VERSION"
fi

# Legacy hooks cleanup (global mode only)
if [ "$MODE" = "global" ]; then
  rm -f ~/.gemini/hooks/keyword-detector.sh
  rm -f ~/.gemini/hooks/stop-continuation.sh
  rm -f ~/.gemini/hooks/persistent-mode.sh
  rm -f ~/.gemini/hooks/session-start.sh
  echo "Legacy hooks cleaned"

  # Check for manual hook entries in settings.json
  SETTINGS_FILE="$HOME/.gemini/settings.json"
  if [ -f "$SETTINGS_FILE" ]; then
    if jq -e '.hooks' "$SETTINGS_FILE" > /dev/null 2>&1; then
      echo ""
      echo "NOTE: Found legacy hooks in settings.json. These should be removed since"
      echo "the plugin now provides hooks automatically. Remove the \"hooks\" section"
      echo "from ~/.gemini/settings.json to prevent duplicate hook execution."
    fi
  fi
fi

# Verify plugin installation
grep -q "oh-my-gemini" ~/.gemini/settings.json && echo "Plugin verified" || echo "Plugin NOT found - run: gemini /install-plugin oh-my-gemini"
