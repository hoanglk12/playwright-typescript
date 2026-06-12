---
name: execution-config
description: "Parallelism strategy, retry settings, CI auto-detection, timeouts gotchas, and Firefox testIgnore in CI"
type: project
tags: [memory, project]
last_verified: 2026-06-12
---

## Worker & Parallelism Strategy

| Config | fullyParallel | workers | Rationale |
|---|---|---|---|
| `playwright.config.ts` (UI) | `true` | `WORKERS env \|\| "50%"` | Tests are stateless (fresh browser context per test). 50% CPU cores by default. |
| `api.config.ts` (API) | `false` | `4` (fixed) | 4 brands run concurrently. Within each worker, tests run sequentially — module-level `let` state (cartId, token) is shared across tests in one file. |

**Never set `fullyParallel: true` in api.config.ts.** Sequential order within each brand worker is the intentional design.

Override worker count: `WORKERS=4 npm test` or `WORKERS=100%`.

## Retry Settings

| Setting | CI | Local |
|---|---|---|
| `retries` | 2 | 0 |
| `trace` | `on-first-retry` | configurable |
| `screenshot` | `only-on-failure` | configurable |
| `video` | `retain-on-failure` | configurable |

`SCREENSHOT_MODE` and `VIDEO_MODE` env vars override defaults per-run.

## CI Auto-Detection

Both configs detect these env vars to adjust retries, timeouts, and `forbidOnly`:
```
CI, GITLAB_CI, TF_BUILD, GITHUB_ACTIONS
```
No manual flag needed when running in GitHub Actions. `forbidOnly: !!process.env.CI` — any `test.only()` committed to the repo **fails the build immediately**.

## Firefox Ecommerce Skipped in CI

```ts
// playwright.config.ts — Firefox project
{
  name: 'firefox',
  testIgnore: ['**/ecommerce/smoke/**'],  // CI only
}
```

Ecommerce smoke tests run **Chromium-only in CI**. Firefox is excluded to avoid SPA service-worker teardown flakiness. Firefox smoke tests only run locally where the about:blank workaround in fixtures is more reliable.

## API Suite Setup Timeout Gotcha

Any `beforeAll` with **6+ sequential staging API calls** (auth → cart create → SKU search → address → shipping → payment) must set a longer timeout or all tests in the block will appear as "did not run":

```ts
test.beforeAll(async ({ graphqlClient, site, siteState }) => {
  test.setTimeout(TIMEOUTS.API_SUITE_SETUP);  // ← MUST be first line — 90s
  // ... 6+ sequential calls ...
});
```

`TIMEOUTS.API_SUITE_SETUP = 90000` — added to `src/constants/timeouts.ts` on 2026-06-11. Default hook timeout is 30s; 8+ sequential staging calls regularly exceed this.

## actionTimeout in api.config.ts

`actionTimeout: 30000` (30s) — covers slow staging operations like `placeOrder` and multi-step cart mutations that take longer than the Playwright default.

## Dynamic Worker Expression

- `"50%"` → half the CPU cores (minimum 1)
- `"4"` → fixed 4 workers
- `"100%"` → all CPU cores (use only for speed tests locally)

The `WORKERS` env var overrides the config default — used by CI matrix to tune per OS.

## OS Matrix Strategy

Main UI workflow (`playwright-with-slack.yml`) runs on `windows-latest` + `macos-latest` simultaneously:
- `fail-fast: false` — both OS runs complete even if one fails
- Catches platform-specific issues (Firefox path-handling, service worker behaviour)
- Reports merged in `test-report` job; merged counts feed Slack + GitHub Step Summary
