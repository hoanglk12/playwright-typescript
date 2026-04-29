# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Playwright TypeScript Automation Framework

## Architecture

Composition-based Page Object Model. `BasePage` owns 9 helper instances — **never call `page.locator()` or `page.click()` directly inside page classes**. Use the helpers instead:

| Property | Class | Purpose |
|---|---|---|
| `this.waits` | `WaitHelper` | Page/element/network synchronisation |
| `this.elements` | `ElementHelper` | Clicks, text input, queries, scroll, drag-drop |
| `this.style` | `StyleHelper` | Computed colour, dimensions, CSS reads |
| `this.frames` | `FrameHelper` | iframe operations |
| `this.files` | `FileHelper` | File upload / drag-and-drop |
| `this.storage` | `StorageHelper` | Cookies, localStorage, sessionStorage, clipboard |
| `this.network` | `NetworkHelper` | Route mocking, request interception, performance |
| `this.tables` | `TableHelper` | HTML table interactions |
| `this.percy` | `PercyHelper` | Visual snapshot testing with Percy (token-guarded) |

New browser interaction → add it to the appropriate helper class in [src/pages/helpers/](src/pages/helpers/), not to `BasePage`. The `BasePage` retains backward-compatible delegations (e.g. `page.clickElement()` still works) but new code should call helpers directly: `this.elements.clickElement()`.

## Path Aliases (tsconfig)

```
@pages/*   → src/pages/*
@tests/*   → tests/*
@utils/*   → src/utils/*
@config/*  → src/config/*
@data/*    → src/data/*
```

There is no `@constants` alias — import timeouts via `@config/../constants/timeouts` or a relative path.

## Import Convention — Critical

**Always import from `@config/base-test`, never from `@playwright/test` directly in test files:**

```ts
import { test, expect } from '@config/base-test';
```

`base-test.ts` extends Playwright's `test` with all custom page object fixtures. Importing from `@playwright/test` directly loses those fixtures.

## Configs

| Config | Scope | Command |
|---|---|---|
| `playwright.config.ts` | UI tests (ignores `**/api/**`) | `npm test` |
| `api.config.ts` | API tests only (1 worker, serial) | `npm run test:api` |

Both configs read from `src/config/environment.ts` which loads `.env.{NODE_ENV}`.

## Adding a New Page Object

1. Extend `BasePage`, constructor takes only `page: Page`
2. Declare locators as `private readonly` class fields — prefer `page.getByRole()` / `page.getByText()` over CSS selectors
3. Keep CSS selectors only when needed for `this.style.*` computed-style queries
4. Place under `src/pages/{area}/` matching the app area (frontsite, admin, ecommerce)
5. Register as a fixture in `src/config/base-test.ts`

```ts
import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class MyPage extends BasePage {
  private readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });

  constructor(page: Page) { super(page); }

  async clickSubmit(): Promise<void> {
    await this.elements.clickElement('[data-testid="submit"]');
  }
}
```

**Registered fixtures in `base-test.ts`:**

| Fixture | Type | Area |
|---|---|---|
| `homePage` | `HomePage` | frontsite |
| `loginPage` | `LoginPage` | admin |
| `formDragAndDropPage` | `FormDragAndDropPage` | frontsite |
| `profileListingPage` | `ProfileListingPage` | frontsite |
| `insightsPage` | `InsightsPage` | frontsite |
| `servicesAZPage` | `ServicesAZPage` | frontsite |
| `ecommerceHomePage` | `EcommerceHomePage` | ecommerce |
| `ecommerceNavPage` | `EcommerceNavPage` | ecommerce |
| `ecommerceSearchPage` | `EcommerceSearchPage` | ecommerce |
| `percyHelper` | `PercyHelper` | visual regression |

## Test Structure

```ts
import { test, expect } from '@config/base-test';
import { MyData } from '../../src/data/my-data';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('Feature Name @tag1 @tag2', () => {
  test('TC_01 - Description', async ({ myPage }) => {
    const logger = createTestLogger('TC_01 description');

    logger.step('Step 1 - Navigate');
    await myPage.navigateToPage();

    logger.step('Step 2 - Assert');
    expect(await myPage.isElementVisible()).toBeTruthy();
  });
});
```

Tags go in `test.describe()` name string (e.g. `@homepage`, `@frontsite`, `@admin`).

## Test Data

Never hardcode test data in spec files. Create typed data modules in `src/data/`:

- **Constants** (static expected values) → plain `const` objects
- **Generated data** (random/dynamic) → generator functions or classes
- See `src/data/admin-data.ts` as a reference pattern

## API Tests

- Entry point: `src/api/ApiTest.ts` (extends base test with `restfulApiClient`, `restfulDeviceClient`, `bookingService`, `graphqlClient` fixtures)
- Services: `src/api/services/{service-name}/`
- Models live alongside services; response assertions use `ApiResponse` chaining (`.assertStatus()`, `.assertJsonPath()`, etc.)
- **GraphQL**: `GraphQLClient` is a dedicated client for queries/mutations — use `graphqlClient` fixture in API tests
- **Cross-test token sharing**: `ApiClient.storeToken(key, token)` / `ApiClient.getToken(key)` / `ApiClient.withStoredToken(options, tokenKey)` — use this for auth tokens that must persist across tests within a single worker
- **Shared state**: `tests/api/shared-state.ts` for state that must persist across test files in a single worker
- **API-specific lifecycle**: `tests/api/global-setup.ts` and `tests/api/global-teardown.ts` run before/after the API suite
- **Mocking**: `ApiMockService` in `src/api/ApiMockService.ts` for centralised route mocking scenarios
- Run: `npm run test:api` — executes with 1 worker to avoid rate-limiting

## Visual Testing (Percy)

- Use `percyHelper` fixture in tests that need visual snapshots
- Percy only runs when `PERCY_TOKEN` is set; snapshots are skipped silently otherwise
- Snapshot options: `PercySnapshotOptions` type from `src/pages/helpers/`
- Run via dedicated scripts: `test:percy`, `test:percy:smoke`, `test:percy:admin`, etc.

## Run Commands

```bash
# Core
npm test                          # headless, chromium + firefox, 50% workers
npm run test:headed               # visible browser
npm run test:headless             # force headless
npm run test:debug                # Playwright inspector
npm run test:serial               # 1 worker (flaky investigation)
npm run test:ui                   # interactive UI mode
npm run test:ui:headless          # UI mode without browser window

# Single test file or folder
npx playwright test tests/frontsite/home-page.spec.ts
npx playwright test tests/frontsite/home-page.spec.ts --headed
npx playwright test --grep "TC_01"    # run by test name pattern

# Faster one-browser runs
npm run test:simple               # chromium only, 1 worker
npm run test:simple:admin         # admin area only
npm run test:simple:frontsite     # frontsite area only
npm run test:simple:login         # login tests only
npm run test:simple:headed        # chromium, 1 worker, visible browser
npm run test:simple:debug         # chromium, 1 worker, headed + debug

# Parallel runs
npm run test:parallel             # 50% workers
npm run test:parallel:max         # 100% workers
npm run test:parallel:all         # all browsers (chromium + firefox + webkit)

# Environments
npm run test:testing              # against testing environment
npm run test:staging              # against staging environment
npm run test:production           # against production environment

# API
npm run test:api                  # all API tests (serial, 1 worker)
npm run test:api:testing          # API tests in testing environment
npm run test:api:serial           # API tests explicit 1 worker
npm run test:api:debug            # API tests with Playwright inspector
npm run test:api:ui               # API tests in UI mode
npm run test:api:booker           # restful-booker tests only
npm run test:api:device-booker    # device API CRUD tests

# Visual regression (Percy)
npm run test:percy                # full Percy run (testing env)
npm run test:percy:testing        # Percy against testing
npm run test:percy:staging        # Percy against staging
npm run test:percy:smoke          # smoke subset with Percy
npm run test:percy:admin          # admin pages with Percy
npm run test:percy:login          # login flow with Percy

# Lighthouse CI
npm run lhci:run                  # collect + upload + assert
npm run lhci:collect              # collect Lighthouse data only
npm run lhci:upload               # upload results to LHCI server
npm run lhci:assert               # assert performance thresholds

# Docker
npm run docker:build              # build playwright-framework image
npm run docker:test               # run full suite in Docker
npm run docker:test:chromium      # Docker chromium only
npm run docker:test:firefox       # Docker firefox only
npm run docker:test:webkit        # Docker webkit only
npm run docker:test:api           # Docker API tests
npm run docker:test:parallel      # parallel tests in Docker
npm run docker:dev                # start dev container
npm run docker:dev:shell          # shell into dev container
npm run docker:dev:stop           # stop dev container
npm run docker:clean              # remove volumes and containers
npm run docker:logs               # follow docker logs
npm run docker:rebuild            # rebuild image without cache

# Utilities
npm run report                    # open HTML report
npm run report:open               # open report on port 9323
npm run report:api                # open API report on port 9324
npm run lint                      # tsc type-check (no emit)
npm run clean                     # remove test results, reports, auth, Lighthouse
npm run clean:api                 # remove API test results only
npm run clean:install             # clean + npm install + install browsers
npm run install:browsers          # install Playwright browsers
npm run install:browsers:deps     # install browsers + system dependencies
npm run codegen                   # Playwright codegen recorder
```

## Environment Configuration

Set `NODE_ENV` to load `.env.{NODE_ENV}`:

```bash
NODE_ENV=testing npm test       # loads .env.testing
NODE_ENV=staging npm test       # loads .env.staging
NODE_ENV=production npm test    # loads .env.production
```

Key env vars: `FRONT_SITE_URL`, `ADMIN_URL`, `API_BASE_URL`, `WORKERS`, `HEADLESS`, `TRACE_MODE`, `SCREENSHOT_MODE`, `VIDEO_MODE`, `PERCY_TOKEN`.

Both `playwright.config.ts` and `api.config.ts` auto-detect CI environments (`CI`, `GITLAB_CI`, `TF_BUILD`, `GITHUB_ACTIONS`) to adjust retries and timeouts automatically.

## Firefox Teardown — Do Not Remove

The `ecommerceHomePage` fixture in `base-test.ts` navigates to `about:blank` before teardown on Firefox. This is intentional: Firefox's Juggler protocol hangs on `context.close()` when SPAs have active service workers or persistent WebSocket connections. Do not remove this workaround.

## Global Lifecycle

- **Setup** (`src/config/global-setup.ts`): clears logs, loads env, cleans/creates output dirs, validates browser installations, tests connectivity to target apps
- **Teardown** (`src/config/global-teardown.ts`): generates reports, creates `test-summary.txt`, archives artifacts in CI only, cleans temp files

## Logging

```ts
const logger = createTestLogger('test name');
logger.step('Step N - description');
logger.action('Click', 'element name');
logger.verify('assertion description', 'expected', 'actual');
logger.error(error, 'context');
```

Logs write to `./test-logs/test-execution.log` and attach to Playwright HTML report via `test.info().annotations`.

## Timeouts

Use named constants from `src/constants/timeouts.ts` — never magic numbers. Constants are CI-aware (longer in CI, shorter locally):

```ts
import { TIMEOUTS } from '@config/../constants/timeouts';
await page.waitForSelector(sel, { timeout: TIMEOUTS.ELEMENT_VISIBLE });
```

Key constants: `PAGE_LOAD`, `NETWORK_IDLE_SLOW`, `ELEMENT_VISIBLE`, `DIALOG_APPEAR`, `DRAG_DROP`, `API_RESPONSE`, `API_RESPONSE_SLOW`.

## Agents

Specialised sub-agents live in `.claude/agents/` and are invoked automatically by Claude Code for multi-step QA workflows:

| Agent | Purpose |
|---|---|
| `automation-test-architect` | Converts specs/requirements into production-ready Playwright tests |
| `playwright-test-generator` | Records real browser interactions to produce raw spec files |
| `playwright-test-healer` | Debugs and fixes failing/flaky tests |
| `playwright-test-planner` | Creates structured test plans by navigating the live app |
| `devops-cicd-specialist` | Analyses CI build results, classifies failures, fetches workflow logs |
| `qa-code-reviewer` | Audits test code for quality, correctness, and framework adherence |
| `qa-orchestrator` | Single entry point for any multi-step QA automation request |
| `security-reviewer` | Scans for secrets, vulnerable deps, unsafe patterns, and CI permission issues |

Use `qa-orchestrator` as the default entry point for any end-to-end QA workflow (plan → build → review → fix).

## Skills Available

Invoke with `/skill-name` in conversation:

| Skill | Purpose |
|---|---|
| `/playwright-expert` | Playwright API guidance |
| `/playwright-best-practices` | Architecture and pattern review |
| `/qa-code-reviewer` | Test code review |
| `/test-case-generator` | Generate test cases from specs |
| `/discover-e2e-flows` | Map user journeys to test flows |
| `/error-debugger` | Debug failing tests |
| `/api-mocking` | API mock and intercept patterns |
| `/graphql-testing` | GraphQL API testing patterns |
| `/accessibility` | A11Y testing (WCAG) |
| `/ts-strict-mode` | TypeScript strict mode patterns |
| `/typescript-advanced-types` | Advanced TypeScript type patterns |
| `/cicd-pipeline` | CI/CD and GitHub Actions |
| `/documentation-writer` | Generate test documentation |
| `/seo` | SEO testing patterns |
| `/nodejs-best-practices` | Node.js best practices |
| `/nodejs-backend-patterns` | Node.js backend patterns |
| `/frontend-design` | Frontend design patterns |
| `/pull-latest` | Sync local branch with remote |
