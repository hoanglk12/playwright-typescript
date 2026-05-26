---
name: Project Context
description: Framework architecture decisions, CI shape, active initiatives, key tooling
type: project
---
Playwright TypeScript automation framework for Fieldfisher (law firm) web properties. Covers frontsite, admin, and ecommerce areas with a composition-based Page Object Model.

**Architecture:** `BasePage` with 9 helper instances (elements, waits, style, frames, files, storage, network, tables, percy). Never call `page.locator()` directly in page classes — always use helpers.

**CI/CD:** GitHub Actions. Two main workflows:
- `playwright-with-slack.yml` — UI tests (matrix: windows + macos), monocart merge in `test-report` job, Slack notification
- `api-restful-tests-with-slack.yml` — API tests (serial, 1 worker), monocart API report, Slack notification

**Reporters:** html + json + junit + list + monocart-reporter (all additive). monocart outputs at `monocart-report/` (UI) and `monocart-api-report/` (API). Trend via `actions/cache` + `MONOCART_TREND_FILE`.

**Completed (2026-05-07):** monocart reports hosted on Cloudflare Pages. Cloudflare was chosen over Netlify after research (see `specs/monocart-cloudflare-hosting.research.md`). Report links in Slack now point to Cloudflare-hosted HTML reports.

**Test environments:** testing (default), staging, production. Env loaded from `.env.{NODE_ENV}`.

**Key scripts:** `npm test` (UI, chromium+firefox), `npm run test:api` (API), `npm run test:simple` (chromium only, 1 worker).

**PLA (Platypus Shoes) GraphQL API tests (added 2026-05-15, expanded through 2026-05-26):**
- Target: `https://stag-platypus-au.accentgra.com/graphql` (Magento 2 / Adobe Commerce)
- 12 spec files in `tests/api/`: `pla-account-creation-signin`, `pla-cart_minicart`, `pla-my-details`, `pla-support-features`, `pla-authentication`, `pla-search`, `pla-customer-profile`, `pla-catalog`, `pla-address-book-countries`, `pla-wishlist`, `pla-checkout-shipping`, `pla-checkout-billing-payment`
- Shared test state across PLA files via `tests/api/shared-state.ts` (token, customerId, cartId, addressId)
- Test data at `src/data/api/pla-test-data.ts` — generates unique email per test run; all PLA specs reuse `getTestEmail()` to stay in sync
- `api-scenarios-report.html` at `Guideline/api-scenarios-report.html`: 38 GraphQL operations documented, **34 covered, 4 gaps** as of 2026-05-26 — see [[pla-api-testing]] for patterns and API quirks
