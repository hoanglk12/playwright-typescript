---
name: Feedback & Preferences
description: Confirmed working patterns, corrections given, stylistic preferences
type: feedback
---
**Keep responses short.** User gives terse commands and expects terse execution — no narration, no step summaries, no "Here's what I did" paragraphs at the end.

**Why:** User said "implement 1,2,3" with no additional context — expected Claude to infer from prior turn and execute. This is the consistent interaction style.

**How to apply:** Lead with action, not explanation. One sentence of context max before tool calls. End-of-turn summary: one line, what changed. Nothing else.

---

**No trailing summaries after implementation.** After writing code or making changes, do not produce a "Summary of changes" section listing every file touched.

**Why:** User can read the diff. Redundant summaries add noise.

**How to apply:** Skip the bullet-point recap. If clarification is needed about what was done, one sentence is enough.

---

**`.claude/plans/` is the drop zone for spec documents.** The `user-prompt-submit.js` hook auto-routes prompts that reference files in this directory to `qa-orchestrator`. Drop acceptance criteria, user stories, or test plan docs here.

**How to apply:** When user mentions a spec or requirement document, check `.claude/plans/` first before asking for a path.
