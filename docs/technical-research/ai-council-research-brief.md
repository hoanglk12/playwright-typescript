# Research Brief: Multi-Model AI Council for GRA Playwright Repo

## Context

- Repo: Playwright TypeScript test automation framework (GRA project) — https://github.com/hoanglk12/playwright-typescript/
- Claude Code is already used in this repo to generate/modify test files, page objects, and fixtures, and already has skills (`refine-ticket`, `ai-test-data`, `pert-est`, etc.), an `.mcp.json`, and a `.claude/` setup.
- A GRA-vault (Obsidian) knowledge base is already connected to Claude Code via MCP, curated specifically to prevent hallucination from missing project context.
- A self-hosted Nanobot agent already has a working OpenRouter connection (with OpenRouter fallback) and a DeepSeek V4 Pro proxy via ShopAIKey — the "how do I reliably call an OpenAI-compatible endpoint" problem is already solved once; reuse that config/pattern rather than re-debugging it from scratch.

## Goal

Design (not yet implement) a way to consult 2-3 other LLMs (via OpenRouter's OpenAI-compatible endpoint) as a second opinion for three distinct tasks in this repo:

1. **Code review** — reviewing a diff Claude just generated/changed.
2. **Bug fixing** — getting other models' take on a failing test / stack trace.
3. **Technical research** — comparing how different models reason about an open technical question (which may or may not be specific to this repo).

## Why not a single "pack everything, ask everything" approach

An earlier attempt modeled this on `karpathy/llm-council`: broadcast the same prompt to N models, anonymized cross-ranking, then a "chairman" model synthesizes a final answer. That's a good fit for open-ended reasoning comparison, but a poor fit once the question needs grounding in this specific codebase — the reviewing models have no access to the repo, so review quality depends entirely on whatever gets manually pasted into the prompt.

The tempting fix — pack the *entire* repo via `repomix` and attach it to every question — has its own problems:

- Token cost multiplies across every model call, for context that's often irrelevant to the specific question.
- Large models are known to lose relevant details in very large contexts ("lost in the middle"); more context is not strictly better.
- The three task types have genuinely different "relevance radius": a diff review needs the diff + its direct imports; a bug fix needs the error/stack trace + the files it touches; a lot of technical research needs no repo source at all — just the question, or at most a summary from the existing GRA-vault notes.

## Target architecture

One shared, reusable dispatcher + task-specific context assembly:

- `dispatch.ts` (or equivalent) — generic: takes `{context, question, model list}`, calls the OpenRouter chat completions endpoint (`https://openrouter.ai/api/v1/chat/completions`) in parallel for each model, returns each model's response independently. No cross-ranking step, no "chairman" synthesis step — a human (me) compares the independent responses and decides.
- Context assembly is task-specific, decided by Claude Code itself (not a separate blind script) at invocation time:
  - **Diff review**: diff + directly touched files + their direct imports + relevant conventions from `CLAUDE.md`, packed via `repomix` with a scoped `--include`.
  - **Bug fix**: the failing test's error/stack trace + the file(s) it touches + their direct imports, packed the same way but anchored on the symptom, not a diff.
  - **Technical research**: default to sending just the question. Only attach repo context if the question names a specific module/file/pattern in this repo — and even then, prefer a relevant note from the GRA-vault (already curated, higher signal-to-noise) over a raw `repomix` source dump. If the question is a general technical/architecture question with no repo-specific anchor, skip repo context entirely — this is the original llm-council use case and doesn't need it.
- Model selection: default to a cheap model (DeepSeek, already configured via the existing ShopAIKey proxy) for exploratory/low-stakes questions; reserve GPT-5 / Gemini for higher-stakes cases (pre-merge review, hard bugs) where the extra cost is justified.

## Research questions — investigate before proposing an implementation

1. Read what already exists in this repo relevant to this: `.mcp.json`, `.claude/`, `.agents/skills/`, `CLAUDE.md`, and any current llm-council-style code. Summarize what's there today.
2. Should "ask-council" be a new Claude Code skill (matching the existing `refine-ticket` / `ai-test-data` / `pert-est` pattern), a git hook, or a standalone CLI? Recommend one, with reasoning specific to a solo QA engineer's workflow.
3. For diff/bug-scoped context building: is `repomix` (https://github.com/yamadashy/repomix) the right tool given this repo's size and `tsconfig` path aliases, or would a minimal custom import-graph walker be more precise? Compare.
4. Is it better to house `dispatch.ts` inside this repo, or expose it as a capability the existing self-hosted Nanobot agent already provides (given its OpenRouter/DeepSeek config is already working)? Weigh the trade-offs — don't assume either answer.
5. Which OpenRouter-served models currently make sense for each tier (cheap/default vs. premium/high-stakes)? Check current OpenRouter docs for pricing and context-window limits — don't assume prior knowledge is current.
6. What should the review/analysis prompt template include for each of the three task types so responses stay focused and specific, rather than generic?
7. What's a simple, explicit rule Claude Code can apply to decide "does this question need repo context at all, and if so, how much" before invoking `dispatch.ts`?

## Deliverable

A short design plan — not code yet:

- What you found already in the repo relevant to this.
- Recommended integration point (skill / hook / CLI) and why.
- Recommended location for `dispatch.ts` (this repo vs. Nanobot) and why.
- Context-assembly approach for each of the three task types.
- Prompt templates for each task type.
- Model tiering recommendation (with current OpenRouter pricing/context checked, not assumed).
- An implementation checklist.

Stop after the plan. I'll review it before any code is written.
