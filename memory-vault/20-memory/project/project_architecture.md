---
name: Project Architecture
description: Core architectural decisions — composition helpers, fixture system, dual configs, import rules
type: project
tags: [memory, project]
last_verified: 2026-06-02
---

Playwright TypeScript framework. Key facts:

- **Composition not inheritance**: `BasePage` delegates to 10 helper instances (`this.waits`, `this.elements`, `this.style`, `this.frames`, `this.files`, `this.storage`, `this.network`, `this.tables`, `this.dom`, `this.overlays`). `PercyHelper` is **not** a BasePage field — it is available only as the `percyHelper` fixture in tests. `ConsoleHelper` is also **not** a BasePage field — it is available only as the `consoleHelper` fixture in tests. New browser interactions go in the helpers, not `BasePage` directly.
  - `this.dom` (`DomScanHelper`): selector-based DOM queries — `count(selector)`, `hasAnyVisible(selectors[])`, `firstVisible(selectors[])`, `getAllTextContents(selector)`, `getAllAttributes(selector, attr)`, `hasAriaLabel(selector, label)`, `safeGetText(selector)`.
  - `this.overlays` (`OverlayHelper`): overlay/modal dismissal via a fixed close-selector list. **Gap**: no Escape-key fallback, no container-scoped button targeting — the 3 Bloomreach inline dismissal methods in ecommerce page objects cannot migrate yet without extending the helper.
- **Import rule**: Always `import { test, expect } from '@config/base-test'` in test files — never `@playwright/test` directly. The base-test extends with all page fixtures.
- **Two configs**: `playwright.config.ts` (UI, all tests except `**/api/**`) and `api.config.ts` (API only, 1 worker serial).
- **Firefox teardown**: All 8 ecommerce fixtures (`ecommerceHomePage`, `ecommerceNavPage`, `ecommerceSearchPage`, `ecommercePLPPage`, `ecommercePDPPage`, `ecommerceCartOverlayPage`, `ecommerceAccountModalPage`, `ecommerceErrorPage`, `ecommerceCheckoutPage`) navigate to `about:blank` before teardown on Firefox — intentional workaround for Juggler/service-worker hang. Do not remove from any of them.
- **Multi-app**: frontSiteUrl (Accent Group frontsite), adminUrl (guru99 bank), apiBaseUrl (restful-booker).
- **Shared state**: `tests/api/shared-state.ts` is a **singleton `TestState` class** with typed getters/setters (setters throw on empty). Module-level function exports provide backward-compat API.
- **Test data**: All test data in `src/data/`, never hardcoded in spec files. Static = const objects; dynamic = generators. PLA test data uses `createPlaTestData()` factory — returns a fresh self-consistent instance; call once at module level.
- **API test helpers**: `tests/api/api-test-helpers.ts` — `signInAndStoreToken(client, logger)` is the canonical PLA auth bootstrap. All PLA spec `beforeAll` blocks call this.
- **Ecommerce smoke helpers**: `tests/ecommerce/smoke/smoke-helpers.ts` — `getPreferredNavLabel(site, preferMens)` and `navigateToPlp(navPage, plpPage, site, navLabel)` reduce duplication across cart/pdp/plp smoke specs.
- **Global lifecycle**: Setup validates env + browser installs + connectivity. Teardown archives artifacts in CI.

**Why:** Framework migrated from Maven Selenium hybrid. Composition pattern chosen to avoid fragile deep inheritance chains.

**How to apply:** When adding features, check which helper class owns the behaviour before touching BasePage. When writing tests, always verify the fixture is registered in base-test.ts.
