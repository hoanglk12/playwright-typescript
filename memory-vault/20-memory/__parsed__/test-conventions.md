---
name: test-conventions
description: "Test naming patterns, tag placement, serial mode rules, and the no-rename policy"
type: feedback
tags: [memory, feedback]
last_verified: 2026-06-12
---

## Test Naming Patterns

Three naming patterns exist in the codebase. Match the pattern of the suite you're extending.

| Pattern | Used in | Example |
|---|---|---|
| `TC_XX - Description` | All new tests; API tests; frontsite/admin tests | `TC_01 - Should fetch resource by ID` |
| `E2E-{DOMAIN}-{NNN}-{site}` | Ecommerce smoke suite | `E2E-CART-002-platypus-au` |
| `PLA_OperationName - description` | Legacy pla-account-creation-signin only | `PLA_CreateAccount - valid data` |

**Do not rename existing tests.** Renaming breaks CI tag filtering and monocart trend history (monocart matches by test title to compute pass/fail trends).

**New tests:** always use `TC_XX - Description` for API/UI tests; `E2E-{DOMAIN}-{NNN}-{site}` for ecommerce smoke specs that extend an existing `E2E-` suite.

## Tag Placement

Tags go in the `test.describe()` name string — **not** in individual `test()` titles.

```ts
// CORRECT
test.describe('Feature Name @smoke @regression', () => {
  test('TC_01 - Description', async ({ page }) => { ... });
});

// WRONG — tags in test title don't filter correctly
test.describe('Feature Name', () => {
  test('TC_01 - Description @smoke', async ({ page }) => { ... });
});
```

**Tag glossary:**

| Tag | Used for |
|---|---|
| `@smoke` | Critical path, runs in CI smoke pass |
| `@regression` | Full regression suite |
| `@critical` | Business-critical, paged on failure |
| `@frontsite` | Fieldfisher frontsite area |
| `@admin` | Admin/login area |
| `@ecommerce` | Ecommerce storefront tests |
| `@api` | API test suite |
| `@graphql` | GraphQL-specific tests |

## Serial Mode Rules

**GRA API specs (`pla-*.spec.ts`):** Do NOT add `test.describe.configure({ mode: 'serial' })`. Sequential ordering is guaranteed by `fullyParallel: false` in `api.config.ts`. Serial mode causes cascade-skips on failure — one failed test skips all subsequent ones, hiding signal.

**Non-GRA API specs** (`restful-booker.spec.ts`, `objects-crud.spec.ts`): retain `test.describe.configure({ mode: 'serial' })` — these specs have inter-test state dependencies.

**Ecommerce smoke specs:** Do NOT use serial mode. All 6 smoke specs use plain `test.describe` (serial mode removed 2026-06-07). Each test gets its own browser context via test-scoped fixtures — no shared state, so serial adds only cascade-skip risk with no benefit.

**UI frontsite/admin specs:** no serial mode needed. Tests are independent by design.

## Import Rules

| Context | Import from |
|---|---|
| UI test files | `@config/base-test` |
| GRA API specs (`pla-*.spec.ts`) | `./gra-test` (as `graTest`) |
| Non-GRA API specs | `../../src/api/ApiTest` (as `apiTest`) |
| **Never** | `@playwright/test` directly in test files |

Importing from `@playwright/test` directly loses all custom fixtures.

## Test Data Rule

Never hardcode test data in spec files. All data goes in `src/data/`:
- Static expected values → `const` objects with a named interface
- Dynamic/random data → generator class/function with explicit return type
- API test data → `src/data/api/` one file per domain
- Ecommerce config → `src/data/ecommerce/storefronts.ts`

**Why:** hardcoded strings in specs make bulk updates and multi-brand expansion impossible.
