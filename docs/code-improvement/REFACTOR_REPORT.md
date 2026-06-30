# Technical Research Report — Refactor & Clean-Code Audit

**Date:** 2026-06-30 · **Status:** Research only — no code modified. Implementation gated behind user approval.

---

## Summary

The framework is in good health. **No Critical findings, no security incidents in source.** The audit surfaced low-blast-radius cleanups (dead/dormant code, a few clean-code defects, one convention deviation) plus two structural items worth a deliberate decision: the `@deprecated` delegation surface on `BasePage` (now ~98% migrated away from internally) and the eight repeated Firefox-teardown blocks in `base-test.ts`.

The highest-volume areas (ecommerce smoke + GRA API) already factor shared logic into `tests/ecommerce/smoke/smoke-helpers.ts` and the API service layer, so there is **no significant spec duplication**. Test import hygiene is clean (no improper `@playwright/test` imports in specs).

---

## Scope

8 dimensions audited: Page Object quality, test-spec quality, helper layer, TypeScript quality, dead code, fixture registration, duplication, import hygiene.

**Excluded by design:**
- `page.evaluate`/`querySelectorAll` style in ecommerce POMs — deliberate (Magento PWA Studio styled-components hashed classes, per `tests/ecommerce/CLAUDE.md`)
- Firefox `about:blank` teardown blocks — intentional Juggler workaround; preserve

---

## Findings

Severity: Critical / High / Medium / Low · Effort: XS / S / M / L / XL

### Dead Code

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-01 | Low | XS | `tests/seed.spec.ts` is an empty placeholder (`// generate code here.`, no assertions) collected and run as an always-pass no-op. Delete. | `tests/seed.spec.ts` |
| F-02 | Low | S | `src/data/home-data.ts` exports `HomeTestDataGenerator`, `FooterData`, `AccountData`, `TransactionData` + interfaces that nothing imports (BankGuru/Maven leftovers). `FooterData` also duplicates `HeaderData` creds. Remove only these orphaned exports; leave identically-named types in `admin-data.ts`/GRA data files alone. | `src/data/home-data.ts` |
| F-03 | Low | XS | `consoleHelper` fixture is registered (`base-test.ts:41,109-113`) but no spec file consumes it. Remove or wire up — confirm with owner first (may be planned-but-unused). | `src/config/base-test.ts` |
| F-04 | Medium | S | Dormant `form-drag-and-drop` triad: spec is in `testIgnore` (`playwright.config.ts:33`), POM exists at `src/pages/frontsite/form-drag-and-drop.ts`, fixture `formDragAndDropPage` registered. **Investigate why disabled first**, then re-enable or remove — do not delete blind. | `tests/frontsite/form-drag-and-drop.spec.ts`, `src/pages/frontsite/form-drag-and-drop.ts`, `src/config/base-test.ts` |

### Test-Spec Quality

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-05 | Low | S | `tests/frontsite/home-page.spec.ts:37` hardcodes `'rgb(0, 63, 100)'`, which equals `HeaderData.NAVIGATION_MENU.highlightedColor` (`#003f64`) that the adjacent `logger.step` already references. Bypasses the data constant. Fix: store rgb value in `HeaderData` or add a shared `hexToRgb` util. | `tests/frontsite/home-page.spec.ts:37` |

### Page Object Quality

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-06 | Medium | S | `src/pages/frontsite/profile-listing-page.ts:21-42` declares **static** locators (`sortByDropdown`, `profileLinks`, `searchInput`) as private methods returning `Locator`. Not parameter-driven → CLAUDE.md rule #2 requires `private readonly` class fields. Also: line 32 inlines selector `'[href*="/people/"]'` inside a helper-call literal (banned). Hoist all three to fields + a named selector constant. | `src/pages/frontsite/profile-listing-page.ts:21-42` |
| F-07 | Low | S | `src/pages/admin/login-page.ts` has four small defects: (a) duplicated JSDoc block (~lines 82-87), (b) `getErrorMessageFromPopup` dedented to column 0, (c) unused `catch (error)` binding, (d) raw CSS locator `#js-nav-breadcrumb i` — replace with semantic equivalent if available. | `src/pages/admin/login-page.ts` |

### TypeScript Quality

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-08 | Medium | M | `reportData: any` in monocart `onEnd` hooks (`playwright.config.ts:68` + `api.config.ts`) and `as any` casts on `env.traceMode/screenshotMode/videoMode` (`playwright.config.ts:102-108`). ~50 `any` usages across ~10 files total. Type `reportData` against monocart's summary type; narrow env casts to Playwright's mode unions. Treat remainder as tracked backlog. | `playwright.config.ts`, `api.config.ts` |

### Helper Layer

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-09 | Low | S | `ElementHelper.getElementCount` (`element-helper.ts:102-108`) and `DomScanHelper.count` (`dom-scan-helper.ts:88-94`) are byte-identical. `getAllTexts`/`getAllTextContents` both return trimmed `textContent` arrays but differ in failure semantics (throwing-with-wait vs non-throwing-empty) — this divergence is **intentional**. Only the identical count pair is a clean merge; document the throwing-vs-safe distinction. | `src/pages/helpers/element-helper.ts`, `src/pages/helpers/dom-scan-helper.ts` |

### Fixture Registration / Duplication

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-10 | Medium | M | The 8 ecommerce fixtures repeat the identical ~5-line Firefox `about:blank` teardown block (`base-test.ts` ~lines 86-88, 93-95, …, 164-166). Extract one helper (e.g. `firefoxSafeTeardown(page)`) **preserving `waitUntil:'commit'`, 5000 ms, `.catch()` verbatim**. This touches shared infra — advisor review required. | `src/config/base-test.ts` |

### Structural / Migration

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-11 | Medium | M | `BasePage` carries a large `@deprecated` "Backward-compatible delegations" block. Quantified: **~59 direct helper calls** in page objects vs **1 remaining bare delegation** (`home-page.ts:60`, `this.isElementDisplayed(this.logo)`). Migration is ~99% complete; the deprecated surface is now maintenance weight. Migrate the one holdout (XS), then decide whether to slim the block (M, breaking for any out-of-tree caller — advisor-gated). | `src/pages/base-page.ts`, `src/pages/frontsite/home-page.ts:60` |

### Documentation Drift

| ID | Severity | Effort | Finding | File |
|----|----------|--------|---------|------|
| F-12 | Low | XS | Helper-count mismatch: CLAUDE.md table says 8 helpers, but `base-page.ts` instantiates 11 (adds `tabs`, `dom`, `overlays`). Update CLAUDE.md table and `base-page.ts` header comment. | `CLAUDE.md`, `src/pages/base-page.ts` |

---

## Options

### Option A — Targeted Surgical Fixes (recommended first)
Apply F-01, F-02, F-03, F-05, F-06, F-07, F-09, F-11 (single holdout), F-12. Low risk, no shared-infra churn, independently verifiable per finding.

**Pros:** Safe, fast, each fix is isolated.
**Cons:** Does not prevent future regressions — no lint gates.

### Option B — Systematic Sweep (defer behind advisor)
Option A + extract Firefox teardown helper (F-10), slim `BasePage` deprecated block (F-11 remainder), type `any` surface (F-08), resolve `form-drag` triad (F-04). Touches `BasePage`/`base-test.ts` → all fixtures/tests downstream.

**Pros:** Maximum clean-up depth.
**Cons:** CLAUDE.md §5 mandates advisor before any `BasePage` or `base-test.ts` edit. Higher risk surface.

### Option C — Automated Tooling (recommended alongside A)
No ESLint today (only `tsc --noEmit` + prettier). Add ESLint + `@typescript-eslint` with:
- `no-unused-vars` (catches F-03, F-07c)
- `no-explicit-any` (start as `warn` — F-08 backlog)
- Custom `no-inline-selector` rule (F-06 pattern)
- Custom `no-bare-basepage-delegation` rule (F-11 pattern)
Wire into `npm run lint` + `security.yml`.

**Pros:** Prevents regressions, provides CI enforcement.
**Cons:** ESLint setup takes M effort; `no-explicit-any` as `error` would initially fail CI on ~50 existing usages.

---

## Recommended Approach

1. **Option A now** — safe, fast, no advisor gating required.
2. **Option C next** — add ESLint at `warn` for `no-explicit-any` so CI is not blocked while the backlog drains.
3. **Option B behind an explicit advisor review** — F-10/F-11 structural edits and the F-04 decision warrant gated treatment (CLAUDE.md §5).

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Firefox-teardown extraction alters timing → Juggler hangs return | High | Low | Preserve `commit`/5000 ms/`.catch()` verbatim; run full Firefox ecommerce suite before/after |
| Slimming `BasePage` breaks a missed caller | Medium | Low | Migrate `home-page.ts:60` first; grep all delegation names; keep block if external consumer suspected |
| Deleting `form-drag` removes temporarily-disabled coverage | Medium | Medium | Investigate `testIgnore` rationale first; prefer re-enable-and-fix |
| Removing `consoleHelper` drops a planned capability | Low | Medium | Confirm with owner before removing |
| ESLint baseline floods CI with `any` warnings | Low | Medium | Start at `warn` + suppression baseline file |
| Editing `base-test.ts` destabilises fixtures | High | Low | Advisor review (CLAUDE.md §5) + full lint/test/api after |

---

## Open Questions (must resolve before implementation)

1. **F-04** — Why is `form-drag-and-drop.spec.ts` in `testIgnore`? Flaky or removed feature?
2. **F-03** — Is `consoleHelper` planned-but-unused or abandoned?
3. **F-11** — Any out-of-tree consumers of the `@deprecated` `BasePage` methods?
4. **F-05** — Fix preference: store `rgb` value in `HeaderData` or add a shared `hexToRgb` util?

---

## Implementation Steps (only after user approval)

### Phase 1 — Option A (surgical, no advisor required)
1. Delete `tests/seed.spec.ts`
2. Remove orphaned exports from `src/data/home-data.ts` (F-02)
3. Source colour assertion from `HeaderData` in `home-page.spec.ts:37` (F-05)
4. Hoist `profile-listing-page.ts` locators to `private readonly` fields (F-06)
5. Fix four defects in `login-page.ts` (F-07)
6. Migrate `home-page.ts:60` to `this.elements.isElementDisplayed` (F-11 XS portion)
7. Consolidate `count`/`getElementCount` duplicate (F-09)
8. Update helper-count docs in CLAUDE.md + `base-page.ts` header (F-12)
9. Decide on `consoleHelper` — remove or wire up (F-03)

Verify each with: `npm run lint` + `npm run test:simple`

### Phase 2 — Option C (ESLint setup)
10. Install `eslint` + `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
11. Create `.eslintrc.json` with `no-unused-vars` (error), `no-explicit-any` (warn), prettier compat
12. Add `"lint:eslint": "eslint src tests --ext .ts"` to `package.json`
13. Integrate into `security.yml` as non-blocking job (matching current Semgrep pattern)

Verify with: `npm run lint:eslint`

### Phase 3 — Option B (advisor-gated, structural)
14. Extract `firefoxSafeTeardown` helper from 8 repeated teardown blocks (F-10) — advisor review first
15. Slim `BasePage` deprecated delegation block (F-11 remainder) — advisor review first
16. Resolve F-04 `form-drag` triad — investigate, then re-enable or remove
17. Type `any` usages in configs (F-08) using monocart summary type

Verify with: `npm test` (chromium + firefox) + `npm run test:api`

---

## Validation

```bash
npm run lint                  # tsc --noEmit — must be clean after every phase
npm run test:simple           # chromium, 1 worker — fast sanity per finding
npm test                      # chromium + firefox — Phase 3 especially
npm run test:api              # Phase 3 only, if shared infra touched
```

---

## File Reference

| Finding | Absolute Path |
|---------|---------------|
| F-01 | `tests/seed.spec.ts` |
| F-02 | `src/data/home-data.ts` |
| F-03, F-10 | `src/config/base-test.ts` |
| F-04 | `tests/frontsite/form-drag-and-drop.spec.ts`, `src/pages/frontsite/form-drag-and-drop.ts` |
| F-05 | `tests/frontsite/home-page.spec.ts:37` |
| F-06 | `src/pages/frontsite/profile-listing-page.ts:21-42` |
| F-07 | `src/pages/admin/login-page.ts` |
| F-08 | `playwright.config.ts`, `api.config.ts` |
| F-09 | `src/pages/helpers/element-helper.ts`, `src/pages/helpers/dom-scan-helper.ts` |
| F-11 | `src/pages/base-page.ts`, `src/pages/frontsite/home-page.ts:60` |
| F-12 | `CLAUDE.md`, `src/pages/base-page.ts` |

---

*This is research only — no code was changed. To proceed: approve above, then route through `technical-implementation-agent` → `qa-code-reviewer`.*
