# Claude Code Commands — Usage Examples

Project: `playwright-typescript` automation framework  
Location: `.claude/commands/`  
Usage: Type `/command-name [arguments]` in the Claude Code prompt

---

## Scaffolding Commands

These commands create files with all the correct boilerplate pre-wired — imports, serial mode, logger setup, data module structure, and fixture registration.

---

### `/new-api-test`

Scaffold a new REST or GraphQL API test file under `tests/api/`.  
Encodes: correct `apiTest as test` import, `test.describe.configure({ mode: 'serial' })`, response chain assertions, `assertNoErrors()` first on GraphQL.

**Examples:**

```
/new-api-test User authentication endpoints
```
→ Asks "REST or GraphQL?", creates `tests/api/user-authentication.spec.ts` and `src/data/user-auth-data.ts`

```
/new-api-test Booking CRUD — REST — tests/api/booking-lifecycle.spec.ts
```
→ Skips the REST/GraphQL question, creates with the given filename

```
/new-api-test GraphQL product queries and mutations
```
→ Creates a GraphQL spec with `graphqlClient.queryWrapped`, `assertNoErrors()`, `assertDataField()` patterns

```
/new-api-test Token-based auth flow — uses stored token across tests
```
→ Creates spec using `ApiClient.storeToken` / `withStoredToken` pattern in `beforeAll`

---

### `/new-ui-test`

Scaffold a new UI spec file under `tests/frontsite/`, `tests/admin/`, or `tests/ecommerce/`.  
Encodes: `@config/base-test` import, `createTestLogger`, soft assertion decision rules, tagged `test.describe`.

**Examples:**

```
/new-ui-test Homepage navigation menu highlights correct links
```
→ Identifies area as `frontsite`, creates `tests/frontsite/navigation-menu.spec.ts`

```
/new-ui-test Admin login — valid, invalid, empty credentials
```
→ Identifies area as `admin`, creates `tests/admin/login-validation.spec.ts` with 3 test cases

```
/new-ui-test Ecommerce product listing page filtering and sorting
```
→ Identifies area as `ecommerce`, creates with `softAssert` for independent filter checks

```
/new-ui-test Form drag-and-drop reordering — frontsite
```
→ Creates spec in frontsite area using the `formDragAndDropPage` fixture

---

### `/new-page-object`

Create a page object class extending `BasePage` with correct helper usage and fixture registration.  
Encodes: `private readonly` locators at class level, `this.elements/waits/style` helpers, no direct `page.*` calls, registration in `base-test.ts`.

**Examples:**

```
/new-page-object ContactPage frontsite
```
→ Creates `src/pages/frontsite/contact-page.ts` + adds `contactPage` fixture to `src/config/base-test.ts`

```
/new-page-object UserProfilePage admin
```
→ Creates `src/pages/admin/user-profile-page.ts` with admin-area helpers

```
/new-page-object CheckoutPage ecommerce
```
→ Creates `src/pages/ecommerce/checkout-page.ts` with payment form locators scaffolded

```
/new-page-object SearchResultsPage frontsite — needs CSS selector for highlighted terms
```
→ Creates page object with a CSS selector field for style checks via `this.style.*`

---

## Agent Trigger Commands

These commands route directly to the correct specialist agent (or pipeline) — no need to remember workflow names or dispatch order.

---

### `/write-tests`

Orchestrate test creation from a requirement — invokes `qa-orchestrator` WORKFLOW-1 (architect → reviewer).

**Examples:**

```
/write-tests User can filter search results by practice area and see updated result count
```
→ Reads existing fixtures/pages/data, dispatches architect to write `tests/frontsite/search-filter.spec.ts`, then reviewer audits output

```
/write-tests API: POST /bookings returns 200 with correct booking ID and confirms via GET
```
→ Routes to API test area, writes `tests/api/booking-creation.spec.ts` using `bookingService` fixture

```
/write-tests Login fails with invalid credentials and shows error message — admin area
```
→ Writes negative test case for `tests/admin/login.spec.ts`, reuses existing `loginPage` fixture

```
/write-tests GraphQL: CreateOrder mutation returns order ID and status, then query verifies it
```
→ Writes GQL spec with `mutateWrapped` + `queryWrapped`, full CRUD cycle

---

### `/fix-test`

Fix a failing or flaky test — invokes `playwright-test-healer` then `qa-code-reviewer`.

**Examples:**

```
/fix-test tests/frontsite/home-page.spec.ts
```
→ Reads test-results/ for failures, healer diagnoses and repairs, reviewer checks the fix

```
/fix-test TC_03 - Should filter bookings by name
```
→ Finds the spec file via Glob, extracts error context, heals the test

```
/fix-test tests/api/restful-booker.spec.ts — timeout on authenticate step
```
→ Passes the timeout hint to the healer as additional context

```
/fix-test tests/ecommerce/smoke/search-smoke.spec.ts — selector stale after last deploy
```
→ Healer focuses on stale selectors, updates locators to match new DOM

---

### `/review`

Code review changed files on the current branch — invokes `qa-code-reviewer` WORKFLOW-5.

**Examples:**

```
/review
```
→ Runs `git diff --name-only main...HEAD`, reviews all changed `.ts` files

```
/review branch
```
→ Same as above — "branch" or "changes" triggers the git-diff path

```
/review tests/api/objects-crud.spec.ts src/api/services/restful-device/RestfulApiClient.ts
```
→ Reviews only the specified files

```
/review tests/frontsite/insights-search.spec.ts
```
→ Reviews a single spec, checks all 11 categories + API checklist if applicable

---

### `/check-ci`

Investigate a CI pipeline failure — invokes `devops-cicd-specialist` for root-cause classification.

**Examples:**

```
/check-ci
```
→ Reads local `test-summary.txt` + `test-results/results.json`, classifies failures, offers healer for fixable ones

```
/check-ci latest
```
→ Fetches the most recent GitHub Actions run logs and parses them

```
/check-ci https://github.com/org/repo/actions/runs/12345678
```
→ Uses the provided URL to fetch workflow run logs directly

```
/check-ci Build #42 — all playwright-chromium jobs failed with TIMEOUT
```
→ Passes the hint to the specialist; it investigates timeout root cause and recommends fix

---

### `/security-audit`

Run a security audit — invokes `security-reviewer` for a Critical/High/Medium/Low severity report.

**Examples:**

```
/security-audit
```
→ Full project scan: `src/`, `tests/`, `.github/workflows/`, `.env*`, `package.json`

```
/security-audit branch
```
→ Scans only files changed on current branch + always includes `package.json` and workflows

```
/security-audit changes
```
→ Same as "branch" — alias for scanning only changed files

```
/security-audit src/api/ tests/api/
```
→ Scoped to the API layer only — useful before merging a new API integration

---

### `/research`

Research a technical topic, integration, or upgrade — invokes `technical-research-agent` and produces a structured Technical Research Report.  
The agent reads `CLAUDE.md`, `playwright.config.ts`, `api.config.ts`, `package.json`, and `.github/workflows/` before starting. Output is a full report covering options, trade-offs, risk assessment, and an ordered implementation step list. **Never auto-flows into implementation — user approval is required first.**

**Examples:**

```
/research upgrade Playwright from v1.44 to v1.50
```
→ Reads current `package.json`, checks Playwright changelog for breaking changes, compares migration effort, produces a report with recommended steps

```
/research integrate Allure reporter alongside monocart
```
→ Surveys existing reporter config in `playwright.config.ts` and `api.config.ts`, evaluates Allure vs monocart overlap, recommends an additive approach

```
/research add k6 load tests to the CI pipeline
```
→ Investigates `.github/workflows/`, estimates job placement, produces step list for the implementation agent

```
/research replace Percy with Playwright visual comparisons
```
→ Maps Percy usage in `src/pages/helpers/percy-helper.ts` and existing test fixtures, evaluates built-in `toHaveScreenshot` as a replacement

---

### `/implement`

Implement an approved Technical Research Report — invokes `technical-implementation-agent`, then runs `qa-code-reviewer` and `devops-cicd-specialist` in parallel to verify the result.  
**Requires explicit user approval of a research report first — the approval gate cannot be skipped.**

**Examples:**

```
/implement the Playwright upgrade report we approved
```
→ Reads the approved report, dispatches the implementation agent, then reviews all modified `.ts` files and changed CI workflows

```
/implement upgrade from research above
```
→ Same — references the report already in the conversation

```
/implement add Allure reporter — report approved
```
→ Installs deps, edits `playwright.config.ts` and `api.config.ts`, updates CI; reviewer + devops specialist validate

```
/implement k6 integration per the research report
```
→ Adds k6 scripts, edits the pipeline, runs devops-cicd-specialist to verify workflow syntax and job ordering

---

## Quick Runner Commands

Smart dispatchers that select the right `npm run` script based on what you pass.

---

### `/run-api`

Run API tests — maps arguments to the correct `api.config.ts` command.

**Examples:**

```
/run-api
```
→ Runs `npm run test:api` (all API tests, 1 worker)

```
/run-api booker
```
→ Runs `npm run test:api:booker` (restful-booker tests only)

```
/run-api device
```
→ Runs `npm run test:api:device-booker` (device/objects CRUD tests)

```
/run-api tests/api/objects-crud.spec.ts
```
→ Runs `npx playwright test tests/api/objects-crud.spec.ts --config=api.config.ts --workers=1`

```
/run-api --grep "TC_03"
```
→ Runs `npx playwright test --config=api.config.ts --grep "TC_03" --workers=1`

```
/run-api debug
```
→ Runs `npm run test:api:debug` (opens Playwright inspector)

```
/run-api Booking Lifecycle
```
→ Runs with grep pattern `"Booking Lifecycle"` against api.config.ts

---

### `/run-ui`

Run UI tests — maps arguments to the right Playwright command.

**Examples:**

```
/run-ui
```
→ Runs `npm run test:simple` (chromium only, 1 worker — fastest local run)

```
/run-ui frontsite
```
→ Runs `npm run test:simple:frontsite`

```
/run-ui admin
```
→ Runs `npm run test:simple:admin`

```
/run-ui headed
```
→ Runs `npm run test:simple:headed` (visible browser)

```
/run-ui debug
```
→ Runs `npm run test:simple:debug` (headed + Playwright inspector)

```
/run-ui tests/frontsite/home-page.spec.ts
```
→ Runs `npx playwright test tests/frontsite/home-page.spec.ts --project=chromium --workers=1`

```
/run-ui --grep "TC_01"
```
→ Runs `npx playwright test --grep "TC_01" --project=chromium --workers=1`

```
/run-ui all browsers
```
→ Runs `npm run test:parallel:all` (chromium + firefox + webkit, 50% workers)

```
/run-ui staging
```
→ Runs `npm run test:staging` (targets staging environment)

---

## Quick Reference Card

| Command | Argument style | Example |
|---|---|---|
| `/new-api-test` | Plain description | `/new-api-test Order status polling` |
| `/new-ui-test` | Plain description | `/new-ui-test Profile listing page filters` |
| `/new-page-object` | ClassName area | `/new-page-object SearchPage frontsite` |
| `/write-tests` | Requirement text | `/write-tests User can sort search results` |
| `/fix-test` | File path or test name | `/fix-test tests/api/pla-cart_minicart.spec.ts` |
| `/review` | Files or "branch" or empty | `/review` |
| `/check-ci` | URL, run ID, or empty | `/check-ci` |
| `/security-audit` | "branch", scope, or empty | `/security-audit branch` |
| `/research` | Topic or integration name | `/research upgrade Playwright to v1.50` |
| `/implement` | Report reference or topic | `/implement the Playwright upgrade report` |
| `/run-api` | Area, file, grep, or empty | `/run-api booker` |
| `/run-ui` | Area, file, grep, or empty | `/run-ui frontsite` |

---

## How Commands Work

Claude Code project commands are markdown files in `.claude/commands/`. When you type `/command-name`, Claude reads the file and executes it as a prompt — `$ARGUMENTS` is replaced with whatever you type after the command name.

**Files location:** `.claude/commands/*.md`  
**Format:** Optional YAML frontmatter (`description:`) + prompt body with `$ARGUMENTS` placeholder  
**Scope:** Project-level (only available in this repo)

 The .claude/commands/ folder lets you define project-scoped slash commands — custom shortcuts that appear in the
  Claude Code command palette and can be invoked with /command-name.

  Key Benefits

  1. Discoverability
  Commands show up in the / menu. Anyone on the team can type /write-tests or /fix-test without knowing which agents or
  workflows exist — the command encodes that knowledge.

  2. Consistent workflows, enforced
  Each .md file is a prompt template that wires up the right agent pipeline every time. /fix-test always runs healer →
  reviewer in that order, not whatever the user happens to ask for on a given day.

  3. $ARGUMENTS for parameterisation
  The special $ARGUMENTS placeholder receives whatever the user types after the command name:
  /write-tests Login page should redirect unauthenticated users to /login
  That text drops directly into the prompt — no copy-pasting needed.

  4. Shared via git
  Because the folder lives in the repo (not ~/.claude/), every team member gets the same commands automatically after
  git pull. No per-user setup.

  5. Separation from personal commands
  Project commands in .claude/commands/ are distinct from user-level commands in ~/.claude/commands/. Project commands
  are repo-specific and version-controlled; personal commands are your own shortcuts across all projects.

  Contrast with skills — skills (the Skill tool, /run-ui, etc.) are configured in the Claude Code harness settings and
  can invoke agents or structured logic. Commands are simpler: they're just markdown prompt templates that Claude reads
  and executes when you invoke them. Commands are the lightweight, git-tracked layer on top.
