# Manual-Assist Specs

Supplements the root `CLAUDE.md`. `tests/manual/` holds one-off Playwright specs that help a tester execute a manual Xray case — network simulation, request timelines, sign-in — and are run once, never committed, never part of CI. First case: GRA-6266.

## Isolation — keep all three layers

| Layer | Effect |
|---|---|
| `.gitignore` → `/tests/manual/*` | Specs are never committed. Only this file and `_template.ts` are tracked. |
| `playwright.config.ts` → `testIgnore: "**/tests/manual/**"` (global **and** every project — project-level arrays replace the global one) | `npm test` and CI never pick them up, even if one is force-added. |
| `manual.config.ts` | The only way to run them: headed, 1 worker, 0 retries, no timeout, no global setup, report in `manual-report/`, trace off. |

## Lifecycle

1. **Create** — `/new-manual-test GRA-XXXX`, or copy `_template.ts` to `gra-xxxx-<slug>.spec.ts`.
2. **Run once** — the command in the spec header.
3. **Record** the result in Xray. Attach the `*-timeline.txt` whose path the spec prints after Resume (under `test-results/manual/`), never the HTML report or a trace — they can hold tokens and typed credentials. Copy the file out first: the next manual run clears `test-results/manual/`, and every `npm test` global setup wipes all of `test-results/`.
4. **Delete** the spec, or keep it compiling: `tsc` includes `tests/**`, so a broken leftover spec breaks `npm run lint` locally.

File name: `gra-<ticket>-<slug>.spec.ts`, e.g. `gra-6266-consent-save-order.spec.ts`. Keep the folder flat — a gitignore negation cannot re-include a file inside an ignored subdirectory.

## Required header

Every spec starts with this block. When Claude creates a spec, its chat report repeats the "How it works" and "To run it (PowerShell)" sections verbatim.

```ts
// GRA-XXXX — <Xray test summary>
// Steps source: <ticket description | ManualTest/Tasks/<sprint>/<file>.json TC-NN | Xray step grid>
//
// How it works
//   1. <what it sets up before any page opens>
//   2. Signs in and opens <page>. If that fails it still pauses, so you can sign in by hand.
//   3. Pauses. <what the tester does and checks by hand>, then click Resume in the Playwright Inspector.
//   4. On Resume it prints and attaches the timeline, then checks: <each automated check>.
//
// To run it (PowerShell)
//   npx playwright test --config=manual.config.ts tests/manual/gra-xxxx-<slug>.spec.ts
//
// Optional env (clear afterwards with Remove-Item Env:<name>)
//   GRAXXXX_SITE  storefront name, default 'Platypus AU'
```

- **How it works** — numbered in execution order; each step says plainly whether the script or the tester does it.
- **To run it (PowerShell)** — the exact, copy-pasteable command. Use the `npx playwright test --config=manual.config.ts …` form; an `npm run … --` passthrough can drop flags under Windows PowerShell.
- **Steps source** — where the steps came from, so a reader can check them against Xray.

## Writing rules (learned on GRA-6266)

- **Register routes and listeners before any navigation.**
- **Prove the simulation fired before asserting an absence.** "No X while Y was pending" passes vacuously when the route never matched. Count matches and hard-`expect` the count > 0 — and for a hold, response − request ≥ hold − jitter — before the ordering checks.
- **Start an ordering window a margin (~500ms) before the request**, so a call fired in parallel on the same click is not missed.
- **Match GraphQL by `operationName`** from the URL query or the body, including batched arrays (`operationNames()` in `_template.ts`) — every mutation posts to the same `/graphql` URL.
- **Allow a store code in Magento REST paths**: `/rest/(?:[\w-]+/)?V1/…`. Log every related request (e.g. `/bloomreach|exponea/i`) to the timeline so a matcher miss is visible.
- **Sign-in is best-effort**: wrap it, log the outcome, pause anyway.
- **Selectors not checked against the live page are timeline markers, not assertions.** Text taken from a case's expected results (button labels, success messages) feeds the timeline; only confirmed behaviour is asserted.
- **Default to the pause (manual-assist) style.** Automate a step fully only once its selectors are confirmed live.
- **Write the timeline to `testInfo.outputPath(…)`, attach it by `path`, and print the path** after Resume. A `body` attachment stays in memory and never becomes a file the tester can attach to Xray.
- Preconditions use hard `expect`; independent outcome checks use `softAssert` (root `CLAUDE.md` rules).
- Reuse fixtures from `@config/base-test` and existing page objects. Because these files are throwaway, module-level constants and inline locators in the spec are acceptable — but the file must pass `npm run lint`.
- Give each case's env vars a per-case prefix (`GRA6266_*`). PowerShell `$env:` values persist for the session — clear them with `Remove-Item Env:<name>`.

## Environment

- Leave `NODE_ENV` unset (it defaults to `testing`): `.env.testing` is the only env file with `GRA_TEST_PASSWORD`. Storefront URLs in `src/data/ecommerce/storefronts.ts` point at staging either way.
- Default accounts come from `testAccounts` (`qa.<brand>.<region>.t1@mailinator.com`). Check the case's preconditions (e.g. a mobile number on the account) and add a per-case `*_EMAIL` override when the t1 account does not fit.

## Running

```powershell
npx playwright test --config=manual.config.ts tests/manual/gra-6266-consent-save-order.spec.ts
$env:GRA6266_SITE='Vans AU'; npx playwright test --config=manual.config.ts tests/manual/gra-6266-consent-save-order.spec.ts; Remove-Item Env:GRA6266_SITE
npx playwright test --config=manual.config.ts --list
npx playwright show-report manual-report
```

## Promoting a case into the suite

When a case should run regularly, move it to `tests/ecommerce/{area}/` (it is then no longer ignored), move locators into page objects and data into `src/data/`, remove `page.pause()`, and follow the root `CLAUDE.md` conventions.
