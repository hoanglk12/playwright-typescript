---
name: prompt-hook-ignores-pasted-content
description: "user-prompt-submit.js routes on the user's own words only — <pasted_content id> blocks are stripped before document/Jira/keyword routing, because a file path inside a pasted log (memory-vault/00-index.md) fired the Referenced Document route and commanded a full qa-orchestrator pipeline"
type: feedback
tags: [memory, feedback, hooks, claude-code, routing]
last_verified: 2026-10-26
---

**Rule:** in `.claude/hooks/user-prompt-submit.js`, intent and routing detection run on `ownWords`, which is the prompt with every `<pasted_content id="X">…</pasted_content id="X">` block removed. Pasted text is material the user is showing, not their request.

**Why:** on 2026-10-25 the user pasted a hook-error log that contained `memory-vault/00-index.md`. `findPlan()` matched it, and because the file exists, the document route overrode everything else and told Claude to "Delegate to qa-orchestrator … run the full plan → build → review pipeline" on the vault index.

**Non-obvious fact this relies on:** the hook's `input.prompt` **does** contain the paste tags. Verified by length: the recall log's `promptChars: 726` matched the tagged transcript message exactly, while the untagged form would be 672.

**Scope of the split:**
- `ownWords` feeds `hasCodingIntent`, `hasExistingSpec`, both Jira regexes, and `buildRoutingSection` (which covers `findPlan` and the keyword router).
- The full `prompt` still feeds the LightRAG recall query, `isNotification`, `promptChars` in the recall log (needed for eval comparability, see [[lightrag-eval]]), and the session title.
- There is no fallback when a prompt is paste-only. It routes like a bare "yes": no hint is safer than a wrong one.
- The regex backreference on the random id means a closing tag forged inside the paste can't end the block early.

**Trade-off:** a Jira key that appears only inside a pasted ticket description no longer triggers Jira enrichment, so the key has to be typed.

**Healer keyword rule (2026-10-25):** the `playwright-test-healer` route used to match a bare `fix`, `broken`, `failing` or `debug` anywhere, and `heal` with no word boundary, so it matched "health" too. That sent requests about hooks, scripts and slides to the test healer. Those words now need a test noun (`test(s)`, `spec(s)`, `E2E-X-NNN`, `TC_NN`) within 60 characters, and `heal` is matched as a whole word. The new rule only matches a subset of the old one: replaying 135 real prompts from 33 transcripts moved 13 off the healer and added none. Adding `fails|failed` would have widened it and pulled a security-review prompt away from `qa-code-reviewer`, so they were left out on purpose.

**Document route limited to source folders (2026-10-26):** a named document only triggers the "Referenced Document → qa-orchestrator full pipeline" route if it lives in `Guideline/`, `docs/`, `documentation/`, `specs/` or `.claude/plans/` (`DOC_DIRS`, checked by `isInDocDir`, case-insensitive). The repo root is no longer probed for bare ALL_CAPS names. The fix was triggered by the user typing "…and CLAUDE.md both say…", which fired the route on CLAUDE.md. Replaying 141 real prompts: the route fired 26× before and 4× after. Every one of the 22 dropped hits was a misfire: CLAUDE.md in user prompts, teammate messages and continuation summaries, plus one vault note. Nothing legitimate was lost, because the only root docs are CLAUDE.md, README.md, TECH_DEBT_REPORT.md and test-summary.txt, while E2E_DISCOVERY_REPORT.md lives in `Guideline/`. Two further misfires that a folder rule can't catch were fixed the same day:
- **Test intent required.** The document route also needs `TEST_INTENT_RE` (`tests?|scenarios?|specs?|automate|automation|coverage|cover`) in the user's own words. Without it, the document is being edited or discussed (e.g. "/humanizer pass on Guideline/E2E_DISCOVERY_REPORT.md").
- **Automated turns aren't routed.** `<task-notification>` turns and "This session is being continued…" summaries get no routing at all (`isUserMessage`). Replaying 187 real prompts, the route went from 5 fires to 2. The 3 dropped were exactly these misfires; the 2 kept are genuine "tests from E2E_DISCOVERY_REPORT" requests.

**/error-debugger needs a test noun, and slash-command names don't route (2026-10-26):** the route matched a bare `\berror\b`. Replaying 114 real prompts, it fired 3 times and all 3 were misfires: two "git push, check error" questions about CI, and "troubleshoot … /error-debugger", where `\b` treats the hyphen in the skill's own name as a word boundary. "error" now needs a test noun within 60 characters, with the same nouns as the healer rule. A hyphenated name such as `error-handling-smoke.spec.ts` doesn't count. Playwright's own failure text (`TimeoutError`, `Test timeout of Nms exceeded`, `strict mode violation`) routes on its own. `exception`, `stack trace` and `crash` are unchanged. `routingText()` also strips `/skill-name` tokens before any keyword matching. A typed command has already been run by the harness, and a mentioned one is being discussed. The per-prompt diff showed only those 3 prompts moving, all to fallback. 16 handcrafted cases pass, where 10 failed before. `/ts-strict-mode` now skips "strict mode violation". That locator error goes to `/playwright-expert` through its `locator` keyword, which comes earlier in the rule order.
- Other routes still misfire the same way and were left alone: `\breview\b` matches the "Review this change for security vulnerabilities" command bodies, and `\bCI\b` matches inside long pasted finding lists that arrive without paste tags.
- **How to check a routing change:** dump the route for every real prompt before and after, then diff them per prompt, not just the counts. Pull prompts from the `~/.claude/projects/<project>/*.jsonl` user messages, skipping `isMeta`, command wrappers, notifications and continuation summaries. Evaluate `ROUTING_RULES` from the hook source; don't run the hook itself, which sends a real LightRAG query and writes to the recall log.

**git failures show as unknown (2026-10-26):** `git()` returns `null` on a non-zero exit or a timeout, not `''`. "Changed files" then reads `unknown (git status failed)` instead of a false `0`. Seen once at 17:02 on 2026-10-26: the hook said 0 while 24 files were modified. A rerun took about 0.1s, so the original cause, likely a slow first `git status` hitting the 5s timeout, is unconfirmed.

**Testing hooks without side effects:** copy the hook and `lightrag-recall-config.json` into a scratchpad `hooks/` folder, so `RECALL_LOG` lands in the scratchpad. Run with `node --require <stub that sets globalThis.fetch = undefined>`, and pass `cwd` as the repo root in the stdin JSON. Always include a positive control (a typed doc path must still route). Related: [[hook-commands-use-claude-project-dir]].
