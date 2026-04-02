---
name: omg-setup
description: Install or refresh oh-my-gemini for plugin, npm, and local-dev setups from the canonical setup flow
level: 2
---

# OMG Setup

This is the **only command you need to learn**. After running this, everything else is automatic.

**When this skill is invoked, immediately execute the workflow below. Do not only restate or summarize these instructions back to the user.**

Note: All `~/.gemini/...` paths in this guide respect `GEMINI_CONFIG_DIR` when that environment variable is set.

## Best-Fit Use

Choose this setup flow when the user wants to **install, refresh, or repair OMG itself**.

- Marketplace/plugin install users should land here after `/plugin install oh-my-gemini`
- npm users should land here after `npm i -g oh-my-gemini@latest`
- local-dev and worktree users should land here after updating the checked-out repo and rerunning setup

## Flag Parsing

Check for flags in the user's invocation:
- `--help` → Show Help Text (below) and stop
- `--local` → Phase 1 only (target=local), then stop
- `--global` → Phase 1 only (target=global), then stop
- `--force` → Skip Pre-Setup Check, run full setup (Phase 1 → 2 → 3 → 4)
- No flags → Run Pre-Setup Check, then full setup if needed

## Help Text

When user runs with `--help`, display this and stop:

```
OMG Setup - Configure oh-my-gemini

USAGE:
  /oh-my-gemini:omg-setup           Run initial setup wizard (or update if already configured)
  /oh-my-gemini:omg-setup --local   Configure local project (.gemini/GEMINI.md)
  /oh-my-gemini:omg-setup --global  Configure global settings (~/.gemini/GEMINI.md)
  /oh-my-gemini:omg-setup --force   Force full setup wizard even if already configured
  /oh-my-gemini:omg-setup --help    Show this help

MODES:
  Initial Setup (no flags)
    - Interactive wizard for first-time setup
    - Configures GEMINI.md (local or global)
    - Sets up HUD statusline
    - Checks for updates
    - Offers MCP server configuration
    - Configures team mode defaults (agent count, type, model)
    - If already configured, offers quick update option

  Local Configuration (--local)
    - Downloads fresh GEMINI.md to ./.gemini/
    - Backs up existing GEMINI.md to .gemini/GEMINI.md.backup.YYYY-MM-DD
    - Project-specific settings
    - Use this to update project config after OMG upgrades

  Global Configuration (--global)
    - Downloads fresh GEMINI.md to ~/.gemini/
    - Backs up existing GEMINI.md to ~/.gemini/GEMINI.md.backup.YYYY-MM-DD
    - Applies to all Gemini Code sessions
    - Cleans up legacy hooks
    - Use this to update global config after OMG upgrades

  Force Full Setup (--force)
    - Bypasses the "already configured" check
    - Runs the complete setup wizard from scratch
    - Use when you want to reconfigure preferences

EXAMPLES:
  /oh-my-gemini:omg-setup           # First time setup (or update GEMINI.md if configured)
  /oh-my-gemini:omg-setup --local   # Update this project
  /oh-my-gemini:omg-setup --global  # Update all projects
  /oh-my-gemini:omg-setup --force   # Re-run full setup wizard

For more info: https://github.com/unoShin/oh-my-gemini
```

## Pre-Setup Check: Already Configured?

**CRITICAL**: Before doing anything else, check if setup has already been completed. This prevents users from having to re-run the full setup wizard after every update.

```bash
# Check if setup was already completed
CONFIG_FILE="$HOME/.gemini/.omg-config.json"

if [ -f "$CONFIG_FILE" ]; then
  SETUP_COMPLETED=$(jq -r '.setupCompleted // empty' "$CONFIG_FILE" 2>/dev/null)
  SETUP_VERSION=$(jq -r '.setupVersion // empty' "$CONFIG_FILE" 2>/dev/null)

  if [ -n "$SETUP_COMPLETED" ] && [ "$SETUP_COMPLETED" != "null" ]; then
    echo "OMG setup was already completed on: $SETUP_COMPLETED"
    [ -n "$SETUP_VERSION" ] && echo "Setup version: $SETUP_VERSION"
    ALREADY_CONFIGURED="true"
  fi
fi
```

### If Already Configured (and no --force flag)

If `ALREADY_CONFIGURED` is true AND the user did NOT pass `--force`, `--local`, or `--global` flags:

Use AskUserQuestion to prompt:

**Question:** "OMG is already configured. What would you like to do?"

**Options:**
1. **Update GEMINI.md only** - Download latest GEMINI.md without re-running full setup
2. **Run full setup again** - Go through the complete setup wizard
3. **Cancel** - Exit without changes

**If user chooses "Update GEMINI.md only":**
- Detect if local (.gemini/GEMINI.md) or global (~/.gemini/GEMINI.md) config exists
- If local exists, run: `bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-gemini-md.sh" local`
- If only global exists, run: `bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-gemini-md.sh" global`
- Skip all other steps
- Report success and exit

**If user chooses "Run full setup again":**
- Continue with Resume Detection below

**If user chooses "Cancel":**
- Exit without any changes

### Force Flag Override

If user passes `--force` flag, skip this check and proceed directly to setup.

## Resume Detection

Before starting any phase, check for existing state:

```bash
bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-progress.sh" resume
```

If state exists (output is not "fresh"), use AskUserQuestion to prompt:

**Question:** "Found a previous setup session. Would you like to resume or start fresh?"

**Options:**
1. **Resume from step $LAST_STEP** - Continue where you left off
2. **Start fresh** - Begin from the beginning (clears saved state)

If user chooses "Start fresh":
```bash
bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-progress.sh" clear
```

## Phase Execution

### For `--local` or `--global` flags:
Read the file at `${GEMINI_PLUGIN_ROOT}/skills/omg-setup/phases/01-install-gemini-md.md` and follow its instructions.
(The phase file handles early exit for flag mode.)

### For full setup (default or --force):
Execute phases sequentially. For each phase, read the corresponding file and follow its instructions:

1. **Phase 1 - Install GEMINI.md**: Read `${GEMINI_PLUGIN_ROOT}/skills/omg-setup/phases/01-install-gemini-md.md` and follow its instructions.

2. **Phase 2 - Environment Configuration**: Read `${GEMINI_PLUGIN_ROOT}/skills/omg-setup/phases/02-configure.md` and follow its instructions. Phase 2 must delegate HUD/statusLine setup to the `hud` skill; do not generate or patch `statusLine` paths inline here.

3. **Phase 3 - Integration Setup**: Read `${GEMINI_PLUGIN_ROOT}/skills/omg-setup/phases/03-integrations.md` and follow its instructions.

4. **Phase 4 - Completion**: Read `${GEMINI_PLUGIN_ROOT}/skills/omg-setup/phases/04-welcome.md` and follow its instructions.

## Graceful Interrupt Handling

**IMPORTANT**: This setup process saves progress after each phase via `${GEMINI_PLUGIN_ROOT}/scripts/setup-progress.sh`. If interrupted (Ctrl+C or connection loss), the setup can resume from where it left off.

## Keeping Up to Date

After installing oh-my-gemini updates (via npm or plugin update):

**Automatic**: Just run `/oh-my-gemini:omg-setup` - it will detect you've already configured and offer a quick "Update GEMINI.md only" option that skips the full wizard.

**Manual options**:
- `/oh-my-gemini:omg-setup --local` to update project config only
- `/oh-my-gemini:omg-setup --global` to update global config only
- `/oh-my-gemini:omg-setup --force` to re-run the full wizard (reconfigure preferences)

This ensures you have the newest features and agent configurations without the token cost of repeating the full setup.
