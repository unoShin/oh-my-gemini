---
name: setup
description: Use first for install/update routing — sends setup, doctor, or MCP requests to the correct OMG setup flow
level: 2
---

# Setup

Use `/oh-my-gemini:setup` as the unified setup/configuration entrypoint.

## Usage

```bash
/oh-my-gemini:setup                # full setup wizard
/oh-my-gemini:setup doctor         # installation diagnostics
/oh-my-gemini:setup mcp            # MCP server configuration
/oh-my-gemini:setup wizard --local # explicit wizard path
```

## Routing

Process the request by the **first argument only** so install/setup questions land on the right flow immediately:

- No argument, `wizard`, `local`, `global`, or `--force` -> route to `/oh-my-gemini:omg-setup` with the same remaining args
- `doctor` -> route to `/oh-my-gemini:omg-doctor` with everything after the `doctor` token
- `mcp` -> route to `/oh-my-gemini:mcp-setup` with everything after the `mcp` token

Examples:

```bash
/oh-my-gemini:setup --local          # => /oh-my-gemini:omg-setup --local
/oh-my-gemini:setup doctor --json    # => /oh-my-gemini:omg-doctor --json
/oh-my-gemini:setup mcp github       # => /oh-my-gemini:mcp-setup github
```

## Notes

- `/oh-my-gemini:omg-setup`, `/oh-my-gemini:omg-doctor`, and `/oh-my-gemini:mcp-setup` remain valid compatibility entrypoints.
- Prefer `/oh-my-gemini:setup` in new documentation and user guidance.

Task: {{ARGUMENTS}}
