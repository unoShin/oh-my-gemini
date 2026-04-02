# oh-my-gemini Unified Reference

This document serves as the absolute source of truth for the `oh-my-gemini` feature set for v5.0.0.

## 1. Slash Commands

Once the plugin is installed, you gain access to OMG's powerful slash commands within your Gemini Code interactions. 

| Command | Description |
|---|---|
| `/omg-setup` | The core initialization wizard. Creates the `.gemini/GEMINI.md` context files required for OMG operation. |
| `/omg-doctor` | Runs a diagnostic check on your environment (Node.js, tmux, Gemini hooks). |
| `/oh-my-gemini:hud setup` | Configures the real-time Heads-Up Display (HUD) in your statusline. |
| `/oh-my-gemini:ai-slop-cleaner` | Kicks off the anti-slop refactoring pipeline (review -> fix). |

## 2. Magic Keywords

Instead of using strict commands, OMG watches your chat prompts for **Magic Keywords** and seamlessly transitions into the right operational mode.

*   `ralph`, `don't stop`: Triggers persistence mode. The agent must verify everything before concluding its run.
*   `team`, `ulw`, `parallel`: Forces execution into a concurrent multi-agent swarm.
*   `ralplan`, `plan this`: Triggers a synchronous planning process with the Architect agent before writing code.
*   `stopomg`: Global killswitch. Hard stops any orbiting agents and running tmux splits.

## 3. Team Capabilities (via tmux)

The Team system coordinates actual shell workers by driving tmux via the background bridge.

```bash
# General Syntax
omg team N:<tier> "Your clear instruction here"

# Example
omg team 4:pro "Write unit tests for the four controller functions."
```

### Agent Tiers

The v5.0.0 architecture strips away legacy provider names in favor of intention-based routing:

1. **Flash**: Best for low-latency tasks. (Formatting, documentation, quick text extraction).
2. **Pro**: The reliable workhorse. (Implementing logic, writing tests, basic debugging).
3. **Ultra**: The architect. (System design, dependency decisions, algorithmic implementations).
