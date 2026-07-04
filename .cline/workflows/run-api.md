---
description: Run API tests locally — smart command selection based on arguments
---

Run the API test suite.

**Select the command based on the argument provided:**

| If argument contains | Run |
|---|---|
| Empty or "all" | `npm run test:api` |
| "booker" | `npm run test:api:booker` |
| "device" or "objects" | `npm run test:api:device-booker` |
| "debug" | `npm run test:api:debug` |
| "ui" | `npm run test:api:ui` |
| A `.spec.ts` path | `npx playwright test <path> --config=api.config.ts --workers=1` |
| A grep pattern | `npx playwright test --config=api.config.ts --grep "<pattern>" --workers=1` |
| "testing" environment | `npm run test:api:testing` |
| "staging" environment | `cross-env NODE_ENV=staging npm run test:api` |

**After the run completes:**
1. Parse the output and report: ✅ passed / ❌ failed / ⏭ skipped counts
2. If any tests failed:
   - List the failing test names
   - Offer: "Run the `fix-test` workflow to invoke the healer"
3. If all passed: confirm and offer to open the report with `npm run report:api`

**Never run:** `test:production`, `WORKERS=100%`, or any Percy/LHCI command.
