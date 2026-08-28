---
name: pi-coding-agent-evaluation
description: Pi Coding Agent evaluated 2026-08-28 via technical-research-agent; decision was not to integrate
metadata:
  type: project
---

Evaluated `@earendil-works/pi-coding-agent` (v0.84.3, MIT, ~98.5k GitHub stars) for integration into this framework on 2026-08-28. Decision: **do not integrate**. User accepted the research agent's recommendation without running the optional bounded local trial.

**Why:** Pi is a terminal AI coding-agent harness — a peer to Claude Code, not a library, plugin, or SDK this framework consumes. Held to the same standard `CLAUDE.md`'s "LLM Council" section sets for external AI tooling ([[llm-council]] precedent: verified live endpoints with dates, explicit consent gates, bounded egress via `scrub.mjs`, jurisdiction disclosure, never wired into CI), Pi fails it: per its own docs it has no built-in permission system, no sandbox (by design), and no approval prompt before `bash`/`write`/`edit` execute. Capability overlap with the existing Claude Code + `CLAUDE.md` + 14 `.claude/agents/` + 22 `.claude/skills/` setup is near-total, and that existing setup actually has a permission system Pi lacks. Repo impact of integrating would have been zero files touched (no fixture/helper/config/workflow references it) — "integrating" it would only mean running a second unsandboxed assistant on the machine, which was judged not worth the exfiltration/prompt-injection/context-corpus-drift risk for no net new capability.

**How to apply:** If Pi (or a similar terminal coding-agent harness) comes up again, don't re-run the full research from scratch — check whether Pi has since shipped a real permission/sandbox system, or whether a concrete scripted use case has emerged that `scripts/council/dispatch.mjs` can't already cover. Absent either, the prior conclusion still holds. Watch for two real name collisions if anyone searches for "pi-coding-agent": a PyPI package by an unrelated author, and a stale GitHub fork (`davidondrej/pi-agent`) — neither is the project evaluated here.
