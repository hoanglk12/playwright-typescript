---
name: parallel-ui-data-isolation
description: "Six independent layers that make fullyParallel:true safe for UI/ecommerce tests without data corruption; contrasts with API suite's per-brand sequential model"
type: project
tags: [memory, project, parallelism, ecommerce, isolation]
last_verified: 2026-07-02
---

## Why `fullyParallel: true` is safe for UI tests

Not one mechanism — six independent layers, each removing a different class of collision. Investigated 2026-07-02 by auditing `playwright.config.ts`, `base-test.ts`, and every `tests/ecommerce/smoke/*.spec.ts` file. Documented in full (EN + Vietnamese toggle) in `docs/playwright-framework-intro.html` section 13 "Parallel Data Isolation".

1. **Process-level isolation** — each `workers` slot (`playwright.config.ts:37-41`) is a separate Node.js process. Module-level `let`/`const` in a spec exists once per process; audited zero module-level mutable state across `tests/ecommerce/smoke/` — every `let` found (`targetSize`, `availableSizes`) is local to a `test()` body.

2. **Browser context isolation** — `page` fixture is test-scoped by default: fresh `BrowserContext` per test (cookies/localStorage/sessionStorage/cache reset). All 10 ecommerce page-object fixtures in `base-test.ts` just wrap this same test-scoped `page` — none widen to worker scope. **No persisted `storageState.json` reuse anywhere** in this framework; every test needing auth logs in fresh inside its own body.

3. **Fresh test data per test** (the layer that actually prevents backend collisions) — any test doing a real login/logout calls `createFreshAccountViaGraphQL()` → `createFreshAccountCredentials(brandCode)` in `src/data/ecommerce/test-accounts.ts:52-62`, which builds email as `` `qa.${brandCode}.e2e${Date.now()}${faker.string.alphanumeric(8)}@mailinator.com` `` — timestamp + random suffix, ~2.8 trillion combos per ms bucket, collision-safe across workers. Used by `E2E-AUTH-002` (login) and `E2E-AUTH-010` (logout). **Static shared data** (`invalidCredentials`, `nonExistentCredentials` in the same file) is only used by negative-path tests that never establish a session or mutate server state — safe to share because it's provably inert, not because of any locking.

4. **Delta assertions tolerate concurrent interference** — per `tests/ecommerce/CLAUDE.md`, cart tests assert `initialCartCount + 1`, never an absolute count. Robust to whatever state other parallel activity left the shared staging cart in.

5. **Collision-free artifacts/reports** — screenshots/videos/traces use Playwright's default per-test output path (title+project+retry embedded). Reporters (HTML/JSON/JUnit/monocart) run in the **main orchestrating process**, not per-worker — workers report over IPC, so no multi-process file-write race.

6. **No artificial serialization** — zero uses of `test.describe.configure({ mode: 'serial' })` anywhere under `tests/ecommerce/`. Deliberate: layers 1–5 already solve correctness, so no forced ordering is needed.

## UI vs API isolation model — why they differ

| Aspect | UI Suite (`playwright.config.ts`) | API Suite (`api.config.ts`) |
|---|---|---|
| `fullyParallel` | `true` | `false` |
| Isolation strategy | Fresh data + fresh browser context per test | Per-worker `TestState` singleton, sequential within a brand |
| Why | Every test independent by construction | Checkout flow deliberately chains state (cart → address → shipping → payment → order) within one spec |
| Concurrency unit | Individual test (worker process) | Brand/project (8 workers = 8 brands, see [[execution-config]]) |

Do not "fix" the API suite to `fullyParallel: true` — it would break the checkout operation-order dependency and the per-process `TestState` singleton assumption (each worker would get its own instance of `beforeAll`, causing duplicate account creation races).

## Related

[[execution-config]] — worker/parallelism config table (corrected to 8 API workers 2026-07-02, was stale at 4)
[[fixture-registry]] — all 10 ecommerce fixtures are test-scoped `page` wrappers
[[ecommerce-storefronts]] — the 8 live staging storefronts these tests run against
