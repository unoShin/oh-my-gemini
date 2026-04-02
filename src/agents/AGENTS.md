<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-01-28 | Updated: 2026-02-24 -->

# agents

18 specialized AI agent definitions with 3-tier model routing for optimal cost and performance.

## Purpose

This directory defines all agents available in oh-my-gemini:

- **18 base agents** with default model assignments
- **Tiered variants** (LOW/MEDIUM/HIGH) for smart routing
- Prompts loaded dynamically from `/agents/*.md` files
- Tools assigned based on agent specialization

## Key Files

| File | Description |
|------|-------------|
| `definitions.ts` | **Main registry** - `getAgentDefinitions()`, `omgSystemPrompt` |
| `architect.ts` | Architecture & debugging expert (Ultra) |
| `executor.ts` | Focused task implementation (Pro) |
| `explore.ts` | Fast codebase search (Flash) |
| `designer.ts` | UI/UX specialist (Pro) |
| `document-specialist.ts` | Documentation & reference lookup (Pro) |
| `writer.ts` | Technical documentation (Flash) |
| `vision.ts` | Visual/image analysis (Pro) |
| `critic.ts` | Critical plan review (Ultra) |
| `analyst.ts` | Pre-planning analysis (Ultra) |
| `planner.ts` | Strategic planning (Ultra) |
| `qa-tester.ts` | CLI/service testing with tmux (Pro) |
| `scientist.ts` | Data analysis & hypothesis testing (Pro) |
| `index.ts` | Exports all agents and utilities |

## For AI Agents

### Working In This Directory

#### Understanding the Agent Registry

The main registry is in `definitions.ts`:

```typescript
// Get all 18 agents
const agents = getAgentDefinitions();

// Each agent has:
{
  name: 'architect',
  description: 'Architecture & Debugging Advisor',
  prompt: '...',  // Loaded from /agents/architect.md
  tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
  model: 'ultra',
  defaultModel: 'ultra'
}
```

#### Agent Selection Guide

| Task Type | Best Agent | Model | Tools |
|-----------|------------|-------|-------|
| Complex debugging | `architect` | ultra | Read, Glob, Grep, WebSearch, WebFetch |
| Quick code lookup | `architect-low` | flash | Read, Glob, Grep |
| Standard analysis | `architect-medium` | pro | Read, Glob, Grep, WebSearch, WebFetch |
| Feature implementation | `executor` | pro | Read, Glob, Grep, Edit, Write, Bash, TodoWrite |
| Simple fixes | `executor-low` | flash | Read, Glob, Grep, Edit, Write, Bash, TodoWrite |
| Complex refactoring | `executor-high` | ultra | Read, Glob, Grep, Edit, Write, Bash, TodoWrite |
| Fast file search | `explore` | flash | Read, Glob, Grep |
| Architectural discovery | `explore-high` | ultra | Read, Glob, Grep |
| UI components | `designer` | pro | Read, Glob, Grep, Edit, Write, Bash |
| Simple styling | `designer-low` | flash | Read, Glob, Grep, Edit, Write, Bash |
| Design systems | `designer-high` | ultra | Read, Glob, Grep, Edit, Write, Bash |
| API documentation | `document-specialist` | pro | Read, Glob, Grep, WebSearch, WebFetch |
| README/docs | `writer` | flash | Read, Glob, Grep, Edit, Write |
| Image analysis | `vision` | pro | Read, Glob, Grep |
| Plan review | `critic` | ultra | Read, Glob, Grep |
| Requirements analysis | `analyst` | ultra | Read, Glob, Grep, WebSearch |
| Strategic planning | `planner` | ultra | Read, Glob, Grep, WebSearch |
| CLI testing | `qa-tester` | pro | Bash, Read, Grep, Glob, TodoWrite |
| Data analysis | `scientist` | pro | Read, Glob, Grep, Bash, python_repl |
| ML/hypothesis | `scientist-high` | ultra | Read, Glob, Grep, Bash, python_repl |
| Security audit | `security-reviewer` | ultra | Read, Grep, Glob, Bash |
| Quick security scan | `security-reviewer-low` | flash | Read, Grep, Glob, Bash |
| Build errors | `debugger` | pro | Read, Grep, Glob, Edit, Write, Bash |
| TDD workflow | `test-engineer` | pro | Read, Grep, Glob, Edit, Write, Bash |
| Test suggestions | `test-engineer` (model=flash) | flash | Read, Grep, Glob, Bash |
| Code review | `code-reviewer` | ultra | Read, Grep, Glob, Bash |

#### Creating a New Agent

1. **Create agent file** (e.g., `new-agent.ts`):
```typescript
import type { AgentConfig } from '../shared/types.js';

export const newAgent: AgentConfig = {
  name: 'new-agent',
  description: 'What this agent does',
  prompt: '', // Will be loaded from /agents/new-agent.md
  tools: ['Read', 'Glob', 'Grep'],
  model: 'pro',
  defaultModel: 'pro'
};
```

2. **Create prompt template** at `/agents/new-agent.md`:
```markdown
---
name: new-agent
description: What this agent does
model: pro
tools: [Read, Glob, Grep]
---

# Agent Instructions

You are a specialized agent for...
```

3. **Add to definitions.ts**:
```typescript
import { newAgent } from './new-agent.js';

export function getAgentDefinitions() {
  return {
    // ... existing agents
    'new-agent': newAgent,
  };
}
```

4. **Export from index.ts**:
```typescript
export { newAgent } from './new-agent.js';
```

#### Creating Tiered Variants

For model routing, create LOW/MEDIUM/HIGH variants in `definitions.ts`:

```typescript
// Flash variant for simple tasks
export const newAgentLow: AgentConfig = {
  name: 'new-agent-low',
  description: 'Quick new-agent tasks (Flash)',
  prompt: loadAgentPrompt('new-agent-low'),
  tools: ['Read', 'Glob', 'Grep'],
  model: 'flash',
  defaultModel: 'flash'
};

// Ultra variant for complex tasks
export const newAgentHigh: AgentConfig = {
  name: 'new-agent-high',
  description: 'Complex new-agent tasks (Ultra)',
  prompt: loadAgentPrompt('new-agent-high'),
  tools: ['Read', 'Glob', 'Grep', 'WebSearch'],
  model: 'ultra',
  defaultModel: 'ultra'
};
```

### Modification Checklist

#### When Adding a New Agent

1. Create agent file (`src/agents/new-agent.ts`)
2. Create prompt template (`agents/new-agent.md`)
3. Add to `definitions.ts` (import + registry)
4. Export from `index.ts`
5. Update `docs/REFERENCE.md` (Agents section, count)
6. Update `docs/GEMINI.md` (Agent Selection Guide)
7. Update root `/AGENTS.md` (Agent Summary if applicable)

#### When Modifying an Agent

1. Update agent file (`src/agents/*.ts`) if changing tools/model
2. Update prompt template (`agents/*.md`) if changing behavior
3. Update tiered variants (`-low`, `-medium`, `-high`) if applicable
4. Update `docs/REFERENCE.md` if changing agent description/capabilities
5. Update `docs/GEMINI.md` (Agent Tool Matrix) if changing tool assignments

#### When Removing an Agent

1. Remove agent file from `src/agents/`
2. Remove prompt template from `agents/`
3. Remove from `definitions.ts` and `index.ts`
4. Update agent counts in all documentation
5. Check for skill/hook references to the removed agent

### Testing Requirements

Agents are tested via integration tests:

```bash
npm test -- --grep "agent"
```

### Common Patterns

**Prompt loading:**
```typescript
function loadAgentPrompt(agentName: string): string {
  const agentPath = join(getPackageDir(), 'agents', `${agentName}.md`);
  const content = readFileSync(agentPath, 'utf-8');
  // Strip YAML frontmatter
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}
```

**Tool assignment patterns:**
- Read-only agents: `['Read', 'Glob', 'Grep']`
- Analysis agents: Add `['WebSearch', 'WebFetch']`
- Execution agents: Add `['Edit', 'Write', 'Bash', 'TodoWrite']`
- Data agents: Add `['python_repl']`

## Dependencies

### Internal
- Prompts from `/agents/*.md`
- Types from `../shared/types.ts`

### External
None - pure TypeScript definitions.

## Agent Categories

| Category | Agents | Purpose |
|----------|--------|---------|
| Analysis | architect, architect-medium, architect-low | Debugging, architecture |
| Execution | executor, executor-low, executor-high | Code implementation |
| Search | explore, explore-high | Codebase exploration |
| Research | document-specialist | External documentation |
| Frontend | designer, designer-low, designer-high | UI/UX work |
| Documentation | writer | Technical writing |
| Visual | vision | Image/screenshot analysis |
| Planning | planner, analyst, critic | Strategic planning |
| Testing | qa-tester | Interactive testing |
| Security | security-reviewer, security-reviewer-low | Security audits |
| TDD | test-engineer | Test-driven development |
| Review | code-reviewer | Code quality + style + performance |
| Data | scientist, scientist-high | Data analysis |

<!-- MANUAL:
- Legacy alias wording was removed from active prompts to keep agent naming consistent with current conventions.
- Consensus planning prompts (planner/architect/critic) now enforce RALPLAN-DR structured deliberation, including `--deliberate` high-risk checks.
-->
