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

**GRA GraphQL API tests — Phase 1 live (2026-06-10):**
- **15 shared spec files** in `tests/api/pla-*.spec.ts` run across 4 AU brand projects: `pla-au`, `skx-au`, `drm-au`, `van-au`
- Site-specific config injected via `testInfo.project.metadata.siteCode` → `SiteContext` from `src/data/api/sites.ts`
- **Import rule:** all `pla-*.spec.ts` use `graTest as test` from `./gra-test` (NOT `apiTest`)
- `api.config.ts` has 5 projects: `pla-au`, `skx-au`, `drm-au`, `van-au` (all match `pla-*.spec.ts`) + `misc-api` (restful-booker, objects-crud). (`graphql-examples.spec.ts` deleted 2026-06-11.)
- `shared-state.ts` re-keyed to `Map<siteCode, TestState>` — `getStateForSite(siteCode)` for per-brand isolation
- `signInAndStoreToken(client, logger, site, siteState)` — new signature
- `api.config.ts` `workers: 4` (2026-06-11) — 4 brand projects run concurrently; serial within each brand; `fullyParallel: false` kept
- `api.config.ts` `actionTimeout` = **30 000 ms** (covers slow staging ops like `placeOrder`)
- drm-au/van-au: `testIgnore: ['**/pla-loyalty-rewards.spec.ts']` — loyalty feature not deployed; excluded from report entirely
- `api-scenarios-report.html` at `Guideline/api-scenarios-report.html` — see [[pla-api-testing]] for patterns and API quirks

**Ecommerce UI smoke tests (6 spec files, ~200 tests as of 2026-06-04):**
- `homepage-smoke.spec.ts`: E2E-HOME-001/002/003 — 3 × 8 = 24 tests
- `navigation-smoke.spec.ts`: E2E-NAV-001/002/003/004/005/009 — ~6 × 8 = 48 tests
- `search-smoke.spec.ts`: E2E-SRCH-001/002 — 2 × 8 = 16 tests
- `plp-smoke.spec.ts`: E2E-PLP-001/004/006/011/012 — 5 × 8 = 40 tests
- `pdp-smoke.spec.ts`: E2E-PDP-001/002/004/005/006/007 — 6 × 8 = 48 tests
- `cart-smoke.spec.ts`: E2E-CART-001 (empty mini cart) + E2E-CART-002 (ATC count) + E2E-CART-003 (mini cart overlay opens) — 3 × 8 = 24 tests
- **Shared helpers:** `tests/ecommerce/smoke/smoke-helpers.ts` exports `getPreferredNavLabel(site, preferMens)` and `navigateToPlp(navPage, plpPage, site, navLabel)` — used by cart, pdp, and plp smoke specs to reduce duplication
- Discovery report at `Guideline/E2E_DISCOVERY_REPORT.md`: 108 scenarios across 13 feature areas; E2E-CART-004 through E2E-CART-011 remain
- **Serial mode removed (2026-06-07):** All 6 smoke specs changed from `test.describe.serial` to `test.describe` — fixtures are test-scoped (each test gets its own browser context), so serial mode only added destructive cascade-skip behaviour with no benefit. See [[ecommerce-pdp-page-gotchas]] for PDP/cart patterns.

**CAPTCHA solving integration (researched 2026-05-31, not yet implemented):**
- Research report: `specs/captcha-solving-integration.html` — covers 2captcha official TS SDK, types: Cloudflare Turnstile, reCAPTCHA v2/v3, hCaptcha
- No CaptchaHelper class or test files exist in the repo yet — report is the blueprint for a future `fixture-only` helper

**E2E-CART-002 implementation (2026-05-31):**
- Scans up to 5 products on the initial PLP (WOMENS for most, MENS for Skechers/Vans NZ via `preferMens`) with quick `getAvailableSizes()` after each `waitForPdpLoad()`
- Final `waitForSizeButtonsToRender()` applied after the scan if still empty (handles async size render)
- `getMiniCartCount()` reads from aria-label first (`"You have N item(s)"`) then DOM badge — aria-label updates faster for Vans AU under serial batch load
- Key `pdp-page.ts` timeouts changed: `waitForMiniCartCountIncrement` → `NETWORK_IDLE_SLOW` (45s); `waitForSizeButtonsToRender` → `ELEMENT_VISIBLE` (CI-aware); `addToCart()` stabilises with `waitFor(attached)` before click
- Platypus AU MENS PLP starts with socks — not a valid footwear fallback; scan WOMENS positions 0–4 instead

**E2E-CART-003 implementation (2026-06-04):**
- New page object `EcommerceCartOverlayPage` at `src/pages/ecommerce/cart-overlay-page.ts`; registered as `ecommerceCartOverlayPage` fixture (with Firefox teardown workaround)
- `isOverlayVisible()` uses three-part gate: `aside/[role="complementary"]/role="dialog"/class*drawer` + `position:fixed/absolute` + CTA regex — required because Platypus AU mini cart renders as `<aside>`, not `<dialog>`, and `[class*="cart"]` alone matches persistent header chrome
- Test seeds cart (full ATC scan) before clicking cart icon; checks if overlay auto-opened first; soft-asserts final visibility
- First run: 6/8 passed; Vans AU intermittently fails (Bloomreach popup may intercept `clickCartIcon()` after ATC)
