---
name: lightrag-eval
description: "How to measure LightRAG recall quality (npm run eval:lightrag, golden set of one question per vault note) and real-world recall (npm run eval:lightrag:recall); 2026-09-28 baseline: 48/50 answers correct but only 54% delivered inside the 9s recall budget"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-09-28
---

## Tools (added 2026-09-28)

- **`npm run eval:lightrag`** (`scripts/eval-lightrag.mjs`) runs in three steps:
  1. It checks the golden set against the vault. Every fact regex must still appear in its note, and every "unanswerable" term must appear in no note.
  2. It checks coverage: which vault notes are processed, missing, failed, still indexing or orphaned in LightRAG.
  3. It asks every golden question, one at a time, with the same request the recall hook sends.

  `--offline` runs only step 1 and costs nothing. `--mode` and `--timeout` try other settings. A full run takes about 10 minutes.
- **`npm run eval:lightrag:recall`** summarises `.claude/.state/lightrag-recall-log.jsonl`, grouped by mode and time limit. `user-prompt-submit.js` appends one line per prompt with the outcome (`injected`, `timeout`, `no_info`, `unreachable`, `skipped_short_prompt`), latency and lengths. It never logs prompt text, because prompts can carry secrets.
- **One shared config file.** `.claude/hooks/lightrag-recall-config.json` holds the mode, `enable_rerank`, `timeoutMs`, `minChars` and `noInfoPattern`. Both the hook and the eval read it, so the eval always measures what recall actually sends.
- **Golden set:** `scripts/lightrag-eval-golden.json` has one question per note, plus a few on topics the vault never mentions. `pla-api-testing.md` is skipped because it's only a deprecated pointer. Never name those absent topics in a vault note: that makes them answerable, and the offline check flags it as STALE. This note did exactly that on its first draft.
- **Task-notification turns** (prompts containing `<task-notification>`) aren't queried. They're logged as `skipped_notification` and left out of the hit rate.

## Baseline, 2026-09-28 (hybrid mode, 9000ms time limit, 54 questions)

- Expected note retrieved: 49/50. Answer contains the key facts: 48/50.
- Declined all 4 unanswerable questions.
- **Answered within the 9s time limit: 32/54 (59%).** Median 8.9s, p90 10.6s.
- **Delivered by recall, meaning right facts and in time: 27/50 (54%).**
- Footnote: one of the two fact misses (`technical_debt_phase1.md`) was a pattern that was too strict. The answer said "a grade of A", and the pattern required "grade A". The pattern was loosened, and a single recheck query passed. The measured numbers above are left as they were, so the next run can be compared honestly.
- An earlier 12-question run on 2026-09-27 delivered only 2/10, with a median of 9.8s. Latency swings with ShopAIKey load, so compare runs made close together, or repeat them.

## Findings

- **The bottleneck is speed, not knowledge.** Hybrid mode makes two AI calls per query, and that alone lands near the 9s limit.
- **Repeated queries come from LightRAG's LLM cache.** An exact repeat took about 2s instead of about 10s, and a trailing space still counted as a repeat. The eval adds a unique `(eval <runId>)` suffix to each question, or a second run would look five times faster than real recall. Every run also adds entries to that cache.
- **Catch-all notes are retrieved poorly.** `feedback_preferences.md` (about 22 unrelated rules, 6.5 KB against a 3.9 KB median) was the only note not retrieved for its question. One topic per note retrieves better.
- **The eval can't catch wrong or outdated notes.** Answers faithfully repeat whatever a note says. For example, on 2026-09-27 recall repeated a note that had been saved from a misreading. Checking note correctness is a curation job.

**How to apply:**
- After adding a vault note, add a golden question for it. The eval lists uncovered notes as `NO QUESTION`.
- To tune recall, edit the config JSON, then compare both a new eval run and a week of `eval:lightrag:recall` output against the previous numbers.

Related: [[lightrag-sync-lifecycle]], [[memory-vault-authority]]
