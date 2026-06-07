# TECHNICAL DEBT COMPREHENSIVE REPORT

**Generated:** 2026-06-07
**Audited by:** technical-debt-agent
**Scope:** Full framework audit

---

## 📊 High-Level Overview

| Metric | Value |
|---|---|
| **Overall Grade** | C |
| **Critical Issues** | 5 |
| **Warnings** | 11 |
| **Suggestions** | 5 |
| **Estimated Remediation** | ~12 hours |
| **Build Status** | ✅ Passing (0 tsc errors) |
| **npm audit** | 0 critical, 3 high, 8 moderate, 2 low (13 total) |

**Summary:** The framework is structurally sound — the build type-checks clean, every page object extends `BasePage` and is registered as a fixture, all six ecommerce fixtures retain the Firefox `about:blank` teardown workaround, no `test.only` is committed, and the smoke suite correctly centralises navigation in `smoke-helpers.ts`. The biggest risk area is **architecture-contract drift in page classes** — several frontsite/ecommerce page objects bypass the helper layer and call `this.page.locator()/goto()/waitFor*()` directly, which is the precise anti-pattern the composition model exists to prevent. The recommended next action is a focused Phase 1 sprint to (a) route all direct Playwright calls in page classes through helpers, (b) fix the three API specs missing serial mode and the one API spec importing the wrong base test, and (c) annotate the one untyped exported data module.

---

## 🔴 Critical Issues (fix before next release)

### DEBT-001 — Direct Playwright calls in page classes (helper layer bypassed)
**File:** `src/pages/frontsite/form-drag-and-drop.ts:35,40,45`; `src/pages/frontsite/services-az-page.ts:38,44,61,74,84,85,96,97,100,131,132,190,225`; `src/pages/frontsite/insights-page.ts:36,52`; `src/pages/frontsite/home-page.ts:40,48,64`; `src/pages/frontsite/profile-listing-page.ts:31,48`; `src/pages/ecommerce/plp-page.ts:35,53,106,206`; `src/pages/ecommerce/pdp-page.ts:20,90,123,136,174`; `src/pages/ecommerce/nav-page.ts:55`
**Category:** Architecture Violation
**Issue:** Page classes call `this.page.locator()`, `this.page.goto()`, `this.page.waitForURL()`, `this.page.waitForLoadState()`, `this.page.waitForFunction()`, and `this.page.click()` directly instead of routing through `this.elements.*` / `this.waits.*`. CLAUDE.md states: "never call `page.locator()` or `page.click()` directly inside page classes — use the helpers instead." Only `base-page.ts` is exempt. (Note: matches inside `src/pages/helpers/*` are NOT violations — those files *are* the helper abstraction layer.)
**Impact:** Defeats the composition model. The helper layer exists to centralise wait/retry semantics, logging, and CI-aware timeouts; bypassing it means each page reinvents synchronisation logic, producing inconsistent flakiness and making framework-wide hardening (e.g. a wait-strategy change) impossible to apply in one place.
**Remediation:**
```ts
// Before (wrong) — insights-page.ts:36
async navigateToInsightsPage(): Promise<void> {
  await this.page.goto(`${this.environment.frontSiteUrl}/insights`);
}
// After (correct) — use BasePage navigation + waits helper
async navigateToInsightsPage(): Promise<void> {
  await this.navigateTo(`${this.environment.frontSiteUrl}/insights`); // BasePage delegate
  await this.waits.waitForPageLoadState('domcontentloaded');
}
```
> Pragmatic note: a handful of these (`getByRole().filter()` locator builders, `page.goto()` for React-router swatch navigation per the documented PDP gotcha, `page.waitForFunction()` gallery checks) are deliberate per `tests/ecommerce/CLAUDE.md`. Triage during remediation: convert the plain `locator/click/goto/waitForLoadState` cases first; keep the documented-exception cases but add a `// WHY:` comment so they stop reading as violations.

### DEBT-002 — API spec imports from `@config/base-test` instead of `ApiTest`
**File:** `tests/api/api-mocking-examples.spec.ts:1`
**Category:** Import Convention
**Issue:** `import { test, expect } from '@config/base-test';` inside `tests/api/`. Both root and `tests/api/CLAUDE.md` mandate: "Never import from `@config/base-test` in API test files — always `import { apiTest as test, expect, softExpect } from '../../src/api/ApiTest'`."
**Impact:** The file loses all API fixtures (`apiClient`, `apiClientExt`, `graphqlClient`, etc.) and inherits the UI worker/serial config mismatch. It currently uses the UI `page` fixture for mocking, so it is arguably a misplaced UI-mocking spec rather than an API test — either way it violates the API-folder contract.
**Remediation:**
```ts
// Before (wrong)
import { test, expect } from '@config/base-test';
// After (correct) — if it must stay under tests/api/
import { apiTest as test, expect } from '../../src/api/ApiTest';
// Or relocate the file to a UI mocking folder if it genuinely drives a browser page.
```

### DEBT-003 — API spec files missing mandatory serial-mode declaration
**File:** `tests/api/api-mocking-examples.spec.ts`; `tests/api/graphql-examples.spec.ts`; `tests/api/objects-crud.spec.ts`
**Category:** API Pattern
**Issue:** None of these three declare `test.describe.configure({ mode: 'serial' })` outside their describe blocks. CLAUDE.md: "Every API spec file must declare this at the top." (`graphql-examples.spec.ts` is fully commented out, but the rule applies to any live spec; `objects-crud.spec.ts` and `api-mocking-examples.spec.ts` contain active tests.)
**Impact:** Under the API config (1 worker) the practical risk is low today, but any future parallelisation or copy-paste of these files as templates propagates shared-state races (token/cart bleed between tests).
**Remediation:**
```ts
import { apiTest as test, expect } from '../../src/api/ApiTest';

test.describe.configure({ mode: 'serial' }); // add this, outside all describe blocks
```

### DEBT-004 — Untyped exported data module (`as const`, no named interface)
**File:** `src/data/services-az-data.ts:9`
**Category:** TypeScript
**Issue:** `export const ServicesAZData = { ... } as const;` carries no named interface annotation. CLAUDE.md Test Data rule: "Always declare interfaces for every data shape — both `const` objects and generator return types must carry a named interface annotation. Never rely on inferred types for exported data." `as const` is a literal-narrowing helper, not a declared shape.
**Impact:** Consumers get an anonymous inferred type; refactors and field renames are not contract-checked against an interface, and the module diverges from the `admin-data.ts` reference pattern.
**Remediation:**
```ts
// After (correct)
export interface ServicesAZDataShape {
  homePageUrl: string;
  servicesAZListUrl: string;
  letterLinkPrefix: string;
  pageHeading: string;
}
export const ServicesAZData: ServicesAZDataShape = { /* ... */ };
```

### DEBT-005 — Banned hierarchical structural selector in a page class
**File:** `src/pages/frontsite/services-az-page.ts:32`
**Category:** Architecture Violation
**Issue:** `'nav li:has(> div > a[href="/en/services"]) button'` uses a `> div > a` child-combinator chain. CLAUDE.md bans "hierarchical structural selectors — they break on any DOM restructure and carry no semantic meaning." (The `:nth-child` matches in `table-helper.ts:23,82` are parameter-driven dynamic helpers operating on generic HTML tables — acceptable per the "only dynamic, parameter-driven locators" carve-out — so they are not flagged here.)
**Impact:** The selector breaks on any markup reshuffle of the services nav; it is the most fragile selector in the page layer.
**Remediation:** Prefer a semantic anchor query, e.g. scope to the link by role/href then locate the sibling toggle:
```ts
private readonly servicesNavToggle =
  this.page.getByRole('navigation').getByRole('button', { name: /services/i });
```

---

## 🟡 Warnings (fix within 1–2 sprints)

### DEBT-006 — Systemic untyped `any`
**File:** 54 occurrences across `src/pages/` + `tests/` (92 across the whole repo incl. `src/api/`, `src/utils/`). Sample hotspots: `tests/api/pla-cart_minicart.spec.ts` (15), `tests/api/pla-catalog.spec.ts` (12), `tests/api/pla-checkout-shipping.spec.ts` (10).
**Issue:** `: any` / `as any` annotations exceed the 20-match systemic threshold.
**Remediation:** Replace with typed GraphQL response shapes (`getData<T>()`) and the documented `assertNoCriticalErrors(gql: { errors?: ... })` helper signatures; the API CLAUDE.md already mandates `AuthType.BEARER` over `"bearer" as any`.

### DEBT-007 — Magic timeout numbers instead of `TIMEOUTS.*`
**File:** `src/pages/admin/login-page.ts:74,92`; `src/pages/frontsite/form-drag-and-drop.ts:41`; `src/pages/frontsite/home-page.ts:40`; `src/pages/frontsite/insights-page.ts:46,52,72`; `src/pages/frontsite/profile-listing-page.ts:51,60,75,84,98,110,123,174`; `tests/frontsite/services-az-list.spec.ts:51`; `tests/frontsite/profile-listing-page.spec.ts:34`; `tests/frontsite/insights-search.spec.ts:27`
**Issue:** Raw 4+ digit `timeout:` values (5000/10000/15000/20000/30000) bypass the CI-aware `TIMEOUTS.*` constants. CLAUDE.md: "Use named constants from `src/constants/timeouts.ts` — never magic numbers." (Config-level raws in `api.config.ts` and `src/config/*` are framework plumbing and acceptable.)
**Remediation:** Import `TIMEOUTS` and substitute `TIMEOUTS.ELEMENT_VISIBLE` / `TIMEOUTS.PAGE_LOAD` etc.

### DEBT-008 — `console.warn` / `console.log` instead of logger
**File:** `src/pages/helpers/wait-helper.ts:31,49,153,185,234`; `src/pages/helpers/file-helper.ts:48`; `src/pages/helpers/percy-helper.ts:31`; `tests/api/objects-crud.spec.ts:18,92`; `tests/api/pla-search.spec.ts:185,217`
**Issue:** Direct `console.*` calls in `src/pages/` and `tests/`. CLAUDE.md: "use `logger.*` methods."
**Remediation:** Route through `createTestLogger(...)` (`logger.action` / `logger.error`) in specs; helpers may inject a logger or use the existing TestLogger utility.

### DEBT-009 — Inline nav-hydration / PLP-wait sequence in ecommerce specs (smoke-helper drift)
**File:** `tests/ecommerce/smoke/navigation-smoke.spec.ts:25,48,51,73,76,98,101,123,126,149,152`; `tests/ecommerce/smoke/cart-smoke.spec.ts:22,66,67,167,168`
**Issue:** These specs call `waitForNavHydration()` + `clickNavLink()` and `waitForPlpUrl()` + `waitForProductGrid()` inline rather than through the centralised `navigateToPlp()` helper (which the PLP/PDP specs already use). Acceptable where a test deliberately asserts a single nav transition (navigation-smoke's purpose), but the cart-smoke loop re-derives the PLP-return sequence.
**Remediation:** Where the goal is "land on a PLP," call `navigateToPlp(...)`; reserve inline `clickNavLink` for tests whose subject *is* the individual nav transition.

### DEBT-010 — Inline `??` nav-label fallback chain
**File:** `tests/ecommerce/smoke/plp-smoke.spec.ts:35,77`; `tests/ecommerce/smoke/navigation-smoke.spec.ts:139`
**Issue:** `site.womensNavLabel ?? site.mensNavLabel ?? site.kidsNavLabel ?? site.saleNavLabel` duplicates `getPreferredNavLabel()` (defined in `smoke-helpers.ts:11` and used elsewhere in the same files).
**Remediation:** Replace with `getPreferredNavLabel(site)`. (Note: the `preferMens` conditional chains in `pdp-smoke.spec.ts`/`cart-smoke.spec.ts` are a *sanctioned* documented pattern in `tests/ecommerce/CLAUDE.md` and are NOT flagged.)

### DEBT-011 — GitHub Actions workflows missing top-level `permissions` block
**File:** `.github/workflows/playwright.yml`; `playwright-with-slack.yml`; `api-restful-tests.yml`; `api-restful-tests-with-slack.yml`; `lighthouse-ci.yml`; `percy-visual-tests.yml` (all six)
**Issue:** No `permissions:` declaration in any workflow → the `GITHUB_TOKEN` defaults to broad/implicit scopes.
**Impact:** Least-privilege violation; a compromised action step or dependency could push commits or modify releases.
**Remediation:** Add a least-privilege block at top level (and widen per-job only as needed):
```yaml
permissions:
  contents: read
```

### DEBT-012 — Missing explicit return type on a public async method
**File:** `src/pages/helpers/storage-helper.ts:9` (`async getAllCookies()`)
**Issue:** Public async method without an explicit `Promise<...>` return type. (Most other flagged matches — `plp-page.ts:155`, `wait-helper.ts:37` etc. — are multi-line signatures where the `): Promise<...>` lands on a later line and grep simply didn't capture it; `getAllCookies()` is the genuine miss.)
**Remediation:** `async getAllCookies(): Promise<Cookie[]> { ... }`.

---

## 🟢 Suggestions (backlog / nice-to-have)

- **DEBT-013** `package.json` — `typescript` is 1 major behind (5.9.3 → 6.0.3) and `@types/node` is 1 major behind (24 → 25); `@playwright/test` 1.59.1 → 1.60.0, `monocart-reporter` 2.10.1 → 2.11.2. None are >2 majors behind, so low urgency; schedule a routine bump.
- **DEBT-014** `tests/api/graphql-examples.spec.ts:14-279+` — the entire file is commented-out example tests (`// test('should …`). Delete it or convert to a documented fixture sample; dead commented code rots.
- **DEBT-015** npm audit — 3 high (`fast-uri`, `systeminformation`, `tmp`) + 8 moderate are all transitive dev-dependency advisories with fixes available via `npm audit fix` (non-breaking). No production runtime exposure (test framework only), hence not Critical.
- **DEBT-016** `tests/api/pla-search.spec.ts:185,217` — `console.log` skip-notices for the documented `productSearch` schema gap; route through `logger.action`/`test.skip(true, reason)` so the signal appears in the report rather than stdout.
- **DEBT-017** Comment hygiene — page-object/spec comment density is well within the 50-line threshold and most comments document non-obvious WHYs (Firefox teardown, Bloomreach popup, staging quirks). No action needed; recorded as a healthy baseline to preserve.

---

## 🚀 Actionable Remediation Roadmap

### Phase 1 — Immediate (fix this week, highest ROI)
1. **[DEBT-002, DEBT-003, DEBT-004 — 3 items, ~2.5 h]** Fix the API-folder contract breaks: correct the `api-mocking-examples.spec.ts` import (or relocate it), add `test.describe.configure({ mode: 'serial' })` to the three specs, and add the `ServicesAZDataShape` interface. Small, isolated, high-clarity fixes that close 3 of 5 Criticals.
2. **[DEBT-001 (triaged subset), DEBT-005 — ~4 h]** Route the plain `locator/click/goto/waitForLoadState` calls in page classes through helpers, fix the `> div > a` selector in `services-az-page.ts`, and annotate the genuine documented exceptions with `// WHY:` so future audits don't re-flag them.

### Phase 2 — Short-term (next sprint)
1. **[DEBT-007, DEBT-008, DEBT-012 — ~2.5 h]** Replace magic timeouts with `TIMEOUTS.*`, swap `console.*` for `logger.*`, and add the missing `getAllCookies()` return type.
2. **[DEBT-011 — ~1 h]** Add `permissions: { contents: read }` to all six workflows; widen per-job where a step genuinely needs write (Slack/Percy comment posting).
3. **[DEBT-009, DEBT-010 — ~1.5 h]** Collapse inline PLP/nav-label sequences in `cart-smoke`/`plp-smoke`/`navigation-smoke` onto `navigateToPlp()` / `getPreferredNavLabel()`.

### Phase 3 — Medium-term (backlog)
1. **[DEBT-006 — ~3 h]** Drive down `any` usage by introducing typed GraphQL response generics across the PLA specs.
2. **[DEBT-013, DEBT-014, DEBT-015, DEBT-016 — ~1 h]** Routine dependency bump, delete the commented `graphql-examples.spec.ts`, run `npm audit fix`, and tidy the skip-notice logging.

---

## ✅ Healthy Areas

- **Build integrity:** `npx tsc --noEmit` passes with **zero errors** — type coverage baseline is solid.
- **POM contract — inheritance & registration:** All 13 page classes extend `BasePage` (`grep "class \w+Page"` — every match carries `extends BasePage`), and every one is registered as a fixture in `src/config/base-test.ts`. No orphan page objects.
- **Firefox teardown intact:** All six ecommerce fixtures (`ecommerceHomePage/NavPage/SearchPage/PLPPage/PDPPage/CartOverlayPage`) navigate to `about:blank` before teardown on Firefox (`base-test.ts:73,80,87,101,109,118`) — the documented Juggler-hang workaround is fully preserved.
- **No `test.only` / `fit` / `fdescribe`** committed anywhere in `tests/` — CI will not silently skip suites.
- **Import discipline (UI side):** No UI spec imports from `@playwright/test` directly; the only matches are the `FullConfig` *type* import in API global setup/teardown (legitimate) and one commented line.
- **No `@constants` alias misuse** — zero matches; the documented `@config/../constants/timeouts` path is honoured.
- **No GraphQL string interpolation** — every `queryWrapped`/`mutateWrapped` uses the variables argument; the only `${}` matches are error-message and URL template literals, not query bodies.
- **No `@ts-ignore`/`@ts-expect-error` suppressions** anywhere in the codebase.
- **No orphan data modules** — every file in `src/data/`, `src/data/api/`, `src/data/ecommerce/` is referenced by at least one spec or page.
- **Smoke-helper centralisation:** `navigateToPlp()` and `getPreferredNavLabel()` are correctly used across `plp-smoke`/`pdp-smoke`/`cart-smoke`; the documented `preferMens` footwear pattern is applied consistently.
- **Data-generator typing:** All `static generate*()` methods in `home-data.ts`, `admin-data.ts`, and `src/data/api/*` carry explicit interface return types — only the one `as const` module (DEBT-004) breaks the pattern.
