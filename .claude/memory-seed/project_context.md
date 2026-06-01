---
name: project-context
description: "Framework architecture decisions, CI shape, active initiatives, key tooling"
metadata: 
  node_type: memory
  type: project
  originSessionId: 551a0925-f8d8-4f42-bbe1-663d6c154edd
---

Playwright TypeScript automation framework for Fieldfisher (law firm) web properties. Covers frontsite, admin, and ecommerce areas with a composition-based Page Object Model.

**Architecture:** `BasePage` with 9 helper instances (elements, waits, style, frames, files, storage, network, tables, percy). Never call `page.locator()` directly in page classes — always use helpers.

**CI/CD:** GitHub Actions. Two main workflows:
- `playwright-with-slack.yml` — UI tests (matrix: windows + macos), monocart merge in `test-report` job, Slack notification
- `api-restful-tests-with-slack.yml` — API tests (serial, 1 worker), monocart API report, Slack notification

**Reporters:** html + json + junit + list + monocart-reporter (all additive). monocart outputs at `monocart-report/` (UI) and `monocart-api-report/` (API). Trend via `actions/cache` + `MONOCART_TREND_FILE`.

**Completed (2026-05-07):** monocart reports hosted on Cloudflare Pages. Report links in Slack now point to Cloudflare-hosted HTML reports.

**Test environments:** testing (default), staging, production. Env loaded from `.env.{NODE_ENV}`.

**Key scripts:** `npm test` (UI, chromium+firefox), `npm run test:api` (API), `npm run test:simple` (chromium only, 1 worker).

**PLA (Platypus Shoes) GraphQL API tests (added 2026-05-15, expanded through 2026-06-01):**
- Target: `https://stag-platypus-au.accentgra.com/graphql` (Magento 2 / Adobe Commerce)
- 13 spec files in `tests/api/`: `pla-account-creation-signin`, `pla-cart_minicart`, `pla-my-details`, `pla-support-features`, `pla-authentication`, `pla-search`, `pla-customer-profile`, `pla-catalog`, `pla-address-book-countries`, `pla-wishlist`, `pla-checkout-shipping`, `pla-checkout-billing-payment`, `pla-place-order`
- Shared test state via `tests/api/shared-state.ts` — **singleton `TestState` class** (getters/setters throw on empty); token, customerId, cartId, addressId fields
- **Auth helper:** `tests/api/api-test-helpers.ts` exports `signInAndStoreToken(client, logger)` — canonical always-fresh auth bootstrap; used in all PLA spec `beforeAll` blocks
- Test data at `src/data/api/pla-test-data.ts` — **factory function `createPlaTestData()`** (not module-level init); call once in `beforeAll`; all PLA specs use `const plaTestData = createPlaTestData()` at module level
- `api.config.ts` `actionTimeout` raised to **30 000 ms** (was 15 000) to cover slow staging ops like `placeOrder`
- `api-scenarios-report.html` at `Guideline/api-scenarios-report.html`: 38 GraphQL operations documented, **37 covered, 1 gap** (customer.orders P1) as of 2026-05-27 — see [[pla-api-testing]] for patterns and API quirks

**Ecommerce UI smoke tests (6 spec files, ~192 tests as of 2026-06-01):**
- `homepage-smoke.spec.ts`: E2E-HOME-001/002/003 — 3 × 8 = 24 tests
- `navigation-smoke.spec.ts`: E2E-NAV-001/002/003/004/005/009 — ~6 × 8 = 48 tests
- `search-smoke.spec.ts`: E2E-SRCH-001/002 — 2 × 8 = 16 tests
- `plp-smoke.spec.ts`: E2E-PLP-001/004/006/011/012 — 5 × 8 = 40 tests
- `pdp-smoke.spec.ts`: E2E-PDP-001/002/004/005/006/007 — 6 × 8 = 48 tests
- `cart-smoke.spec.ts`: E2E-CART-001 (empty mini cart) + E2E-CART-002 (ATC count) — 2 × 8 = 16 tests
- **Shared helpers:** `tests/ecommerce/smoke/smoke-helpers.ts` exports `getPreferredNavLabel(site, preferMens)` and `navigateToPlp(navPage, plpPage, site, navLabel)` — used by cart, pdp, and plp smoke specs to reduce duplication
- Discovery report at `Guideline/E2E_DISCOVERY_REPORT.md`: 108 scenarios across 13 feature areas; E2E-CART-003 through E2E-CART-011 remain
- All specs use `test.describe.serial`; see [[ecommerce-pdp-page-gotchas]] for PDP/cart patterns

**CAPTCHA solving integration (researched 2026-05-31, not yet implemented):**
- Research report: `specs/captcha-solving-integration.html` — covers 2captcha official TS SDK, types: Cloudflare Turnstile, reCAPTCHA v2/v3, hCaptcha
- No CaptchaHelper class or test files exist in the repo yet — report is the blueprint for a future `fixture-only` helper

**E2E-CART-002 implementation (2026-05-31):**
- Scans up to 5 products on the initial PLP (WOMENS for most, MENS for Skechers/Vans NZ via `preferMens`) with quick `getAvailableSizes()` after each `waitForPdpLoad()`
- Final `waitForSizeButtonsToRender()` applied after the scan if still empty (handles async size render)
- `getMiniCartCount()` reads from aria-label first (`"You have N item(s)"`) then DOM badge — aria-label updates faster for Vans AU under serial batch load
- Key `pdp-page.ts` timeouts changed: `waitForMiniCartCountIncrement` → `NETWORK_IDLE_SLOW` (45s); `waitForSizeButtonsToRender` → `ELEMENT_VISIBLE` (CI-aware); `addToCart()` stabilises with `waitFor(attached)` before click
- Platypus AU MENS PLP starts with socks — not a valid footwear fallback; scan WOMENS positions 0–4 instead
