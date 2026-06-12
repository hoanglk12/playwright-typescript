# Memory Index

- [User Profile](user_profile.md) — QA engineer building Playwright TypeScript framework; prefers terse interactions; Windows 11 Pro; path C:\Users\Lincoln.Pham\...\playwright-typescript
- [Project Context](project_context.md) — Composition-based POM; GitHub Actions CI; monocart + Slack; Cloudflare Pages; GRA 4-brand API projects (pla-au/skx-au/drm-au/van-au); Ecommerce UI smoke (6 specs, ~200 tests, smoke-helpers.ts)
- [Feedback & Preferences](feedback_preferences.md) — Preferred patterns, corrections, confirmed approaches
- [Project Architecture](project_architecture.md) — BasePage with 9 helpers; dual configs; import rules; fixture system
- [Context Engineering Setup](project_context_engineering.md) — CLAUDE.md, skills, settings.json state as of 2026-04-22
- [PLA API Testing](pla-api-testing.md) — GRA multi-brand Phase 1 (4 AU projects); graTest fixture; signInAndStoreToken(client,logger,site,siteState); 15 pla-*.spec.ts shared suite; staging API quirks
- [Ecommerce PDP Page Gotchas](ecommerce-pdp-page-gotchas.md) — 9 patterns: Bloomreach popup (Vans AU), Dr. Martens gallery, dual-h1, swatch goto(), gallery wait, cart count (aria-label fast path + NETWORK_IDLE_SLOW + addToCart stabilisation), preferMens nav-label, Platypus AU nav pitfalls (MENS=socks), mini cart overlay detection (aside/complementary + fixed/absolute + CTA gate)
- [Technical Debt Status](technical_debt_phase1.md) — All Critical + Warning items resolved (Phases 1–3, 2026-06-09); DEBT-014/016 resolved 2026-06-11; open: DEBT-013 dep bumps, DEBT-015 npm audit
- [Ecommerce Storefronts](ecommerce-storefronts.md) — 8 brands (AU/NZ), staging URLs, nav label spelling, preferMens brands, API siteCode map, per-brand DOM quirks
- [Fixture Registry](fixture-registry.md) — All 14 UI fixtures + API fixtures; Firefox teardown list (6 ecommerce); softExpect vs softAssert; registration steps
- [Test Conventions](test-conventions.md) — TC_XX vs E2E naming; no-rename rule; tag placement in describe(); serial mode rules per suite type; import rules
- [TypeScript Coding Rules](typescript-coding-rules.md) — errors?.length guard; optional chaining inside length checks; module-level let initializers; GraphQL string hoisting; AuthType enum; named interfaces
- [Execution Config](execution-config.md) — fullyParallel strategy; 4 API workers; Firefox testIgnore in CI; API_SUITE_SETUP timeout gotcha; retries; forbidOnly; OS matrix
