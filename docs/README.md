# oh-my-gemini

**Multi-agent orchestration for Gemini Code. Zero learning curve.**

_Don't learn Gemini Code. Just use OMG._

oh-my-gemini is the definitive multi-agent orchestration layer for Google's Gemini CLI. It automatically delegates complex software engineering tasks to 32 specialized agents (e.g., Architect, QA Tester, Debugger) running in parallel, coordinating their work via tmux.

---

## 🚀 Quick Start (Local Installation)

Currently, `oh-my-gemini` is in pre-release for v5.0.0. To use it, install the plugin directly from your local clone.

**Requirements:**
- A Unix environment (macOS, Linux, or WSL2 on Windows)
- `tmux` installed (`sudo apt install tmux` or `brew install tmux`)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed and authenticated
- Node.js >= 20

**Step 1: Clone and Build**
```bash
git clone https://github.com/unoShin/oh-my-gemini
cd oh-my-gemini
npm install
npm run build
```

**Step 2: Install as a Gemini Plugin**
In your project directory where you use Gemini CLI, add the local extension:
```bash
gemini plugin add /path/to/your/oh-my-gemini/clone
```

**Step 3: Initialize OMG**
```bash
/omg-setup
```

**Step 4: Build something!**
```bash
team 3:executor "Refactor the authentication module and fix all TypeScript errors"
```

---

## 🔥 Key Features

### Canonical Team Mode
Run multiple Gemini agents natively in your terminal. Work is parallelized securely through `tmux` split-panes.
```bash
omg team 2:flash "Review this code for edge cases"
omg team 1:ultra "Design the database schema"
```

### Magic Keywords
Work naturally. Oh-my-gemini watches your natural language instructions and automatically activates the right workflows:
- **`ralph`**: Persistence mode. The agents won't stop until all tests pass and the task is fully verified.
- **`ulw` (ultrawork)**: Activates Maximum Parallelism.
- **`ralplan`**: consensus-based structured planning before writing a single line of code.

### Smart Model Routing
Oh-my-gemini automatically routes tasks to the most cost-effective intelligence tier:
- **Flash**: Used for fast lookups, spell-checking, and simple git workflows.
- **Pro**: Used for standard development, testing, and debugging.
- **Ultra**: Used for complex deep reasoning, architectural design, and system critique.

### HUD Statusline
Keep track of what your agents are doing in real time with the customizable HUD.
```bash
/oh-my-gemini:hud setup
```

---

## 📚 Documentation
Detailed documentation on internal tool usage and architecture is available locally.
- [Reference Guide](docs/REFERENCE.md)
- [Migration Notes](docs/MIGRATION.md)

---

## 📝 License
MIT License.

**Inspired by:** [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), [Superpowers](https://github.com/obra/superpowers), and [Ouroboros](https://github.com/Q00/ouroboros).
