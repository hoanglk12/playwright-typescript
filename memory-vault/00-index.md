---
type: index
tags: [memory, index]
last_verified: 2026-06-14
---
# Memory Index

- [[user_profile|User Profile]] — QA engineer building Playwright TypeScript framework; prefers terse interactions; Windows 11 Pro; path C:\Users\Lincoln.Pham\...\playwright-typescript
- [[project_context|Project Context]] — Composition-based POM; GitHub Actions CI; monocart + Slack; Cloudflare Pages; GRA 4-brand API projects (pla-au/skx-au/drm-au/van-au); Ecommerce UI smoke (6 specs, ~200 tests, smoke-helpers.ts)
- [[feedback_preferences|Feedback & Preferences]] — Preferred patterns, corrections, confirmed approaches
- [[project_architecture|Project Architecture]] — BasePage with 9 helpers; dual configs; import rules; fixture system
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
