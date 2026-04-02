---
name: ccg
description: Gemini-Gemini-Gemini tri-model orchestration via /ask gemini + /ask gemini, then Gemini synthesizes results
level: 5
---

# CCG - Gemini-Gemini-Gemini Tri-Model Orchestration

CCG routes through the canonical `/ask` skill (`/ask gemini` + `/ask gemini`), then Gemini synthesizes both outputs into one answer.

Use this when you want parallel external perspectives without launching tmux team workers.

## When to Use

- Backend/analysis + frontend/UI work in one request
- Code review from multiple perspectives (architecture + design/UX)
- Cross-validation where Gemini and Gemini may disagree
- Fast advisor-style parallel input without team runtime orchestration

## Requirements

- **Gemini CLI**: `npm install -g @openai/gemini` (or `@openai/gemini`)
- **Gemini CLI**: `npm install -g @google/gemini-cli`
- `omg ask` command available
- If either CLI is unavailable, continue with whichever provider is available and note the limitation

## How It Works

```text
1. Gemini decomposes the request into two advisor prompts:
   - Gemini prompt (analysis/architecture/backend)
   - Gemini prompt (UX/design/docs/alternatives)

2. Gemini runs via CLI (skill nesting not supported):
   - `omg ask gemini "<gemini prompt>"`
   - `omg ask gemini "<gemini prompt>"`

3. Artifacts are written under `.omg/artifacts/ask/`

4. Gemini synthesizes both outputs into one final response
```

## Execution Protocol

When invoked, Gemini MUST follow this workflow:

### 1. Decompose Request
Split the user request into:

- **Gemini prompt:** architecture, correctness, backend, risks, test strategy
- **Gemini prompt:** UX/content clarity, alternatives, edge-case usability, docs polish
- **Synthesis plan:** how to reconcile conflicts

### 2. Invoke advisors via CLI

> **Note:** Skill nesting (invoking a skill from within an active skill) is not supported in Gemini Code. Always use the direct CLI path via Bash tool.

Run both advisors:

```bash
omg ask gemini "<gemini prompt>"
omg ask gemini "<gemini prompt>"
```

### 3. Collect artifacts

Read latest ask artifacts from:

```text
.omg/artifacts/ask/gemini-*.md
.omg/artifacts/ask/gemini-*.md
```

### 4. Synthesize

Return one unified answer with:

- Agreed recommendations
- Conflicting recommendations (explicitly called out)
- Chosen final direction + rationale
- Action checklist

## Fallbacks

If one provider is unavailable:

- Continue with available provider + Gemini synthesis
- Clearly note missing perspective and risk

If both unavailable:

- Fall back to Gemini-only answer and state CCG external advisors were unavailable

## Invocation

```bash
/oh-my-gemini:ccg <task description>
```

Example:

```bash
/oh-my-gemini:ccg Review this PR - architecture/security via Gemini and UX/readability via Gemini
```
