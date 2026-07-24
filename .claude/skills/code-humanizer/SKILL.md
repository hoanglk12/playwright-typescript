---
name: "code-humanizer"
description: Use when reviewing or rewriting a TypeScript file in this repo to remove AI-generated-code smells — restating comments, signature-repeating JSDoc, defensive handling for impossible states, single-use abstractions, redundant naming, emoji in comments, rule-of-three comment padding, and stylistic inconsistency within a file.
---

# Code Humanizer

Reviews or rewrites a given code file to remove AI-generated-code smells — the same patterns a human reviewer would flag as "this reads like it was generated, not written."

The checklist itself is not duplicated here. It lives in one place: **`.claude/agents/qa-code-reviewer.md` §16 ("AI-Generated Code Smells")** — read that section and apply it directly to the target file.

## How to use this skill

1. Read `.claude/agents/qa-code-reviewer.md` §16 for the current checklist and severity convention.
2. Apply it to the target file only — do not expand scope to unrelated files (see CLAUDE.md §3, Surgical Changes).
3. Every finding from §16 is advisory (`[SUGGESTION]`) unless it independently trips one of Sections 1–15 in the same file, in which case treat it at that section's tier instead.
4. If asked to rewrite (not just report), keep every change minimal and traceable to a specific §16 item — do not "improve" adjacent code that isn't a smell.

For a full code review covering correctness, architecture, and security in addition to this narrower AI-smell pass, use the `qa-code-reviewer` skill/agent instead — this skill is a thin, standalone entry point for the smell checklist alone.
