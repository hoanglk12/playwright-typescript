---
name: technical-debt-phase1
description: Technical debt audit status — ALL phases complete as of 2026-06-13; framework grade A, zero open items
type: project
tags: [memory, project]
source_session: 3fef18ff-9217-40d8-b62d-b17831c64499
last_verified: 2026-06-13
---

Technical debt audit run via `/tech-debt` produced `TECH_DEBT_REPORT.md` (originally grade C, 2026-06-07; now grade A). All 17 DEBT items across all 4 phases are resolved. No open items remain.

**Why:** Each phase was fixed across separate sessions (2026-06-09 through 2026-06-13), lint (tsc --noEmit) passed after every batch.

## Phase 1 — Critical (COMPLETED 2026-06-09)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-001 | Direct `this.page.*` calls in page classes | Fixed in `home-page.ts`, `insights-page.ts`, `form-drag-and-drop.ts`, `profile-listing-page.ts`, `nav-page.ts`, `plp-page.ts`, `pdp-page.ts`, `services-az-page.ts` |
| DEBT-002 | API spec wrong import (`@config/base-test`) | `api-mocking-examples.spec.ts` — sanctioned exception (uses `page` fixture; `ApiTest` has no `page`); `// WHY:` comment added + TODO to relocate |
| DEBT-003 | Missing `test.describe.configure({ mode: 'serial' })` | Fixed in `objects-crud.spec.ts`, `customer-booking.spec.ts`, `room-booking.spec.ts` |
| DEBT-004 | Untyped exported constants in data module | `services-az-data.ts` — added `ServicesAZDataShape` interface |
| DEBT-005 | Banned hierarchical CSS selector | `services-az-page.ts` — replaced with `getByRole('navigation').locator('li').filter({ has: ... }).getByRole('button')` |

## Phase 2 — Warnings (COMPLETED 2026-06-09/10)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-007 | Magic timeout numbers | All raw `5000/10000/15000/20000/30000` replaced with `TIMEOUTS.*` constants |
| DEBT-008 | `console.warn`/`console.log` instead of logger | Helper layer: `// WHY:` comments. Spec files: `logger.action(...)` |
| DEBT-009 | Inline nav-hydration sequences | `// WHY:` sanctioned exception comments added |
| DEBT-010 | Inline `??` nav-label fallback chains | `plp-smoke.spec.ts` — `// WHY:` added (Platypus NZ intentional 2-way fallback) |
| DEBT-011 | GitHub Actions missing `permissions:` block | All 6 workflows: `permissions: contents: read` added |
| DEBT-012 | Missing return type on `getAllCookies()` | `storage-helper.ts` — `Promise<Cookie[]>` added |

## Phase 3 — Warning (COMPLETED 2026-06-09)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-006 | Systemic untyped `any` in PLA API specs | 51 tokens removed from 6 files; typed interfaces added per-file; `!gql.errors` antipattern → `!(gql.errors?.length)` |

## Phase 4 — Suggestions (COMPLETED 2026-06-13)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-013 | Stale dependencies | `@playwright/test` 1.59.1→1.60.0, `monocart-reporter` 2.10.1→2.11.2, `@types/node` 24.12.2→24.13.2; `typescript` 5.9.3 is already latest 5.x (TS 6.x skip intentional) |
| DEBT-014 | Dead spec file | `tests/api/graphql-examples.spec.ts` deleted (692-line all-commented); removed from `misc-api` testMatch |
| DEBT-015 | npm audit vulnerabilities | `npm audit fix` reduced 13→5 vulnerabilities; remaining 5 are all in `@lhci/cli` transitive tree — unfixable without destructive `--force` downgrade of `@lhci/cli` 0.15.1→0.1.0 |
| DEBT-016 | `console.log` in pla-search spec | Already routed through `logger.action`; confirmed no action needed |

## Residual (not a DEBT item — watch list)

- **`@lhci/cli` transitive advisories** (5 vulns: `tmp` high, `uuid`/`brace-expansion` moderate, 2 low): deferred until upstream `@lhci/cli@0.16.x` releases. No production runtime exposure.
- **TypeScript 6.x**: held on 5.x until ecosystem stabilises (expected Q3–Q4 2026). Run `/research typescript 5 to 6 migration` before bumping.

## How to apply

No action needed — all debt is closed. Re-run `/tech-debt` if major new features are added to re-baseline the audit.
