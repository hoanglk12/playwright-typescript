---
name: technical-debt-phase1
description: Phase 1 technical debt fixes (DEBT-001 to DEBT-005) and what remains open — quick reference for future debt sessions
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fef18ff-9217-40d8-b62d-b17831c64499
---

Technical debt audit run via `/tech-debt` produced `TECH_DEBT_REPORT.md` (grade C). Phase 1 fixes applied via `/fix-debt phase:1` on 2026-06-07.

## What was fixed (Phase 1 Critical)

| DEBT | Issue | Files |
|---|---|---|
| DEBT-001 | Direct `this.page.*` calls in page classes | `home-page.ts`, `insights-page.ts`, `form-drag-and-drop.ts`, `profile-listing-page.ts`, `nav-page.ts`, `plp-page.ts`, `pdp-page.ts`, `services-az-page.ts` |
| DEBT-002 | API spec uses wrong import (`@config/base-test`) | `graphql-examples.spec.ts` (commented-out file, added note only) |
| DEBT-003 | Missing `test.describe.configure({ mode: 'serial' })` in API specs | `objects-crud.spec.ts`, `customer-booking.spec.ts`, `room-booking.spec.ts` |
| DEBT-004 | Untyped exported constants in data module | `services-az-data.ts` — added `ServicesAZDataShape` interface |
| DEBT-005 | Banned hierarchical CSS selector in page class | `services-az-page.ts` — replaced with `getByRole('navigation').locator('li').filter({ has: ... }).getByRole('button')` |

## Post-fix critical corrections (applied immediately after qa-code-reviewer)

- **`objects-crud.spec.ts` describe nesting:** Premature `});` at old line 96 was closing POST Operations early; TC_06 was at parent level; `afterEach` cleanup didn't cover PUT/DELETE operations. Full file rewrite to restore correct nesting.
- **`services-az-page.ts` inline selectors:** Two `this.elements.locator('main h1')` calls were inline — added `private readonly pageMainHeading = 'main h1'` field and replaced both references.

## What is BLOCKED (DEBT-002 for api-mocking-examples.spec.ts)

`tests/api/api-mocking-examples.spec.ts` cannot be fixed in-place. It uses the `page` fixture throughout — it's a UI test misplaced in `tests/api/`. The import cannot be changed to `ApiTest` because `ApiTest` has no `page` fixture.

**Fix needed:** Relocate the entire file to `tests/frontsite/` (or `tests/ecommerce/`), then update the import to `@config/base-test`. Until then, DEBT-002 is only partially resolved.

## What remains open (Phase 2 + 3)

Phase 2: DEBT-007 (missing interfaces), DEBT-008 (magic numbers), DEBT-009 (error handling), DEBT-010 (missing logs), DEBT-011 (CI config)
Phase 3: DEBT-006 (test isolation), DEBT-013 through DEBT-016

**Why:** Phase 2/3 are lower severity (Warning/Info) and were not included in the Phase 1 run.

**How to apply:** Run `/fix-debt phase:2` to continue. Read `TECH_DEBT_REPORT.md` for full DEBT item details before starting.
