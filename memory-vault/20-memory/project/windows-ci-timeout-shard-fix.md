---
name: windows-ci-timeout-shard-fix
description: "Windows UI job in playwright-with-slack.yml chronically cancelled at 45min timeout; root-caused to broken %USERPROFILE% cache path + slow Windows throughput; fixed via ~ cache path + 3-way Windows test sharding"
type: project
tags: [memory, project, ci-cd, github-actions, windows, sharding]
last_verified: 2026-07-01
---

## Problem

`ui-test` job (windows-latest leg) in `.github/workflows/playwright-with-slack.yml` was chronically hitting its 45-minute `timeout-minutes` ceiling and getting force-cancelled, while the `macos-latest` leg of the same matrix reliably finished in ~31 min. Reproduced identically on the last 4 pushed runs to `main` (run #28518094451 and 3 predecessors) — not intermittent flakiness, a deterministic TIMEOUT classification.

## Root cause (devops-cicd-specialist investigation, run #28518094451 / job 84534816449)

1. **Broken cache path** — the "Cache Playwright browsers" step listed `%USERPROFILE%\AppData\Local\ms-playwright` for Windows. `actions/cache` (the `@actions/cache` Node toolkit) expands `~` to `os.homedir()` cross-platform but never expands `%VAR%` cmd.exe syntax, since it isn't shelled out. Result: permanent cache miss on Windows → full ~3.5min browser reinstall (`npx playwright install --with-deps`) on every run, while macOS/Linux legs cache-hit in ~1s.
2. **Windows throughput is ~2.3x slower** than macOS for the same 357-test suite, and Windows-specific retries compound this heavily (a test passing in <1min on macOS can cost 2-8min on Windows once retried). Traced to `waitForCheckoutLoad()` in `src/pages/ecommerce/checkout-page.ts:84-95` silently swallowing timeouts via `.catch(() => {})`, so a slow SPA transition under Windows I/O returns a stale `false` to the caller's hard `isOnCheckoutPage()` assertion instead of a clean timeout signal — this is a **separate, still-open code-level flakiness cause**, not fixed by the CI changes below.
3. **The "45→60min timeout fix" referenced in earlier session memory (2026-06-29) never actually landed for this job** — that prior fix bumped the Playwright *test-level* global timeout in `src/constants/timeouts.ts`, not the GitHub Actions **job-level** `timeout-minutes: 45` in the workflow YAML, which was unchanged in every commit up to HEAD. At Windows's own observed pace the full suite needs ~90min — even a 60min bump wouldn't have been sufficient.

## Fix applied (2026-07-01, local changes not yet pushed)

Chose **Option B (sharding)** over Option A (raise timeout) — sharding removes the root slowness instead of just giving it more time, and keeps wall-clock CI feedback close to macOS's pace.

**3 files changed:**
- `.github/workflows/playwright-with-slack.yml`:
  - Cache path: `%USERPROFILE%\AppData\Local\ms-playwright` → `~\AppData\Local\ms-playwright`
  - `ui-test` matrix restructured from `os: [windows-latest, macos-latest]` + `include` (extra keys only) to a pure `include:`-only list of 4 explicit legs: 3× `windows-latest` with `shardIndex: 1/2/3` of `shardTotal: 3`, plus 1× `macos-latest` with `shardIndex: 1` of `shardTotal: 1` (unsharded, since macOS already fits the 45min budget).
  - Job `name:` now shows `UI Tests (${{ matrix.os }} shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }})` for GH Actions UI legibility across the now-3 Windows legs.
  - Both "Run UI tests" steps pass `${{ matrix.shardIndex }}/${{ matrix.shardTotal }}` as a new 4th positional arg.
  - Both artifact-upload steps (`monocart-shard-...`, `ui-test-results-...`) now include `${{ matrix.shardIndex }}` in the name — **required** to avoid 3 concurrent Windows jobs colliding on the same artifact name (upload-artifact errors on duplicate names within a run by default).
  - `timeout-minutes: 45` left unchanged — 3-way sharding brings each Windows leg down to roughly macOS's pace, so the existing ceiling should now have healthy margin.
- `run-ui-tests.bat` / `run-ui-tests.sh`: both scripts gained an optional 4th positional arg (`shardIndex/shardTotal`), forwarded as `--shard=X/Y` to `npx playwright test` when present; behavior unchanged when omitted.

**Not touched (already correct):** the `test-report` job's monocart merge step already globs shard artifacts with wildcards (`monocart-shards/monocart-shard-Windows-*/index.json`), so it transparently absorbs however many shard artifacts exist per OS with zero changes needed.

## Known caveat, not yet addressed

"Restore monocart trend data" cache step uses one shared key per OS (`monocart-trend-ui-Windows-main`). With 3 concurrent Windows shards now writing to that key at job end, 2 of 3 will get a harmless "cache already exists" warning on save (non-fatal in actions/cache v4+, no job failure). Left as-is; revisit only if it becomes noisy.

## Related

[[execution-config]] for OS matrix / retries / CI-aware timeout background. [[advisor-nudge-mechanism]] for the CLAUDE.md §5 pattern that would flag "about to modify BasePage/base-test.ts" — not directly triggered here since this was a workflow-file change, not a fixture change.
