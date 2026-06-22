---
type: index
tags: [memory, index]
last_verified: 2026-06-15
---
# Memory Index

- [[user_profile|User Profile]] — QA engineer building Playwright TypeScript framework; prefers terse interactions; Windows 11 Pro; path C:\Users\Lincoln.Pham\...\playwright-typescript
- [[project_context|Project Context]] — Composition-based POM; GitHub Actions CI; monocart + Slack; Cloudflare Pages; GRA 4-brand API projects (pla-au/skx-au/drm-au/van-au); Ecommerce UI smoke (6 specs, ~200 tests, smoke-helpers.ts)
- [[feedback_preferences|Feedback & Preferences]] — Preferred patterns, corrections, confirmed approaches
- [[project_architecture|Project Architecture]] — BasePage with 10 helpers (added this.dom + this.overlays 2026-06-22); ConsoleHelper is fixture-only; dual configs; import rules; fixture system
- [[project_context_engineering|Context Engineering Setup]] — CLAUDE.md, skills, settings.json state as of 2026-04-22
- [[gra-api-testing|GRA API Testing]] — GRA multi-brand Phase 1 (4 AU projects); graTest fixture; signInAndStoreToken(client,logger,site,siteState); 15 gra-*.spec.ts shared suite; staging API quirks
- [[ecommerce-pdp-page-gotchas|Ecommerce PDP Page Gotchas]] — 9 patterns: Bloomreach popup (Vans AU), Dr. Martens gallery, dual-h1, swatch goto(), gallery wait, cart count (aria-label fast path + NETWORK_IDLE_SLOW + addToCart stabilisation), preferMens nav-label, Platypus AU nav pitfalls (MENS=socks), mini cart overlay detection (aside/complementary + fixed/absolute + CTA gate)
- [[technical_debt_phase1|Technical Debt Status]] — All Critical + Warning items resolved (Phases 1–3, 2026-06-09); DEBT-014/016 resolved 2026-06-11; open: DEBT-013 dep bumps, DEBT-015 npm audit
- [[ecommerce-storefronts|Ecommerce Storefronts]] — 8 brands (AU/NZ), staging URLs, nav label spelling, preferMens brands, API siteCode map, per-brand DOM quirks
- [[fixture-registry|Fixture Registry]] — All 14 UI fixtures + API fixtures; Firefox teardown list (6 ecommerce); softExpect vs softAssert; registration steps
- [[test-conventions|Test Conventions]] — TC_XX vs E2E naming; no-rename rule; tag placement in describe(); serial mode rules per suite type; import rules
- [[typescript-coding-rules|TypeScript Coding Rules]] — errors?.length guard; optional chaining inside length checks; module-level let initializers; GraphQL string hoisting; AuthType enum; named interfaces
- [[execution-config|Execution Config]] — fullyParallel strategy; 4 API workers; Firefox testIgnore in CI; API_SUITE_SETUP timeout gotcha; retries; forbidOnly; OS matrix
- [[advisor-nudge-mechanism|Advisor Nudge Mechanism]] — PostToolUse hook: ≥3 repeated test runs or file edits + 90s floor → injects additionalContext nudging advisor() call; resets on advisor() call; CLAUDE.md §5 lists 7 immediate-trigger patterns
- [[gra-storefront-tech-notes|GRA Storefront Tech Notes]] — Live browser investigation (2026-06-15): Magento PWA Studio 9/GRA 10, GraphQL-GET only, styled-components hashed classes, no SW, no nav landmark, no data-testid, Skechers empty h1 bug, Vans Bloomreach popup (#popup-close), dataLayer patterns, route-block list, cart button [aria-label*="cart" i]
- [[gra-integration-test-report|GRA Integration Test Report]] — INT-001–010 canonical scenarios for 8 GRA storefronts; ROI matrix; system boundaries; per-brand gotchas; report at docs/gra-integration-test-scenarios.html
- [[playwright-161-and-helper-migration|Playwright 1.61 + Helper Migration]] — isVisible({timeout}) deprecation fix; this.dom.count() replaces page.evaluate querySelectorAll; waitForUrlPredicate replaces page.waitForURL(fn); OverlayHelper API gap
- [[ecommerce-auth-modal-gotchas|Ecommerce Auth Modal Gotchas]] — Bloomreach addLocatorHandler, CMS block click discriminator, account toggle locator strategy, Firefox CI exclusion, modal title race condition, brand heading derivation, account panel detection; AUTH-010 uses fresh accounts (testAccounts for Vans/Dr.Martens broken on staging)
- [[smoke-helpers-patterns|Smoke Helpers Patterns]] — 7 exports in smoke-helpers.ts; Flavor B stays inline; findProductWithAvailableSizes uses cart structure; shouldPreferMens vs skechers-only; never test.skip() inside helper; PDP-005 atcEnabled re-check
