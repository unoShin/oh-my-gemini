# Phase 1: Install GEMINI.md

## Determine Configuration Target

If `--local` flag was passed, set `CONFIG_TARGET=local`.
If `--global` flag was passed, set `CONFIG_TARGET=global`.

Otherwise (initial setup wizard), use AskUserQuestion to prompt:

**Question:** "Where should I configure oh-my-gemini?"

**Options:**
1. **Local (this project)** - Creates `.gemini/GEMINI.md` in current project directory. Best for project-specific configurations.
2. **Global (all projects)** - Creates `~/.gemini/GEMINI.md` for all Gemini Code sessions. Best for consistent behavior everywhere.

Set `CONFIG_TARGET` to `local` or `global` based on user's choice.

## Download and Install GEMINI.md

**MANDATORY**: Always run this command. Do NOT skip. Do NOT use the Write tool. Let the setup script choose the safest canonical source (bundled `docs/GEMINI.md` first, GitHub fallback only if needed).

```bash
bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-gemini-md.sh" <CONFIG_TARGET>
```

Replace `<CONFIG_TARGET>` with `local` or `global`.

The script must install the canonical `docs/GEMINI.md` content and preserve the required
`<!-- OMG:START -->` / `<!-- OMG:END -->` markers. Do **not** hand-write, summarize, or
partially reconstruct GEMINI.md.

After running the script, verify the target file contains both markers. If marker validation
fails, stop and report the failure instead of writing GEMINI.md manually.

For `local` installs inside a git repository, the script also seeds `.git/info/exclude` with an OMG block that ignores local `.omg/*` artifacts by default while preserving `.omg/skills/` for version-controlled project skills.

**FALLBACK** if curl fails:
Tell user to manually download from:
https://raw.githubusercontent.com/unoShin/oh-my-gemini/main/docs/GEMINI.md

**Note**: The downloaded GEMINI.md includes Context Persistence instructions with `<remember>` tags for surviving conversation compaction.

**Note**: If an existing GEMINI.md is found, it will be backed up before downloading the new version.

## Report Success

If `CONFIG_TARGET` is `local`:
```
OMG Project Configuration Complete
- GEMINI.md: Updated with latest configuration from GitHub at ./.gemini/GEMINI.md
- Git excludes: Added local `.omg/*` ignore rules to `.git/info/exclude` (keeps `.omg/skills/` trackable)
- Backup: Previous GEMINI.md backed up (if existed)
- Scope: PROJECT - applies only to this project
- Hooks: Provided by plugin (no manual installation needed)
- Agents: 28+ available (base + tiered variants)
- Model routing: Haiku/Sonnet/Opus based on task complexity

Note: This configuration is project-specific and won't affect other projects or global settings.
```

If `CONFIG_TARGET` is `global`:
```
OMG Global Configuration Complete
- GEMINI.md: Updated with latest configuration from GitHub at ~/.gemini/GEMINI.md
- Backup: Previous GEMINI.md backed up (if existed)
- Scope: GLOBAL - applies to all Gemini Code sessions
- Hooks: Provided by plugin (no manual installation needed)
- Agents: 28+ available (base + tiered variants)
- Model routing: Haiku/Sonnet/Opus based on task complexity

Note: Hooks are now managed by the plugin system automatically. No manual hook installation required.
```

## Save Progress

```bash
bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-progress.sh" save 2 <CONFIG_TARGET>
```

## Early Exit for Flag Mode

If `--local` or `--global` flag was used, clear state and **STOP HERE**:
```bash
bash "${GEMINI_PLUGIN_ROOT}/scripts/setup-progress.sh" clear
```
Do not continue to Phase 2 or other phases.
