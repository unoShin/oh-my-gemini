---
name: omg-teams
description: CLI-team runtime for Gemini workers in tmux panes when you need process-based parallel execution
aliases: []
level: 4
---

# OMG Teams Skill

Spawn N CLI worker processes in tmux panes to execute tasks in parallel. Supports `gemini` agent types.

`/omg-teams` is a legacy compatibility skill for the CLI-first runtime: use `omg team ...` commands (not deprecated MCP runtime tools).

## Usage

```bash
/oh-my-gemini:omg-teams N:gemini "task description"
```

### Parameters

- **N** - Number of CLI workers (1-10)
- **agent-type** - `gemini` (Google Gemini CLI)
- **task** - Task description to distribute across all workers

### Examples

```bash
/omg-teams 2:gemini "implement auth module with tests"
/omg-teams 3:gemini "redesign UI components for accessibility"
```

## Requirements

- **tmux binary** must be installed and discoverable (`command -v tmux`)
- **gemini** CLI: `npm install -g @google/gemini-cli`

## Workflow

### Phase 1: Parse + validate input

Extract:
- `N` — worker count (1–10)
- `agent-type` — `gemini`
- `task` — task description

### Phase 2: Decompose task

Break work into N independent subtasks to avoid write conflicts.

### Phase 3: Start CLI team runtime

```bash
omg team <N>:gemini "<task>"
```

## Error Reference

| Error                        | Cause                               | Fix                                                                                 |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `gemini: command not found`  | Gemini CLI not installed            | `npm install -g @google/gemini-cli`                                                 |
| `Team <name> is not running` | stale or missing runtime state      | `omg team status <team-name>` then `omg team shutdown <team-name> --force` if stale |
