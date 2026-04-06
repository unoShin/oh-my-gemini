# oh-my-gemini (OMG)

`oh-my-gemini` is a multi-agent orchestration framework for the Google Gemini ecosystem. Inspired by the developer experience of Claude Code, OMG enables high-performance swarms, persistent memory, and automated workflows right in your terminal.

---

## ⚡ Key Features

### Intelligent Model Tiers (v0.1.0 Humble Reset)
OMG provides an **Intention-based model routing** layer, decoupling your agents from static model versions. It automatically picks the best model for the task:
- **Flash (LOW)**: Fast and efficient (Search, linting, git).
- **Pro (MEDIUM)**: The reliable workhorse (Logic, tests, debugging).
- **Ultra (HIGH)**: Deep reasoning (System architecture, complex refactors).

> **💡 Model Overrides**
> You can force any model ID via environment variables:
> `export OMG_MODEL_HIGH=gemini-2.0-pro-exp`
> `export OMG_MODEL_MEDIUM=gemini-1.5-pro`
> `export OMG_MODEL_LOW=gemini-1.5-flash`

### Swarm Execution via tmux
Run multiple specialized agents in parallel with native terminal multiplexing.
```bash
omg team 2:flash "Review these exception paths"
omg team 1:ultra "Design the DB schema"
```

### Heads-Up Display (HUD)
Monitor agent status and token usage in real-time within your status bar.
```bash
/oh-my-gemini:hud setup
```

---

## 📚 Documentation
Detailed guides, tool usage, and internal architecture docs:
- [Reference Guide](docs/REFERENCE.md)
- [Migration Guide](docs/MIGRATION.md)

---

## 📝 License
MIT License.

**Inspired by:** [oh-my-claudecode](https://github.com/yeachan-heo/oh-my-claudecode), [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), [Superpowers](https://github.com/obra/superpowers).
