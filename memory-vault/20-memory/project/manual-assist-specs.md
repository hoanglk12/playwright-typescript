---
name: manual-assist-specs
description: "tests/manual/ convention — one-off Playwright specs that help a tester run a manual Xray case (e.g. GRA-6266); gitignored, excluded from CI, run via manual.config.ts, scaffolded with /new-manual-test"
type: project
tags: [memory, project, manual-testing, xray, gra-6040, playwright-config]
last_verified: 2026-10-09
---

# Manual-Assist Specs (`tests/manual/`)

Set up 2026-10-09 so a tester can run a single manual Xray case with Playwright support: network simulation (hold, GraphQL error, HTTP 500, abort), a request timeline, and automatic sign-in. The script then calls `page.pause()` and the tester does the UI steps by hand. Each case runs **once**, is **never committed**, and **never runs in CI**. The rules live in `tests/manual/CLAUDE.md`; the starting point is `tests/manual/_template.ts`.

## Isolation (three layers, keep all of them)

- `.gitignore` → `/tests/manual/*`, with `!` negations for `tests/manual/CLAUDE.md` and `tests/manual/_template.ts` only, plus `/manual-report/`. Keep the folder flat, because a negation cannot re-include a file inside an ignored subdirectory. `git add -A` does not stage case specs.
- `playwright.config.ts` → `"**/tests/manual/**"` is added to the global `testIgnore` **and** to every project's `testIgnore` (chromium, firefox CI branch, firefox local branch), because project-level arrays replace the global one. Verified that `npx playwright test --list` shows 0 manual entries, both locally and with `CI=1`.
- `manual.config.ts` is the only way to run these specs. It is standalone (it does not spread `playwright.config.ts`) and sets:
  - `testDir: ./tests/manual`
  - one `manual-chromium` project with `headless: false` hard-coded, because `.env.testing` sets `HEADLESS=true`
  - `workers: 1`, `retries: 0`, `timeout: 0`
  - no `globalSetup`, so a run doesn't wipe `test-results/`
  - reporters: `list`, plus `html` written to `manual-report/`
  - `trace: 'off'`, because a trace records `fill()` values, including `GRA_TEST_PASSWORD`

## Conventions

- File name: `tests/manual/gra-<ticket>-<slug>.spec.ts`. Describe tag: `@manual`.
- Every spec must open with a header block containing these parts:
  - `// GRA-XXXX — <summary>`
  - `Steps source:`
  - **How it works**: numbered steps that say what the script does and what the tester does
  - **To run it (PowerShell)**
  - `Optional env`
- Run command form: `npx playwright test --config=manual.config.ts tests/manual/<file>.spec.ts`. Don't document `npm run … --`, because the passthrough can drop flags under Windows PowerShell. There is no `test:manual` npm script.
- Leave `NODE_ENV` unset. It defaults to `testing`, and `.env.testing` is the only env file with `GRA_TEST_PASSWORD`. Storefront URLs point at staging either way.
- Give each case's env vars a per-case prefix (`GRA6266_*`). Clear them with `Remove-Item Env:<name>`, because `$env:` values persist for the PowerShell session.
- Lifecycle:
  1. Create the spec with `/new-manual-test GRA-XXXX` (`.claude/commands/new-manual-test.md`).
  2. Run it once.
  3. Record the result in Xray, attaching only the `*-timeline.txt` (not the HTML report or a trace). The spec writes this file with `testInfo.outputPath()`, attaches it by `path` and prints its path after Resume; a `body` attachment never reaches disk (confirmed in Playwright 1.61.1 `normalizeAndSaveAttachment`). Copy the file out before the next run, because a manual run clears `test-results/manual/` and every `npm test` global setup wipes `test-results/`.
  4. Delete the spec, or keep it compiling, because `tsc` includes `tests/**`.
- `/new-manual-test` looks for steps in this order:
  1. the ticket description
  2. local JSON under `ManualTest/Tasks/**`, matched by summary
  3. the `read-xray-test-web` skill
  4. asking the user

## Writing rules (learned on GRA-6266)

- Register `page.route` and listeners before any navigation.
- Prove the simulation fired before asserting an absence. Check that the match count is > 0 and, for a hold, that response − request ≥ hold − jitter. Without this, a check like "no Bloomreach batch while pending" passes vacuously.
- Start the ordering window ~500ms before the request, to catch a call fired in parallel on the same click.
- Match GraphQL by `operationName` from the URL query or the body, including batched arrays. Every mutation posts to the same `/graphql` URL.
- Allow a store code in Magento REST paths: `/rest/(?:[\w-]+/)?V1/…`. Log all `bloomreach|exponea` requests so a matcher miss shows up in the timeline.
- Sign-in is best-effort: wrap it and pause anyway.
- Treat text locators that haven't been confirmed on the live page as timeline markers, not assertions.
- Use hard `expect` for preconditions and `softAssert` for independent outcome checks.

## First case: GRA-6266

- **Case:** Xray Test "[GRA][AP21][Consent] Verify the AP21 consent update completes before the Bloomreach batch request is sent on Save".
- **Steps source:** GRA-6040 **TC-18** in `ManualTest/Tasks/Sprint 21/GRA-6040/GRA-6040-detailed-revised-PO-0610-fixed.json`, matched by summary. The ticket's description holds only the precondition and simulation notes.
- **Spec:** `tests/manual/gra-6266-consent-save-order.spec.ts`. It holds `SetCustomerConsent` for 5s, the tester changes Email and clicks Save, and on Resume it checks:
  - the call returned HTTP 200 with no errors
  - no `POST …/V1/bloomreach/track/batch` was sent while the call was pending
  - a batch was sent after the response
- **Not yet confirmed on staging:**
  - the op name `SetCustomerConsent` (from the case data "SetCustomerConsent (updateCustomerV2)"; override with `GRA6266_OP`)
  - the batch path
  - whether the t1 accounts have a mobile number (the case precondition; override with `GRA6266_EMAIL`)
  - whether the AP21 save path is deployed
- **Not run end to end:** on 2026-10-09 staging was down. Existing E2E-AUTH-001 and -002 failed on Platypus AU and Dr. Martens AU, the login panel stayed empty, pages sat on the loading spinner, and Dr. Martens AU returned `ERR_TIMED_OUT`.

Related: [[execution-config]], [[fixture-registry]], [[ecommerce-auth-modal-gotchas]], [[test-conventions]]
