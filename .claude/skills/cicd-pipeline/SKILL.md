---
name: "cicd-pipeline"
description: Use when creating, optimizing, or troubleshooting CI/CD pipelines for Playwright automation, including GitHub Actions, CircleCI, caching, artifacts, and parallel test execution.
---
# CI/CD Pipeline

Read and follow [$targetDisplayPath](../../../.agents/skills/cicd-pipeline/SKILL.md).

## monocart-reporter in CI

This framework uses `monocart-reporter` alongside built-in Playwright reporters. Key CI patterns:

**Trend history** — stored in a branch-scoped `actions/cache`:
- Cache key: `monocart-trend-ui-{runner.os}-{github.ref_name}` (UI, per OS)
- Cache key: `monocart-trend-api-{github.ref_name}` (API)
- Restore before tests; save `index.json` after tests; next run reads it via `MONOCART_TREND_FILE` / `MONOCART_API_TREND_FILE` env var

**Multi-OS matrix merge** (UI workflow `playwright-with-slack.yml`):
- Each matrix runner uploads a shard: `monocart-shard-{OS}-{run_id}` (retention 1 day)
- `test-report` job downloads all shards and runs `npx monocart merge 'shards/*/index.json'`
- Merged artifact: `monocart-merged-report-{run_id}` (retention 30 days)
- Merged `index.json` summary is extracted and exposed as job outputs for the Slack notification

**Slack payload** — `needs.test-report.outputs.*` (UI) or `needs.api-tests.outputs.*` (API) provide:
`tests`, `passed`, `failed`, `skipped`, `flaky`, `duration`

**GitHub Actions Step Summary** — `onEnd` hook in `playwright.config.ts` and `api.config.ts` appends a markdown table to `$GITHUB_STEP_SUMMARY` automatically in CI.

**Artifact names to look for when investigating CI:**
- `monocart-merged-report-{run_id}` — merged UI report (Windows + macOS combined)
- `monocart-api-report-{run_id}` — API test report
- `monocart-shard-{OS}-{run_id}` — per-OS shard (short-lived, 1 day retention)

