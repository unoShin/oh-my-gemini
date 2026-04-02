# oh-my-gemini v4.9.0: Team reliability, autoresearch setup, and safety hardening

## Release Notes

Release 4.9.0 focuses on **team/runtime reliability**, **autoresearch onboarding and launch flow improvements**, and **safety hardening** across keyword/regex-sensitive paths and background process cleanup.

### Highlights

- **feat(team): harden shutdown cleanup for split-pane workers** — strengthens cleanup when pane metadata drifts and improves cmux-compatible team launches. (#1752, #1750, #1743)
- **feat(autoresearch): improve setup and launch flow** — adds guided intake, launch-from-interview artifacts, and zero-learning-curve Gemini session setup. (#1740, #1734, #1723, #1693)
- **fix(safety): harden regex- and state-sensitive paths** — filters informational keyword-detector queries, avoids risky regex behavior, and reduces stale state interactions. (#1737, #1741)
- **fix(runtime): clean up orphaned background processes** — reduces lingering bridge/MCP child processes and related runtime residue. (#1724)

### Team & Runtime Reliability

- **fix(team): ensure shutdown removes split-pane workers after metadata drift** — improves team shutdown cleanup reliability. (#1752)
- **fix(team): support team mode launches from cmux surfaces** — expands compatibility for cmux-driven flows. (#1750)
- **fix(cli): skip tmux wrapping in cmux terminals** — prevents orphaned/incorrect nested session behavior. (#1743)
- **fix(bridge): clean up orphaned bridge and MCP child processes** — hardens runtime cleanup behavior. (#1724)

### Autoresearch Improvements

- **feat(autoresearch): launch from interview artifacts** — enables smoother launch flow from planning artifacts. (#1740)
- **fix(autoresearch): port intake flow from OMX and clean up setup path** — improves guided intake reliability. (#1734)
- **feat: add zero-learning-curve autoresearch setup flow** — simplifies Gemini session setup for lightweight use. (#1723)
- **feat(autoresearch): backport autoresearch from OMX to OMG (Phase 1)** — expands the autoresearch surface. (#1693)

### Safety & Correctness

- **fix(keyword-detector): skip informational queries and clear legacy state** — reduces false activations and stale-state issues. (#1737)
- **fix: prevent skill-active-state collision between OMG and project custom skills** — improves reload/sync safety around active state handling. (#1741)
- **fix(planning): remove unnecessary global flag from module-level regex** — avoids unsafe regex statefulness in planning-related flows.
- **fix(team): pass Bedrock/Vertex model IDs to workers without normalization** — preserves provider-specific identifiers. (#1697)

### Workflow & Platform

- **feat: add mandatory deslop pass to ralph workflow** — improves cleanup discipline in execution flows. (#1736)
- **feat(docs): add Lore commit knowledge protocol to GEMINI.md template** — formalizes commit knowledge capture. (#1733)
- **feat(deepinit): add manifest-based incremental deepinit tool** — extends onboarding/setup capabilities. (#1719)
- **feat(skill): add deep-dive skill (trace -> deep-interview pipeline)** — adds a new investigation workflow. (#1681)

### Install / Update

```bash
npm install -g oh-my-gemini@4.9.0
```

Or reinstall the plugin:

```bash
gemini /install-plugin oh-my-gemini
```

**Full Changelog**: https://github.com/unoShin/oh-my-gemini/compare/v4.8.2...v4.9.0
