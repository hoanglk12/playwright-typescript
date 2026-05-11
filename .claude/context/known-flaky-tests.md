# Known Flaky / Skipped Tests

## Permanently skipped

| Test file | Condition | Reason |
|---|---|---|
| `tests/frontsite/form-drag-and-drop.spec.ts` | `process.env.CI` | Target page URL unstable/deprecated in CI — runs locally only |
| `tests/ecommerce/smoke/plp-smoke.spec.ts` | per-site `test.skip(true, ...)` | Skip fires per iteration when `womensNavLabel`/`mensNavLabel`/`saleNavLabel` is not set for a storefront |

## Conditionally skipped (data-dependent)

| Test file | Condition | Reason |
|---|---|---|
| `tests/api/restful-booker.spec.ts` | `!ids.length` | Skips if no bookings exist on the API — external service state |
| `tests/api/restful-booker.spec.ts` | `!bookingId` | Downstream tests skip if create-booking test fails |

## Known environment issues

- **Restful Booker API** (`restful-booker.herokuapp.com`) is a public demo — occasionally cold-starts or rate-limits. Run `npm run test:api:booker` in isolation if intermittent 503s appear.
- **GraphQL endpoint** (`stag-platypus-au.accentgra.com`) is staging-only — not available from production env.

## Adding new entries

When a test becomes persistently flaky, add a row here with:
- File + test name
- Failure condition (selector stale? network timeout? race condition?)
- Workaround / tracking ticket
