# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Playwright TypeScript Automation Framework

## Architecture

Composition-based Page Object Model. `BasePage` owns 8 helper instances — **never call `page.locator()` or `page.click()` directly inside page classes**. Use the helpers instead:

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
- Run: `npm run test:api` — executes with 1 worker to avoid rate-limiting

## Run Commands

```bash
# Core
npm test                        # headless, chromium + firefox, 50% workers
npm run test:headed             # visible browser
npm run test:debug              # Playwright inspector
npm run test:serial             # 1 worker (flaky investigation)
npm run test:ui                 # interactive UI mode

# Single test file or folder
npx playwright test tests/frontsite/home-page.spec.ts
npx playwright test tests/frontsite/home-page.spec.ts --headed
npx playwright test --grep "TC_01"    # run by test name pattern

# Faster one-browser runs
npm run test:simple             # chromium only, 1 worker
npm run test:simple:admin       # admin area only
npm run test:simple:frontsite   # frontsite area only
npm run test:simple:login       # login tests only

# Environments
npm run test:testing            # against testing environment
npm run test:staging            # against staging environment

# API
npm run test:api                # all API tests (serial)
npm run test:api:booker         # restful-booker tests only
npm run test:api:device-booker  # device + booker combined

# Visual regression (Percy)
npm run test:percy              # full Percy run
npm run test:percy:smoke        # smoke subset with Percy
npm run test:percy:admin        # admin pages with Percy

# Docker
npm run docker:build            # build test image
npm run docker:test             # run full suite in Docker
npm run docker:test:chromium    # Docker chromium only
npm run docker:test:api         # Docker API tests

# Utilities
npm run report                  # open HTML report
npm run lint                    # tsc type-check (no emit)
npm run clean                   # remove test artifacts
npm run codegen                 # Playwright codegen recorder
```

## Environment Configuration

Set `NODE_ENV` to load `.env.{NODE_ENV}`:

```bash
NODE_ENV=testing npm test       # loads .env.testing
NODE_ENV=staging npm test       # loads .env.staging
NODE_ENV=production npm test    # loads .env.production
```

Key env vars: `FRONT_SITE_URL`, `ADMIN_URL`, `API_BASE_URL`, `WORKERS`, `HEADLESS`, `TRACE_MODE`, `SCREENSHOT_MODE`, `VIDEO_MODE`.

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
| `/accessibility` | A11Y testing (WCAG) |
| `/ts-strict-mode` | TypeScript strict mode patterns |
| `/cicd-pipeline` | CI/CD and GitHub Actions |
| `/documentation-writer` | Generate test documentation |
| `/pull-latest` | Sync local branch with remote |
