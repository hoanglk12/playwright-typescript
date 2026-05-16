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

`PercyHelper` is **not** a `BasePage` field — it is available only as the `percyHelper` fixture in tests.

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
// Soft assertions (test continues after failure):
import { test, expect, softExpect } from '@config/base-test';
```

`base-test.ts` extends Playwright's `test` with all custom page object fixtures. Importing from `@playwright/test` directly loses those fixtures.

## Configs

| Config | Scope | Command |
|---|---|---|
| `playwright.config.ts` | UI tests (ignores `**/api/**`) | `npm test` |
| `api.config.ts` | API tests only (1 worker, serial) | `npm run test:api` |

Both configs read from `src/config/environment.ts` which loads `.env.{NODE_ENV}`.

**Reporters** — both configs run these reporters in parallel (additive, no conflicts):

| Reporter | Output | Purpose |
|---|---|---|
| `html` | `playwright-report/` / `api-report/` | Playwright built-in interactive report |
| `json` | `test-results/results.json` / `api-results/results.json` | CI tooling and artifact parsing |
| `junit` | `test-results/results.xml` / `api-results/results.xml` | JUnit-compatible test management |
| `list` / `line` | stdout | Console progress during local runs |
| `monocart-reporter` | `monocart-report/` / `monocart-api-report/` | Rich interactive grid report, trend/history, GitHub Actions step summary, Slack-ready summary |

## Adding a New Page Object

1. Extend `BasePage`, constructor takes only `page: Page`
2. **Locators MUST be declared as `private readonly` class fields at the top of the class — never inline inside method bodies, `page.evaluate()` argument literals, or helper-call argument literals.** This applies to both `Locator` instances and raw selector strings. Methods reference the field; only dynamic, parameter-driven locators may live in private helper methods (which themselves consume field-level selector constants).
3. Prefer `page.getByRole()` / `page.getByLabel()` / `page.getByText()` over CSS selectors
4. Keep CSS selectors only when needed for `this.style.*` computed-style queries or browser-side `evaluate()` calls
5. Place under `src/pages/{area}/` matching the app area (frontsite, admin, ecommerce)
6. Register as a fixture in `src/config/base-test.ts`

```ts
import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class MyPage extends BasePage {
  // CORRECT — locators hoisted to class fields
  private readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });
  private readonly submitSelector = '[data-testid="submit"]';

  constructor(page: Page) { super(page); }

  async clickSubmit(): Promise<void> {
    // CORRECT — references the field
    await this.elements.clickElement(this.submitSelector);

    // WRONG — selector inlined inside helper call
    // await this.elements.clickElement('[data-testid="submit"]');
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
| `ecommercePLPPage` | `EcommercePLPPage` | ecommerce |
| `ecommercePDPPage` | `EcommercePDPPage` | ecommerce |
| `percyHelper` | `PercyHelper` | visual regression |
| `softAssert` | `SoftAssertHelper` | soft assertions with logger integration |

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

## Soft Assertions

Soft assertions let a test **continue past a failure** and report all failures together at the end. Two patterns are available:

**Pattern A — `softExpect` (bare, no logger):** drop-in replacement for `expect`, useful for quick multi-checks.

```ts
import { test, expect, softExpect } from '@config/base-test';

test('TC_01 - Multi-check', async ({ myPage }) => {
  softExpect(title).toContain('Expected');  // fails → test continues
  expect(url).toContain('/dashboard');      // hard — still terminates on fail
});
```

**Pattern B — `softAssert` fixture (recommended):** integrates with `TestLogger`; each call is logged with `🔵 [SOFT]`.

```ts
import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';

test('TC_02 - Multi-check', async ({ myPage, softAssert }) => {
  const logger = createTestLogger('TC_02 Multi-check');

  logger.step('Step 1 - Verify page state');
  softAssert.toBe(count, 12, 'Item count');
  await softAssert.toBeVisible(myPage.header, 'Header visible');
  // test continues; all failures reported together at completion
});
```

`SoftAssertHelper` methods: `toBe`, `toEqual`, `toContain`, `toMatch`, `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeDefined`, `toBeGreaterThan`, `toBeLessThan`, `toHaveLength`, `toBeVisible` (async), `toHaveText` (async).

### When to use soft assertions

Use soft when a test makes **multiple independent observable checks** — seeing all failures at once is more useful than stopping at the first.

**Use soft for:**
- Multiple property checks on the same page state (title, count, label, visibility) where each check is independent
- Per-item assertions inside a loop (e.g. every nav link has a visible label AND valid href — both facts matter for each item)
- Final outcome assertions that are independent of each other (e.g. URL changed AND result count > 0)

**Keep hard (never soft) for:**
- **Preconditions** that guard subsequent steps — if `initialCount > 0` fails, the filter comparison is meaningless; stop the test
- **Playwright locator assertions** (`expect(locator).toHaveCSS(...)`, `expect(locator).toBeInViewport(...)`, `expect(locator).toContainText(...)`) — `SoftAssertHelper` has no equivalent; use `expect(locator).*` as-is
- **`expect.poll()`** — has its own retry/timeout logic; wrapping it soft adds no value
- **Single-assertion tests** — soft provides no benefit when there is only one check

**Eliminate double-logging:** `SoftAssertHelper` calls `logger.verify(...)` internally with `isSoft: true`. Do not also call `logger.verify(...)` manually before a `softAssert.*` call — it duplicates the log entry.

## Test Data

Never hardcode test data in spec files. Create typed data modules in `src/data/`:

- **Constants** (static expected values) → `const` objects annotated with a named interface type
- **Generated data** (random/dynamic) → generator classes/functions with explicit return types matching a named interface
- **Always declare interfaces** for every data shape — both `const` objects and generator return types must carry a named interface annotation. Never rely on inferred types for exported data.
- See `src/data/admin-data.ts` as the reference pattern

```ts
// CORRECT — interface declared, const annotated, generator return typed
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AdminDataShape {
  VALID_ADMIN: LoginCredentials;
  INVALID_ADMIN: LoginCredentials;
  EMPTY_CREDENTIALS: LoginCredentials;
}

export const AdminData: AdminDataShape = {
  VALID_ADMIN: { username: 'admin', password: 'pass123' },
  INVALID_ADMIN: { username: 'wrong', password: 'wrong' },
  EMPTY_CREDENTIALS: { username: '', password: '' },
};

export interface CustomerData {
  customerName: string;
  email: string;
}

export class AdminTestDataGenerator {
  static generateCustomerData(): CustomerData {
    const ts = Date.now();
    return { customerName: `Test User ${ts}`, email: `test${ts}@example.com` };
  }
}

// WRONG — untyped const, inferred return type
export const AdminData = { VALID_ADMIN: { username: 'admin', password: 'pass' } };
static generateCustomerData() { return { customerName: 'Test' }; }
```

## API Tests

### Import — Critical Difference from UI Tests

API tests use a separate base test — **never import from `@config/base-test` in API test files**:

```ts
import { apiTest as test, expect, softExpect } from '../../src/api/ApiTest';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
```

### Serial Mode — Mandatory

Every API spec file must declare this at the top, outside all `test.describe` blocks:

```ts
test.describe.configure({ mode: 'serial' });
```

### Fixtures (defined in `src/api/ApiTest.ts`)

| Fixture | Type | Purpose |
|---|---|---|
| `apiBaseUrl` | `string` | Resolved base URL from env |
| `restfulApiBaseURL` | `string` | Restful-device API base URL |
| `graphqlURL` | `string` | `graphqlBaseUrl + graphqlEndpoint` |
| `apiClient` | `ApiClient` | Raw REST client (low-level HTTP) |
| `apiClientExt` | `ApiClientExt` | REST client with `*WithWrapper` methods (preferred) |
| `restfulApiClient` | `RestfulApiClient` | Device API (restful-device service) |
| `bookingService` | `RestfulBookerService` | Restful-booker service abstraction |
| `graphqlClient` | `GraphQLClient` | GraphQL queries and mutations |
| `createClient` | factory | Custom `ApiClient` with any `ApiClientOptions` |
| `createClientExt` | factory | Custom `ApiClientExt` with any `ApiClientOptions` |
| `createRestfulApiClient` | factory | Custom `RestfulApiClient` with any options |
| `createGraphQLClient` | factory | Custom `GraphQLClient` (e.g. different auth) |
| `softAssert` | `SoftAssertHelper` | Soft assertions integrated with logger |

### Auth Types (`AuthType` enum)

```ts
AuthType.NONE        // No auth headers
AuthType.BASIC       // Basic auth (username + password → base64)
AuthType.BEARER      // Bearer token in Authorization header
AuthType.API_KEY     // Custom header name + value
AuthType.CUSTOM      // Arbitrary headers via customHeaders map
```

### `ApiClientExt` — Preferred REST Client

`ApiClientExt` adds `*WithWrapper` methods that return `ApiResponseWrapper` for assertion chaining:

```ts
const response = await apiClientExt.getWithWrapper('/resource/1');
await response.assertStatus(200);
await response.assertJsonPath('id', 1);
await response.assertJsonPathContains('tags', 'active');
await response.assertHasHeader('content-type');
const value = await response.extract('data.name');
```

Available methods: `getWithWrapper`, `postWithWrapper`, `putWithWrapper`, `patchWithWrapper`, `deleteWithWrapper`.

### `ApiResponseWrapper` Assertion Chain

| Method | Description |
|---|---|
| `assertStatus(code)` | Assert HTTP status code |
| `assertJson(expected)` | `toMatchObject` on full JSON body |
| `assertJsonPath(path, value)` | Dot-notation path equality (`'user.name'`) |
| `assertJsonPathContains(path, value)` | Contains check (string, array, or partial object) |
| `assertHeader(name, value)` | Header value equality |
| `assertHasHeader(name)` | Header exists |
| `statusCode()` | Returns HTTP status code (sync) |
| `isSuccess()` | `status >= 200 && <= 299` |
| `isClientError()` | `status >= 400 && <= 499` |
| `isServerError()` | `status >= 500 && <= 599` |
| `json<T>()` | Parse body as JSON (throws if not JSON content-type) |
| `text()` | Body as string |
| `extract<T>(path)` | Dot-notation extraction from JSON |
| `header(name)` | Single header value |
| `headers()` | All headers as `Record<string, string>` |

### GraphQL — `GraphQLClient`

`GraphQLClient` extends `ApiClient`. Always use `*Wrapped` methods to get `GraphQLResponseWrapper`.

```ts
// Query with variables
const response = await graphqlClient.queryWrapped(
  `query GetUser($id: ID!) { user(id: $id) { id name } }`,
  { id: '1' }
);
await response.assertNoErrors();           // REQUIRED on every happy-path test
await response.assertDataField('user.id', '1');

// Mutation
const response = await graphqlClient.mutateWrapped(
  `mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) { id name }
  }`,
  { input: { name: 'Alice', email: 'alice@example.com' } }
);
await response.assertNoErrors();
await response.assertHasData();
```

**Key `GraphQLClient` methods:** `query`, `mutate`, `queryWrapped`, `mutateWrapped`, `introspect`, `addToBatch`, `executeBatch`, `parseGraphQLResponse`, `hasErrors`, `getErrorMessages`

**`GraphQLResponseWrapper` assertion chain:**

| Method | Description |
|---|---|
| `assertNoErrors()` | Fails if `errors` field present — call first on happy-path |
| `assertHasErrors()` | Fails if no `errors` field |
| `assertErrorMessage(msg)` | Partial match on any error message |
| `assertErrorCode(code)` | Matches `extensions.code` on any error |
| `assertErrorPath(path[])` | Matches error `path` array |
| `assertData(expected)` | `toMatchObject` on `data` field |
| `assertDataField(path, value)` | Dot-notation equality in `data` |
| `assertDataFieldContains(path, value)` | Contains check in `data` |
| `assertHasData()` | `data` is defined and not null |
| `assertDataHasFields(fields[])` | Each field name present in `data` |
| `getListSize(path)` | Array length at dot-notation path |
| `assertListSize(path, size)` | Assert array length |
| `getData<T>()` | Returns typed `data` object |
| `getErrors()` | Raw GraphQL errors array |
| `getErrorMessages()` | String array of error messages |

**Never string-interpolate variables into query strings:**

```ts
// WRONG — injection risk, breaks caching
await graphqlClient.queryWrapped(`query { user(id: "${id}") { name } }`);

// CORRECT — always use the variables argument
await graphqlClient.queryWrapped(
  `query GetUser($id: ID!) { user(id: $id) { name } }`,
  { id }
);
```

### REST API Test Template

```ts
import { apiTest as test, expect } from '../../src/api/ApiTest';
import { MyApiData } from '../../src/data/my-api-data';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe.configure({ mode: 'serial' });

test.describe('Resource API @api @regression', () => {
  test('TC_01 - Should fetch resource by ID', async ({ apiClientExt }) => {
    const logger = createTestLogger('TC_01 Should fetch resource by ID');

    logger.step('Step 1 - GET /resource/1');
    const response = await apiClientExt.getWithWrapper('/resource/1');

    logger.step('Step 2 - Assert response');
    await response.assertStatus(200);
    await response.assertJsonPath('id', 1);
    logger.verify('Resource returned with correct ID', 1, await response.extract('id'));
  });

  test('TC_02 - Should return 404 for unknown resource', async ({ apiClientExt }) => {
    const logger = createTestLogger('TC_02 Should return 404 for unknown resource');

    logger.step('Step 1 - GET /resource/99999');
    const response = await apiClientExt.getWithWrapper('/resource/99999');

    logger.step('Step 2 - Assert not found');
    await response.assertStatus(404);
  });
});
```

### GraphQL Test Template

```ts
import { apiTest as test, expect } from '../../src/api/ApiTest';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe.configure({ mode: 'serial' });

test.describe('User GraphQL API @api @graphql', () => {
  test('TC_01 - Should query user', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_01 Should query user');

    logger.step('Step 1 - Execute GetUser query');
    const response = await graphqlClient.queryWrapped(
      `query GetUser($id: ID!) { user(id: $id) { id name email } }`,
      { id: '1' }
    );

    logger.step('Step 2 - Assert response');
    await response.assertNoErrors();
    await response.assertDataField('user.id', '1');
    logger.verify('User found', '1', (await response.getData()).user?.id);
  });
});
```

### Cross-Test Token Sharing

`ApiClient.tokenStore` is static — tokens persist across tests within a single worker:

```ts
// Store after login
ApiClient.storeToken('admin', tokenString);

// Retrieve in any later test
const token = ApiClient.getToken('admin');

// Create a pre-authed client
const client = await ApiClient.withStoredToken(
  { baseURL: process.env.API_BASE_URL! },
  'admin'
);
```

### Other API Infrastructure

- **Shared state**: `tests/api/shared-state.ts` — state that must survive across test files in one worker
- **Lifecycle**: `tests/api/global-setup.ts` and `tests/api/global-teardown.ts` — before/after the full API suite
- **Mocking** (UI tests only): `ApiMockService` in `src/api/ApiMockService.ts` — centralised scenarios (`mockSuccessfulLogin`, `mockProductList`, `mockGraphQLQuery`, `mockGraphQLError`, etc.)
- **Services**: `src/api/services/{service-name}/` — models live alongside their service
- **Config**: `api.config.ts` — 1 worker, serial execution; reads from `.env.{NODE_ENV}` via `src/api/config/environment.ts`
- **Run**: `npm run test:api` — 1 worker to avoid rate-limiting

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
npm run test:api:headed           # API tests with visible browser
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
npm run report:monocart           # open monocart UI report (interactive grid)
npm run report:monocart:api       # open monocart API report
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

All five ecommerce fixtures in `base-test.ts` (`ecommerceHomePage`, `ecommerceNavPage`, `ecommerceSearchPage`, `ecommercePLPPage`, `ecommercePDPPage`) navigate to `about:blank` before teardown on Firefox. This is intentional: Firefox's Juggler protocol hangs on `context.close()` when SPAs have active service workers or persistent WebSocket connections. Do not remove this workaround from any of these fixtures.

## monocart Reporter

monocart-reporter supplements the built-in reporters (keep all existing reporters — they feed CI tooling). It is configured in both `playwright.config.ts` and `api.config.ts`.

**Output locations:**
- UI: `monocart-report/index.html` + `monocart-report/index.json`
- API: `monocart-api-report/index.html` + `monocart-api-report/index.json`

**Trend / history:** In CI, a branch-scoped `actions/cache` stores the previous run's `index.json`. Set `MONOCART_TREND_FILE` (UI) or `MONOCART_API_TREND_FILE` (API) to the path of that JSON before running tests — the reporter reads it to render a trend chart.

**GitHub Actions Step Summary:** The `onEnd` hook in each config automatically appends a markdown table of test counts to `$GITHUB_STEP_SUMMARY` when running in CI.

**Slack notification:** `playwright-with-slack.yml` merges per-OS shard reports in the `test-report` job and exposes summary counts (`tests`, `passed`, `failed`, `skipped`, `flaky`, `duration`) as job outputs. The `notify-slack` job reads `needs.test-report.outputs.*` to populate the Slack Block Kit payload. `api-restful-tests-with-slack.yml` does the same from `needs.api-tests.outputs.*`.

**Local view:** `npm run report:monocart` or `npm run report:monocart:api`

## Global Lifecycle

- **Setup** (`src/config/global-setup.ts`): clears logs, loads env, cleans/creates output dirs, validates browser installations, tests connectivity to target apps
- **Teardown** (`src/config/global-teardown.ts`): generates reports (including monocart check), creates `test-summary.txt`, archives artifacts in CI only, cleans temp files

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

Key constants: `PAGE_LOAD`, `NETWORK_IDLE_SLOW`, `ELEMENT_VISIBLE`, `DIALOG_APPEAR`, `DRAG_DROP_OPERATION`, `API_RESPONSE`, `API_RESPONSE_SLOW`.

## Memory (New Machine Setup)

Claude Code memory files are stored outside the repo at `~/.claude/projects/{encoded-path}/memory/`. On a new machine, seed them from the committed copies:

```powershell
.\.claude\memory-seed\init-memory.ps1
```

To keep seeds in sync after updating memory: copy the updated files from `~/.claude/projects/.../memory/` back into `.claude/memory-seed/` and commit.

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
| `technical-research-agent` | Researches SDKs, integrations, upgrades, scalability — produces a structured Technical Research Report. No code edits. |
| `technical-implementation-agent` | Implements approved technical changes from a Research Report (framework, config, deps, CI). Only runs after user approval. |

Use `qa-orchestrator` as the default entry point for any end-to-end QA workflow (plan → build → review → fix).

For framework/infra/integration changes (new SDK, Playwright upgrade, CI rework, scalability work), `qa-orchestrator` runs a two-stage pipeline: `technical-research-agent` produces a report → **user approves** → `technical-implementation-agent` applies the change → `qa-code-reviewer` + `devops-cicd-specialist` verify. Research never auto-flows into implementation; user approval is a hard gate, even if you say "just do it".

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
| `/playwright-cli` | Interactive browser automation via playwright-cli shell tool |
| `/llm-council` | Multi-model council review for complex decisions |
