# Custom Fixtures That Attach Failure Context Automatically — Technical Research

**Date:** 2026-07-25
**Repo:** `E:\OLDDATA\DATA\TESTING\AutomationTesting\playwright-typescript`
**Playwright version verified against:** `@playwright/test@1.61.1` (installed, `node_modules/playwright/lib`)
**Source of the proposal:** `docs/study/advanced-api-handle.html`, section 05 (`id="fixtures"`, lines 654-761)

---

## Summary

The study document proposes a third attachment mechanism for this framework: a custom fixture (`smartRequest`) that wraps the built-in `request` fixture, calls `await use(request)`, then checks `testInfo.status !== testInfo.expectedStatus` at teardown and calls `testInfo.attach()` with a JSON blob containing status and error message — attaching only when the test failed.

The framework already has two attachment mechanisms that overlap this proposal:

| Mechanism | Location | Gate | What it attaches |
|---|---|---|---|
| `ApiClientExt.attachVerboseLog()` | `src/api/ApiClientExt.ts:104` | `VERBOSE_LOGS` env var (default **ON**), not pass/fail | Redacted request+response JSON, **one attachment per `*WithWrapper` call** |
| `attachTestLogs` auto-fixture | `src/config/base-test.ts:129`, `src/api/ApiTest.ts:181` | none — always | `test-steps.log`, the per-test `TestLogger` buffer |

**Top-line conclusion: the proposed `smartRequest` fixture should not be adopted as written. It is inert in this repo, and for the API side it solves a problem that is already solved — twice.**

Three independent findings drive that:

1. **The proposed fixture captures nothing.** `await use(request)` hands the test the *same* `APIRequestContext` object; the fixture holds no record of any call made through it. `APIRequestContext` exposes no request/response events, so the wrap-and-observe shape the study implies is not achievable this way. The attachment body is status plus first error message — both already rendered by every reporter this repo runs (html, json, junit, list, monocart). Net new information: zero. This contradicts the section's own stated motivation ("Playwright doesn't attach request or response bodies and headers to the HTML report on its own").
2. **It would not intercept a single call in this repo even in principle.** No API spec uses Playwright's built-in `request` fixture. `ApiClient.init()` (`src/api/ApiClient.ts:75`) builds its own context via `request.newContext(...)`, and every fixture in `ApiTest.ts` (`apiClient`, `apiClientExt`, `graphqlClient`, `restfulApiClient`, `bookingService`, `dummyjsonService`, and the four create-factories) hands the test one of those clients. A fixture wrapping the `request` fixture sits outside every call path in the suite.
3. **The genuinely uncovered surface is the UI side, and it is narrower than it first appears.** Playwright 1.61 already writes an `error-context.md` ARIA page snapshot on any failing test with a browser context (`node_modules/playwright/lib/index.js`, `_takePageSnapshot` plus `buildErrorContext`, guarded by an early return when `testInfo.errors.length === 0`). Screenshots (`only-on-failure`) and video (`retain-on-failure`) are already configured. What is **not** captured on a first-attempt UI failure is **browser console errors, uncaught page errors, and failed network requests** — trace would carry those, but `TRACE_MODE` defaults to `on-first-retry` (`src/config/environment.ts:114`), which means zero trace for local runs (`retries: 0`) and zero trace for the first CI attempt.

### Verified Playwright 1.61.1 semantics (read from installed source, not assumed)

| Claim | Verdict | Evidence |
|---|---|---|
| `testInfo.status` is final in test-scoped fixture teardown | **Confirmed, with a caveat** | `workerProcessEntry.js:1685` — `teardownScope('test', ...)` runs inside the "After Hooks" step, after the test body and after all `afterEach` hooks. Caveat: a later-torn-down fixture can still fail and change status after your fixture has already run. |
| `testInfo.error?.message` is populated at that point | **Confirmed** | `workerProcessEntry.js:956` — `get error()` returns `this.errors[0]`; `errors` is appended by `_failWithError` during the test body. |
| Soft assertions (`expect.soft`, `softAssert`) are visible to the gate | **Confirmed — the brief's concern does not materialise** | `workerProcessEntry.js:1052` — a step completing with a soft error calls `_failWithError(...)`, which at `:1121` sets `status = 'failed'` immediately, not at end-of-test. By teardown, a soft-failed test already reads `status === 'failed'`. |
| `status !== expectedStatus` is the right guard | **Partially — the study's version is subtly wrong** | Playwright's own internal predicate is `_isFailure()` at `workerProcessEntry.js:1172`: `status !== 'skipped' && status !== expectedStatus`. The bare comparison can fire on skipped tests. Use Playwright's form. |
| Behaviour with `test.fail()` / `test.skip()` | **Handled, one blind spot** | Runtime modifiers mutate `expectedStatus` (`:989-993`, `:1580-1584`). A `test.fail()` test that fails gets **no** attachment (status equals expectedStatus) — correct by the pattern, mildly unhelpful for debugging. An unexpectedly-passing `test.fail()` test does attach. |
| Fixture teardown ordering is deterministic | **Confirmed** | `workerProcessEntry.js:290` — `teardownScope` iterates the fixture instances reversed: strict reverse of setup order. Setup order is auto-fixtures first (worker-scope autos before test-scope autos, then declaration order inside the extend object), then dependency-resolved test fixtures. **Consequence: auto fixtures are set up first and therefore torn down last** — after the ecommerce fixtures' Firefox `about:blank` navigation. |
| Teardown has a time budget after a test timeout | **Confirmed** | `:1667-1670` — the After Hooks phase gets a fresh slot sized `calculateMaxTimeout(project.timeout, testInfo.timeout)`. An attachment on a `timedOut` test does get written, within that budget. |
| Retries duplicate attachments | **Per-result, not per-test** | Each retry is a distinct TestResult with its own attachments. With `api.config.ts` `retries: 2` in CI, a persistently failing test yields up to 3 copies across 3 results. |
| API calls are traceable if tracing were enabled | **Confirmed** | `node_modules/playwright/lib/index.js:647` — `ArtifactsRecorder.didCreateRequestContext()` starts a trace chunk for every `APIRequestContext`, including ones created via `request.newContext()`. `api.config.ts` sets no `trace` option, so this is currently off. |

### The report-size fact that reframes the whole question

monocart **inlines** body attachments into `index.json` as a `content` string, with **no size cap**. Verified two ways: by parsing the local `monocart-api-report/index.json` (each `test-steps.log` attachment appears as an object with `name`, `contentType`, `retry` and the full text in `content`), and from the reporter source — `node_modules/monocart-reporter/lib/visitor.js`, `saveAttachmentBodyHandler()`: if `Util.isTextType(contentType)` the body is assigned straight to `item.content` and returns, with no threshold check. `isTextType` (`lib/platform/share.js:244`) covers `text/*`, markdown, mermaid **and JSON** — so both `test-steps.log` (`text/plain`) and `api-verbose-*.json` (`application/json`) are inlined. Only non-text bodies are spilled to files.

`index.json` is a single file, and the CI pipeline runs a `find ... -size +25M -delete` sweep over the report directory before every Cloudflare Pages deploy (`playwright-with-slack.yml:646`, `:664`, `:684`). If attachments ever push `index.json` past 25 MiB, that step deletes **the entire report data file**, and the deploy still proceeds because the gate only checks that `index.html` exists. The result is a published-but-empty public report. This is a live risk on the existing `VERBOSE_LOGS`-default-ON path, independent of this proposal — and it is the strongest argument for the one option the brief did not enumerate (Option B below).

---

## Scope

Files and systems that would be touched, per option.

**API side**
- `src/api/ApiTest.ts` — `ApiTestFixtures` interface plus fixture registration (Options A and B)
- `src/api/ApiClientExt.ts` — `attachVerboseLog()` / `isVerboseLoggingEnabled()` (Option B only; buffer-then-flush conversion)
- `api.config.ts` — only if trace is enabled (Option D); currently no `trace` key
- `src/utils/redact.ts` — reused as-is for any API payload attachment; must be extended before any new field class is attached

**UI side**
- `src/config/base-test.ts` — `CustomFixtures` interface plus fixture registration (Option C). The `CustomFixtures` type declares **23 members** (counted programmatically): 18 page-object fixtures, plus `percyHelper`, `softAssert`, `consoleHelper`, `makeAxeBuilder`, and the `attachTestLogs` auto-fixture. Three of them — `ecommerceTrackOrderPage`, `ecommerceHelpSupportPage`, `ecommerceWishlistPage` — are registered but absent from CLAUDE.md's fixture table. Per CLAUDE.md section 5 this is an advisor-gated, high-impact file: every UI test loads it.
- `src/pages/helpers/console-helper.ts` — `ConsoleHelper` already buffers console messages and is the natural home for a failure-gated attach (Option C)
- `src/config/environment.ts` — `traceMode` default (Option D)
- `playwright.config.ts` — unchanged under all options (trace is env-driven)

**CI and reporting**
- `.github/workflows/playwright-with-slack.yml` — shard artifact upload (`monocart-report/` plus a copied `test-results/`, 1-day retention at `:240`; 30-day results at `:254`), `npx monocart merge` into `cf-deploy/macos` and `cf-deploy/windows` (`:503-525`), the 25 MiB strip (`:646`), and public deploys to `playwright-ui-reports.pages.dev`, `playwright-api-reports.pages.dev`, `playwright-misc-api-reports.pages.dev`
- `.github/workflows/api-restful-tests-with-slack.yml` — same pattern for the API suite
- **Public exposure is the binding constraint.** `VERBOSE_LOGS` is set nowhere in `.github/workflows/` and nowhere in `.env.testing`, so it is ON for every CI API run, and those redacted payloads are published to a public Pages site.

**Not in scope:** `BasePage` and the 11 helpers need no change under any option except Option C, which touches `ConsoleHelper` only.

---

## Options

### Option A — Failure-gated auto-fixture layered on top of the existing `attachVerboseLog` (API)

Add a new auto fixture in `ApiTest.ts` that, on failure only, attaches a summary blob (status, first error message, optionally an index of calls made). `attachVerboseLog` keeps working unchanged.

| Pros | Cons |
|---|---|
| Purely additive; no behaviour change for passing tests | Duplicates data already in the report (status, error) unless it also buffers payloads — and if it buffers payloads, it duplicates `attachVerboseLog` |
| Cheap to revert (delete one fixture) | Adds a **third** attachment pattern to a codebase that already has two; conflicts with CLAUDE.md section 2 "Simplicity First" |
| Matches the study's stated shape, so it is defensible as a teaching artefact | Increases report size on exactly the tests that are already largest (failing tests carry the most verbose attachments) |
| | Does not reduce the `index.json` bloat risk at all |

### Option B — Convert `attachVerboseLog` from per-call always-attach to buffer-then-flush-on-failure (API)

Buffer the redacted payloads during the test; a teardown fixture flushes them into a **single** attachment only when the failure gate says the test failed. This is the only variant of the section-05 pattern that reduces report size instead of adding to it.

| Pros | Cons |
|---|---|
| Directly attacks the 25 MiB `index.json` risk: one attachment per failing test instead of N per test | **Reverses a decision CLAUDE.md documents as an "explicit product decision, accepted risk"** — needs explicit user sign-off, not just implementation approval |
| Fewer, larger attachments merge better in monocart than many small ones | Loses pass-case debugging: today a passing-but-suspicious test's payloads are inspectable; afterwards they are gone |
| Shrinks the public-report surface — redacted payloads for passing tests stop being published at all | Buffer must outlive individual client instances: `createClientExt` factories and per-test client churn need a shared sink (worker-level Map keyed by `testInfo.testId`, mirroring `TestLogger.registry`) |
| Redaction reuse is free — same `redact.ts` call, just deferred | Memory: a long GRA spec's payloads are held in RAM until teardown rather than streamed out per call |
| | Behaviour change visible to anyone currently relying on per-call attachments during triage |

### Option C — Failure-gated UI failure-context capture, folded into the existing `ConsoleHelper`

Make `consoleHelper` an auto fixture, add `page.on('pageerror')` and `page.on('requestfailed')` listeners alongside the existing `page.on('console')`, and attach the buffered result only when the test failed. `summarize()` stays in warn mode.

| Pros | Cons |
|---|---|
| Fills a genuinely uncovered gap: console errors, page errors and failed requests are absent from `error-context.md`, screenshots and video, and trace is off on the first attempt | Touches `base-test.ts` — high-impact per CLAUDE.md section 5 (18 fixtures, all UI tests) |
| Reuses machinery that already exists rather than adding a third pattern | Auto means every UI test pays a listener cost, and `summarize()`'s `console.warn` would fire on every noisy staging storefront run — noise must be suppressed or that path reworked |
| **`consoleHelper` is currently used by exactly zero tests** (verified by grep across `tests/`). Opt-in fixtures demonstrably rot in this repo; auto is what makes capture actually happen | `failOnErrors` must remain `false` by default or every console error becomes a test failure — a suite-wide regression |
| Small, bounded text payload, so `index.json` growth is negligible and only on failures | New redaction surface: console lines and request URLs can carry auth tokens, emails and session ids. `redactSensitiveText()` must be applied before attaching |
| Independent of the API path — no interaction with `VERBOSE_LOGS` | Auto-fixture teardown runs after the ecommerce Firefox `about:blank` navigation, so nothing may be live-read from the page at teardown |

### Option D — Zero-code: change trace policy instead

Set `TRACE_MODE=retain-on-failure` for UI runs, and/or add `trace` to `api.config.ts`. Trace already carries console, network, DOM and sources.

| Pros | Cons |
|---|---|
| No new code, no fixture registration, no new pattern — maximally "boring" per CLAUDE.md decision rules | Trace files are **not redacted**. For API this would put raw `Authorization` headers, JWTs and customer PII into artifacts — a direct security regression against the reason `redact.ts` exists |
| Strictly better failure context than any hand-rolled attachment for UI | Trace size: `retain-on-failure` on a broad UI failure can add tens of MB per test to the 30-day artifacts |
| Closes the first-attempt-failure gap that `on-first-retry` leaves open | Whether path-based attachments survive `npx monocart merge` into `cf-deploy` is unverified, so the public UI report may not surface traces at all |
| Reversible by one env var | Does not help the API suite without accepting the redaction regression |

### Option E — Do nothing

| Pros | Cons |
|---|---|
| API side is genuinely already covered by `attachVerboseLog` plus `attachTestLogs`; the study's pattern adds nothing there | Leaves the UI console/pageerror/network gap open on first-attempt failures |
| Zero risk, zero footprint | Leaves the oversized-`index.json` failure mode unaddressed |

---

## Recommended approach

**Reject the section-05 `smartRequest` pattern for the API suite (Option E for API). Adopt Option C for the UI suite, scoped tightly. Raise Option B to the user as a separate, explicitly flagged decision.**

Justification tied to this repo, not generic Playwright advice:

1. **API needs nothing.** `attachVerboseLog` already attaches full redacted request+response payloads for every `*WithWrapper` call. A failure-gated fixture that attaches status plus error message is strictly less informative than what the report already shows. Structurally, `smartRequest` wraps a fixture (`request`) that no spec in this repo consumes.
2. **UI has a real, narrow gap, and Option C fills it with existing parts.** `error-context.md` (DOM), screenshot and video already cover the visual and structural side of a UI failure. Console errors, uncaught page errors and failed requests are the missing signal — exactly what `ConsoleHelper` was built to collect. Building a new fixture instead would be a third pattern for a job the second pattern can already do.
3. **`consoleHelper` at zero usage is the decisive evidence.** It proves both halves of the argument: the machinery exists, and opt-in is not a viable delivery mechanism here. Auto plus failure-gated is the shape that makes capture real without imposing cost on passing runs.
4. **Option B is genuinely valuable but is not an implementation decision.** It reverses a documented product decision and trades away pass-case debugging, while being the only option that mitigates the `index.json` size cliff. It should go to the user as its own yes/no, not be bundled into a UI change.

**Do not adopt Option D for the API suite** while reports are published publicly — traces bypass `redact.ts` entirely. Option D for UI (`TRACE_MODE=retain-on-failure`) is a reasonable low-cost complement to Option C, but should be decided separately on artifact-size grounds.

---

## Risk assessment

| Risk | Severity | Applies to | Mitigation |
|---|---|---|---|
| `monocart index.json` exceeds 25 MiB, the CI strip step deletes it, and the published report is empty while the deploy still reports success | **High** (inlining verified unconditional; growth rate unmeasured) | Existing `VERBOSE_LOGS` path; worsened by Option A | Option B; or make the strip step fail loudly instead of silently deleting; or exclude `index.json` from the size filter |
| Redaction gap on a new UI attachment surface (console lines and request URLs carrying tokens, emails, session ids) reaching the public Pages site | **High** | Option C | Apply `redactSensitiveText()` to every buffered line before attaching, and extend `SENSITIVE_KEYS`/patterns in `src/utils/redact.ts` first. `redact.ts` is a denylist and is documented as not provably complete |
| Making `consoleHelper` auto changes behaviour for all UI tests; `summarize()` in `failOnErrors: true` mode would turn console noise into failures | **High** | Option C | Keep `failOnErrors: false` as the hard default; confirm no caller overrides it (currently none — zero usages); suppress or gate the `console.warn` summary |
| Live-reading page state at teardown can return `about:blank` | **Medium** | Option C | Buffer via `page.on(...)` listeners during the test; never call `page.url()`, `page.content()`, storage reads or `page.screenshot()` in the teardown branch. Note the ordering nuance: teardown is strict reverse of setup order, but because `consoleHelper` depends on `page` it is dependency-ordered alongside the ecommerce page-object fixtures, so whether it tears down before or after their Firefox `about:blank` navigation follows **declaration position**, not auto-ness. The buffer-only rule makes the outcome irrelevant either way — which is precisely why it is a hard rule rather than an ordering fix |
| Retry multiplication: CI `retries: 2` means up to 3 copies of the attachment across 3 results | **Medium** | A, B, C | Accept (each copy belongs to a distinct attempt and is legitimately useful), or gate to the final attempt via `testInfo.retry === testInfo.project.retries` |
| Teardown-time attach exceeding the After Hooks budget on a timed-out test | **Low** | A, B, C | Budget is max(project timeout, test timeout) — ample for a string attach. Wrap in try/catch and swallow, mirroring `attachVerboseLog`'s "instrumentation never affects the test" contract |
| Fixture-ordering conflict with `attachTestLogs` | **Low** | A, B, C | Ordering is deterministic (reverse of declaration order among test-scope autos). Multiple `testInfo.attach()` callers at teardown do not conflict — attachments append to a list. Register a new auto fixture after `attachTestLogs` if flush order matters |
| Skipped tests spuriously attaching | **Low** | A, B, C | Use Playwright's own predicate: `status !== 'skipped' && status !== expectedStatus` |
| Loss of pass-case API payload visibility | **Medium** | Option B only | Keep a `VERBOSE_LOGS=always` escape hatch that restores per-call attaching for targeted debug runs |

**Rollback plan:** Option C is one fixture-option change (drop `auto: true`) plus deletion of the teardown branch in `ConsoleHelper`; no test files change, so rollback is a single-commit revert with no downstream edits. Option B is a larger revert (touches `ApiClientExt` internals plus a new fixture) but stays behaviourally isolated behind `isVerboseLoggingEnabled()`.

---

## Implementation steps

**Only if the user approves. Ordered for Option C (the recommendation).**

1. Extend `src/utils/redact.ts` **first**: confirm `redactSensitiveText()` covers the value classes that appear in browser console output and request URLs (JWT, email, card number and secret query params are covered today). Add any missing pattern before anything new is attached. No attachment code lands before this step.
2. In `src/pages/helpers/console-helper.ts`, add `page.on('pageerror', ...)` and `page.on('requestfailed', ...)` listeners inside `attach()`, buffering into the existing messages array (or a sibling array with a distinct type tag). Buffer only — no page reads.
3. Add a method (for example `buildFailureReport(): string`) that renders the buffer as plain text and passes it through `redactSensitiveText()`. Return an empty string when the buffer is empty so nothing is attached for a clean failure.
4. In `src/config/base-test.ts`, convert the `consoleHelper` fixture to the auto-fixture tuple form, and in the teardown branch:
   - gate on `testInfo.status !== 'skipped' && testInfo.status !== testInfo.expectedStatus`
   - attach the redacted buffer as `console-failure-context.log` with contentType `text/plain`
   - wrap the whole branch in a try/catch that swallows, per the `attachVerboseLog` precedent
   - do not touch `page` in this branch (see Risk assessment)
5. Keep `summarize()` on the existing `failOnErrors: false` default, and ensure its `console.warn` does not fire for every test now that the fixture is auto — either gate it on failure too, or drop it in favour of the attachment.
6. Register the fixture after `attachTestLogs` in the extend object if attachment ordering in the report matters (teardown is reverse-declaration order among test-scope autos).
7. Run `npm run lint` (`tsc --noEmit`). The `CustomFixtures` type for `consoleHelper` is unchanged, so no signature churn is expected.
8. Do not bundle Option B into this change. If the user also approves Option B, implement it as a separate commit against `ApiClientExt` and `ApiTest.ts`.

---

## Validation

**Before (baseline to capture first):**
- Passing UI test: attachments are `test-steps.log` only.
- Failing UI test (first attempt, local, `retries: 0`): `test-steps.log`, screenshot, video, `error-context` markdown ARIA snapshot. **No console output, no failed-request list, no trace.**
- Passing API test: `test-steps.log` plus one `api-verbose-METHOD-timestamp.json` per `*WithWrapper` call.

**After (expected):**
- Passing UI test: attachments unchanged (`test-steps.log` only). This is the key regression check — **zero new attachments on green runs**.
- Failing UI test: the same set as before **plus** exactly one `console-failure-context.log` containing console errors, uncaught page errors and failed requests, with emails, JWTs, card numbers and secret query params replaced by redaction markers.
- Failing UI test with an empty console buffer: no new attachment (empty-buffer short-circuit).
- API reports: byte-identical to before; no API code path touched.

**How to verify:**
1. Write a throwaway spec with one passing and one deliberately failing UI test; run `npm run test:simple`; inspect `monocart-report/index.json` and confirm the attachment lists match the table above.
2. Soft-assertion case: a test whose only failure is a `softAssert.*` call must still produce the attachment — this confirms the `_failWithError` status-mutation finding holds in practice.
3. Skip case: a `test.skip()`-ed test must produce no attachment.
4. Redaction case: emit a console error containing a fake JWT and an email from a page under test; confirm both are replaced in the attachment.
5. Firefox case: run the failing test on the `firefox` project against an ecommerce fixture and confirm the attachment is still produced and non-empty — this proves the buffer-not-live-read requirement was honoured across the `about:blank` teardown.
6. Size check: compare `monocart-report/index.json` size before and after on a full run; growth should be bounded by failing-test count times a few KB.
7. Delete the throwaway spec.

---

## Open questions

1. Do path-based attachments (trace, video, screenshot) survive `npx monocart merge` into `cf-deploy`? The merge consumes shard `index.json` files and the shard artifact includes a copied `test-results/`, but whether the merged output resolves those relative paths was not verified. This determines how much of Option D's benefit reaches the public UI report versus only the 30-day GitHub artifacts.
2. Is the `monocart-api-report/index.json` produced by a real CI GRA run anywhere near the 25 MiB strip threshold? The local sample was 0.20 MB but contained no `api-verbose-*` attachments (that run exercised `dummyjsonService`, which bypasses `ApiClientExt`). A CI measurement would tell us whether Option B is urgent or merely prudent.
3. Should the strip step be changed to fail the job rather than silently publish a report whose data file has been deleted? Out of scope here, but it is a latent CI correctness bug independent of this proposal.
4. Are `ecommerceTrackOrderPage`, `ecommerceHelpSupportPage` and `ecommerceWishlistPage` intentionally absent from CLAUDE.md's fixture table, or is the doc simply behind the code? Flagged, not changed — it affects nothing in this proposal beyond the blast-radius estimate for `base-test.ts`.
