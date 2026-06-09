---
name: technical-debt-phase1
description: Technical debt audit status — all phases completed through 2026-06-09; only Suggestions remain open
metadata:
  node_type: memory
  type: project
  originSessionId: 3fef18ff-9217-40d8-b62d-b17831c64499
---

Technical debt audit run via `/tech-debt` produced `TECH_DEBT_REPORT.md` (grade C, 2026-06-07). All Critical and Warning items are now resolved. Only Suggestions remain.

## Phase 1 — Critical (COMPLETED 2026-06-07)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-001 | Direct `this.page.*` calls in page classes | Fixed in `home-page.ts`, `insights-page.ts`, `form-drag-and-drop.ts`, `profile-listing-page.ts`, `nav-page.ts`, `plp-page.ts`, `pdp-page.ts`, `services-az-page.ts` |
| DEBT-002 | API spec wrong import (`@config/base-test`) | `api-mocking-examples.spec.ts` — sanctioned exception (uses `page` fixture; `ApiTest` has no `page`); `// WHY:` comment added + TODO to relocate |
| DEBT-003 | Missing `test.describe.configure({ mode: 'serial' })` | Fixed in `objects-crud.spec.ts`, `customer-booking.spec.ts`, `room-booking.spec.ts`; `graphql-examples.spec.ts` remains commented-out |
| DEBT-004 | Untyped exported constants in data module | `services-az-data.ts` — added `ServicesAZDataShape` interface |
| DEBT-005 | Banned hierarchical CSS selector | `services-az-page.ts` — replaced with `getByRole('navigation').locator('li').filter({ has: ... }).getByRole('button')` |

## Phase 2 — Warnings (COMPLETED 2026-06-09)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-007 | Magic timeout numbers | All `5000/10000/15000/20000/30000` in pages + specs replaced with `TIMEOUTS.*` constants |
| DEBT-008 | `console.warn`/`console.log` instead of logger | Helper layer: `// WHY:` comments (no test context). Spec files (`pla-search.spec.ts:185,217`, `objects-crud.spec.ts`): `logger.action(...)` |
| DEBT-009 | Inline nav-hydration sequences | `navigation-smoke.spec.ts` inline sequences — `// WHY:` sanctioned exception (testing per-transition steps) |
| DEBT-010 | Inline `??` nav-label fallback chains | `plp-smoke.spec.ts` and `navigation-smoke.spec.ts` → `getPreferredNavLabel(site)` |
| DEBT-011 | GitHub Actions missing `permissions:` block | All 6 workflows: added `permissions: contents: read` top-level; `playwright-with-slack.yml` test-report job also got `actions: read` |
| DEBT-012 | Missing return type on `getAllCookies()` | `storage-helper.ts` — added `Promise<Cookie[]>` return type |

## Phase 3 Warning item (COMPLETED 2026-06-09)

| DEBT | Issue | Result |
|---|---|---|
| DEBT-006 | Systemic untyped `any` in PLA API specs | 51 tokens removed from 6 files; typed interfaces (ProductVariant, CartItem, UserError, PaymentMethod, etc.) added per-file; `assertNoCriticalErrors` → `errors?: Array<{ path?: unknown }>`; `!gql.errors` antipattern → `!(gql.errors?.length)` (3 instances in `pla-catalog.spec.ts`); `tests/api/CLAUDE.md` updated. 65/65 tests pass. |

## Remaining — Suggestions only (open)

- **DEBT-013:** Routine dep bumps — `typescript` 5.x→6, `@types/node`, `@playwright/test` 1.59→1.60, `monocart-reporter`
- **DEBT-014:** Delete `tests/api/graphql-examples.spec.ts` (entire file is commented-out dead code)
- **DEBT-015:** `npm audit fix` — 3 high + 8 moderate transitive dev-dependency advisories

**Note:** DEBT-016 (pla-search `console.log` skip-notices) was resolved as part of DEBT-008.

## How to continue

Run `/fix-debt DEBT-014` (safe, just a file delete) or `/fix-debt DEBT-015` (`npm audit fix`). DEBT-013 requires verifying breaking changes for a major TypeScript bump — run `/research typescript 5 to 6 migration` first.
