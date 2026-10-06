---
name: lightrag-eval
description: "How to measure LightRAG recall quality (npm run eval:lightrag: golden set, index freshness, saved runs with rescore/compare/diagnose) and real-world recall (npm run eval:lightrag:recall); 2026-09-28 baseline: 48/50 answers correct but only 54% delivered inside the 9s recall budget"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-10-06
---

## Tools (added 2026-09-28, extended 2026-10-06)

- **`npm run eval:lightrag`** (`scripts/eval-lightrag.mjs`) runs in three steps:
  1. It checks the golden set against the vault. Every fact regex must still appear in its note, and every "unanswerable" term must appear in no note. A fact that matches its own question is INVALID, because an answer that repeats the question would pass. A question whose every fact matches 30% or more of all notes is flagged WEAK.
  2. It checks the index: which vault notes are processed, missing, failed, still indexing or orphaned in LightRAG, and whether the indexed text still matches the note (STALE). The API only reports `content_length`, so the content check compares md5 of the trimmed note with `content_hash` in `.lightrag/kv_store_doc_status.json`.
  3. It asks every golden question, one at a time, with the same request the recall hook sends. Facts are checked against the first `maxInjectChars` of the answer, because that is all the hook injects.
- **`npm run eval:lightrag:offline`** (`--offline`) runs only steps 1 and 2. It makes no LightRAG calls and costs nothing.
- **Live-run flags:** `--mode`, `--timeout`, `--param key=value` (any `/query` field, such as `top_k`), `--repeat N`, `--only <regex>`, `--diagnose` and `--no-save`. A run whose settings differ from the hook config is labelled EXPERIMENT.
- **Saved runs.** Every live run is written to `.claude/.state/lightrag-eval-runs/<runId>.json` (gitignored). It holds the settings, git commit, LightRAG version, vault and golden fingerprints, and every answer. `--rescore latest` scores a saved run again with the current golden set and config, without querying, so loosening a fact pattern or trying another `--timeout` is free. `--compare prev` pairs two runs question by question and reports which questions flipped, with an exact McNemar p-value. Headline rates carry a 95% Wilson interval.
- **`--diagnose`** follows each `/query` with `/query/data` on the same text. LightRAG reuses the keywords it just extracted, so this returns the context the answer was generated from, for the cost of one embedding call. Each miss then gets a cause: `retrieval` (a fact was not in the context), `generation` (the context had it, the answer dropped it), `truncated` (the fact came after the injection cut), `declined`, `slow` or `error`.
- **Server phases.** After a live run the eval reads `lightrag.log` and splits each query into keyword LLM, embedding, retrieval and answer LLM time. This is the Option D3 join from the Phoenix tracing research. Windows with overlapping traffic are flagged and left out.
- **`npm run eval:lightrag:recall`** summarises `.claude/.state/lightrag-recall-log.jsonl`, grouped by mode and time limit, including timeouts by prompt size. `user-prompt-submit.js` appends one line per prompt with the outcome (`injected`, `timeout`, `no_info`, `unreachable`, `skipped_short_prompt`), latency and lengths. It never logs prompt text, because prompts can carry secrets.
- **One shared config file.** `.claude/hooks/lightrag-recall-config.json` holds the mode, `enable_rerank`, `timeoutMs`, `minChars`, `maxInjectChars` and `noInfoPattern`. Both the hook and the eval read it, so the eval always measures what recall actually sends.
- **Golden set:** `scripts/lightrag-eval-golden.json`. An answerable entry has `note`, `question` and `facts`. `"style": "task"` marks an instruction-style prompt, which is what the hook really receives, instead of a question. An unanswerable entry has `"note": null` and `absent` terms. `"style": "near-miss"` marks one that looks like a real vault topic, such as a ticket or test ID next to existing ones, or a storefront region that doesn't exist. Never name an absent topic in a vault note: that makes it answerable, and the offline check flags it as STALE. This note did exactly that on its first draft. `pla-api-testing.md` is skipped because it's only a deprecated pointer.
- **Task-notification turns** (prompts containing `<task-notification>`) aren't queried. They're logged as `skipped_notification` and left out of the hit rate.

## Baseline, 2026-09-28 (hybrid mode, 9000ms time limit, 54 questions)

- Expected note retrieved: 49/50. Answer contains the key facts: 48/50.
- Declined all 4 unanswerable questions.
- **Answered within the 9s time limit: 32/54 (59%).** Median 8.9s, p90 10.6s.
- **Delivered by recall, meaning right facts and in time: 27/50 (54%).**
- Footnote: one of the two fact misses (`technical_debt_phase1.md`) was a pattern that was too strict. The answer said "a grade of A", and the pattern required "grade A". The pattern was loosened, and a single recheck query passed. The measured numbers above are left as they were, so the next run can be compared honestly.
- An earlier 12-question run on 2026-09-27 delivered only 2/10, with a median of 9.8s. Latency swings with ShopAIKey load, so compare runs made close together, or repeat them.
- This baseline predates the 2026-10-06 changes (truncation-aware scoring, task-style and near-miss questions, fixed fact patterns), so new runs are not directly comparable with it.

## Findings

- **The bottleneck is speed, not knowledge.** Hybrid mode makes two AI calls per query, and that alone lands near the 9s limit.
- **Repeated queries come from LightRAG's LLM cache.** An exact repeat took about 2s instead of about 10s, and a trailing space still counted as a repeat. The eval appends a unique run of zero-width characters to each question, or a second run would look five times faster than real recall. It used to append a visible `(eval <runId>)`, which put the word "eval" into keyword extraction and the query embedding. Every run also adds entries to that cache.
- **Catch-all notes are retrieved poorly.** `feedback_preferences.md` (about 22 unrelated rules, 6.5 KB against a 3.9 KB median) was the only note not retrieved for its question. One topic per note retrieves better.
- **The eval can't catch wrong or outdated notes.** Answers faithfully repeat whatever a note says. For example, on 2026-09-27 recall repeated a note that had been saved from a misreading. Checking note correctness is a curation job.

- **2026-10-06: three notes were stale in the index, and the sync can't see why.** `sync-vault-to-lightrag.mjs` treats a note as unchanged when its length is within 2 chars of LightRAG's `content_length`. Edits that keep the length, such as a `last_verified` date, a status word or a swapped pattern, are never re-synced. `gra-search-dom-contract.md` was serving a superseded no-results check. The proper fix is comparing content hashes in the sync. Until then, delete the stale doc and run `npm run sync:vault`.
- **2026-10-06: an outage scored as perfect abstention.** The eval did not check the HTTP status, so a 500 counted as "declined" on every unanswerable question. It now stops after the first 5xx or three errors in a row. ShopAIKey returned 401 (invalid token) on 2026-10-02, which left `fixture-registry.md` failed in the index, and 403 (quota) on 2026-10-06. Once the key works, `POST /documents/reprocess_failed` retries failed docs.
- **Delivered-rate swings are mostly latency noise.** The median answer time sits right at the 9s budget, so a question flips between delivered and late on jitter alone. A few points of difference between two single runs means nothing. Use `--repeat` and `--compare`, and act only on changes McNemar calls real.

**How to apply:**
- After adding a vault note, add a golden question for it, plus a task-style prompt if the note says how to do something. The eval lists uncovered notes as `NO QUESTION`.
- To tune recall, change one setting with `--param`, `--mode` or `--timeout`, run with `--compare prev`, then confirm with a week of `eval:lightrag:recall` output. Change `lightrag-recall-config.json` only after that.

Related: [[lightrag-sync-lifecycle]], [[memory-vault-authority]]
