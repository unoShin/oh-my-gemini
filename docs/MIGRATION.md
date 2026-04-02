# oh-my-gemini Migration Guide (v2-v4 to v5.0.0)

If you have used the older `oh-my-opencode`, `OMX`-prefixed implementations, or early pre-releases (v4.x), a few core architectural shifts occurred in v5.0.0.

## 1. Terminology Cleanup
*   **OMX to OMG**: All historical `OMX_` environment variables or runtime tags are formally shifted to `OMG_`. The codebase still respects `$OMX_ASK_ADVISOR_SCRIPT` temporarily, but you will see deprecation warnings.
*   **Swarm to Team**: The `swarm` keyword is gone. The multi-agent implementation is strictly referred to as the `Team` mode.
*   **Claude/Anthropic branding removed**: Instead of referring to Haiku, Sonnet, or Opus, the system uniformly maps agent capabilities to **Flash**, **Pro**, and **Ultra**.

## 2. Plugin Installation Flow
v5.0.0 natively integrates with the official Gemini Plugin API. The old way of curling raw `setup.sh` shell scripts is deprecated.

**Old Way:**
```bash
curl -sL https://oh-my-opencode.com/install.sh | bash
```

**New Way:**
```bash
# Handled safely via the plugin marketplace or direct path
gemini plugin add /path/to/oh-my-gemini
/omg-setup
```

## 3. Environment Variables
Your `.gemini/settings.json` and local shell profile (`.bashrc` / `.zshrc`) should be updated:

| Old Variable | New V5.0.0 Target | Required Action |
|---|---|---|
| `OMX_ASK_ADVISOR_SCRIPT` | `OMG_ASK_ADVISOR_SCRIPT` | Rename in shell profile |
| `OMX_ASK_ORIGINAL_TASK` | `OMG_ASK_ORIGINAL_TASK` | Rename in shell profile |
| `GEMINI_CODE_EXPERIMENTAL_TEAMS` | `GEMINI_CODE_EXPERIMENTAL_AGENT_TEAMS` | Update in settings.json |
