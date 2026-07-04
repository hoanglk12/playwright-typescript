---
description: Run UI tests locally — smart command selection based on arguments
---

Run the UI test suite.

**Select the command based on the argument provided:**

| If argument contains | Run |
|---|---|
| Empty or "all" | `npm run test:simple` (chromium, 1 worker) |
| "frontsite" | `npm run test:simple:frontsite` |
| "admin" or "login" | `npm run test:simple:admin` |
| "headed" | `npm run test:simple:headed` |
| "debug" | `npm run test:simple:debug` |
| "all browsers" or "cross-browser" | `npm run test:parallel:all` |
| "parallel" | `npm run test:parallel` (50% workers) |
| A `.spec.ts` path | `npx playwright test <path> --project=chromium --workers=1` |
| A grep pattern or TC number | `npx playwright test --grep "<pattern>" --project=chromium --workers=1` |
| "testing" environment | `npm run test:testing` |
| "staging" environment | `npm run test:staging` |

**After the run completes:**
1. Report: ✅ passed / ❌ failed / ⏭ skipped counts across all browsers/workers
2. If any tests failed:
   - List the failing test names and files
   - Offer: "Run the `fix-test` workflow to invoke the healer, or `npm run report` to open the HTML report"
3. If all passed: confirm and offer to open the report with `npm run report`

**Never run:** `test:production`, `test:parallel:max` (100% workers), or any Percy/LHCI command.
