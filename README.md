# Playwright TypeScript Automation Framework

A production-grade test automation framework built with Playwright and TypeScript for the **AG GRA e-commerce platform** and frontsite applications. Covers UI smoke testing across 8 ecommerce brands, frontsite regression, admin authentication, and a GraphQL API suite that runs across 4 GRA brands concurrently.

---

## Features

- **Composition-based Page Object Model** — `BasePage` with 8 dedicated helper classes (elements, waits, style, frames, files, storage, network, tables)
- **GRA Multi-brand API Testing** — 15 GraphQL spec files run across 4 brands (pla-au, skx-au, drm-au, van-au) via Playwright projects
- **Ecommerce UI Smoke Suite** — 6 spec files covering homepage, navigation, search, PLP, PDP, and cart across 8 brand/region storefronts
- **Dual Configs** — `playwright.config.ts` for UI tests, `api.config.ts` for API tests (no browser)
- **Soft Assertions** — `softAssert` fixture (logger-integrated) and `softExpect` (bare drop-in)
- **Visual Regression** — Percy integration via `percyHelper` fixture
- **Performance Testing** — Lighthouse CI with desktop and mobile profiles
- **Reporters** — HTML, JSON, JUnit, and monocart (interactive grid + CI step summary + Slack)
- **Docker** — Full containerised test execution for all browsers and API
- **CI/CD** — 6 GitHub Actions workflows with Slack notifications

---

## Project Structure

```
playwright-typescript/
├── src/
│   ├── api/                        # API testing infrastructure
│   │   ├── ApiTest.ts              # apiTest fixtures (base for non-GRA specs)
│   │   ├── ApiClient.ts            # Raw HTTP client + token store
│   │   ├── ApiClientExt.ts         # *WithWrapper methods → ApiResponseWrapper
│   │   ├── GraphQLClient.ts        # GraphQL queries/mutations + batch
│   │   ├── ApiMockService.ts       # Route-based mock scenarios (UI tests)
│   │   ├── ApiResponseWrapper.ts   # Fluent assertion chain for REST responses
│   │   ├── GraphQLResponseWrapper.ts
│   │   └── config/environment.ts  # API environment loader
│   │
│   ├── pages/                      # Page Object Model
│   │   ├── base-page.ts            # BasePage — owns 8 helper instances
│   │   ├── admin/
│   │   │   └── login-page.ts
│   │   ├── frontsite/
│   │   │   ├── home-page.ts
│   │   │   ├── profile-listing-page.ts
│   │   │   ├── insights-page.ts
│   │   │   ├── services-az-page.ts
│   │   │   └── form-drag-and-drop.ts
│   │   ├── ecommerce/
│   │   │   ├── home-page.ts
│   │   │   ├── nav-page.ts
│   │   │   ├── search-page.ts
│   │   │   ├── plp-page.ts
│   │   │   ├── pdp-page.ts
│   │   │   └── cart-overlay-page.ts
│   │   └── helpers/
│   │       ├── element-helper.ts
│   │       ├── wait-helper.ts
│   │       ├── style-helper.ts
│   │       ├── frame-helper.ts
│   │       ├── file-helper.ts
│   │       ├── storage-helper.ts
│   │       ├── network-helper.ts
│   │       ├── table-helper.ts
│   │       └── percy-helper.ts
│   │
│   ├── config/
│   │   ├── base-test.ts            # Extended test with all UI page fixtures
│   │   ├── environment.ts          # UI environment loader
│   │   ├── global-setup.ts
│   │   └── global-teardown.ts
│   │
│   ├── data/                       # Typed test data modules
│   │   ├── admin-data.ts
│   │   ├── home-data.ts
│   │   ├── ecommerce/storefronts.ts
│   │   └── api/                    # GRA API test data (one file per domain)
│   │       ├── gra-test-data.ts    # Core account/cart test data + GraTestData type
│   │       ├── gra-auth-data.ts
│   │       ├── gra-catalog-data.ts
│   │       ├── gra-search-data.ts
│   │       ├── gra-wishlist-data.ts
│   │       ├── gra-customer-profile-data.ts
│   │       ├── gra-loyalty-rewards-data.ts
│   │       └── sites.ts            # Brand registry: siteCode → baseURL + testData
│   │
│   └── utils/
│       ├── test-logger.ts          # createTestLogger → step/action/verify/error
│       └── soft-assert-helper.ts
│
├── tests/
│   ├── admin/
│   │   └── login.spec.ts
│   ├── frontsite/
│   │   ├── home-page.spec.ts
│   │   ├── profile-listing-page.spec.ts
│   │   ├── insights-search.spec.ts
│   │   ├── services-az-list.spec.ts
│   │   └── form-drag-and-drop.spec.ts
│   ├── ecommerce/smoke/            # 6 smoke specs × 8 brands via storefronts.ts
│   │   ├── homepage-smoke.spec.ts
│   │   ├── navigation-smoke.spec.ts
│   │   ├── search-smoke.spec.ts
│   │   ├── plp-smoke.spec.ts
│   │   ├── pdp-smoke.spec.ts
│   │   └── cart-smoke.spec.ts
│   └── api/
│       ├── gra-test.ts             # graTest fixture (extends apiTest with site + siteState)
│       ├── shared-state.ts         # Per-brand token/cart/address state
│       ├── api-test-helpers.ts     # signInAndStoreToken utility
│       ├── global-setup.ts
│       ├── global-teardown.ts
│       ├── gra-account-creation-signin.spec.ts
│       ├── gra-authentication.spec.ts
│       ├── gra-cart-minicart.spec.ts
│       ├── gra-catalog.spec.ts
│       ├── gra-checkout-billing-payment.spec.ts
│       ├── gra-checkout-shipping.spec.ts
│       ├── gra-customer-profile.spec.ts
│       ├── gra-loyalty-rewards.spec.ts
│       ├── gra-my-details.spec.ts
│       ├── gra-order-history.spec.ts
│       ├── gra-place-order.spec.ts
│       ├── gra-search.spec.ts
│       ├── gra-support-features.spec.ts
│       ├── gra-wishlist.spec.ts
│       └── gra-address-book-countries.spec.ts
│
├── scripts/
│   ├── bulk-ingest-jira.mjs        # Bulk-ingest GRA Jira Stories + Epics → vault
│   ├── sync-memory-to-vault.mjs    # Syncs live memory → memory-vault/
│   ├── sync-vault-to-lightrag.mjs # Syncs vault notes to LightRAG knowledge graph
│   └── init-memory-from-vault.mjs # Bootstrap live memory from vault (new machine)
│
├── playwright.config.ts            # UI test config (chromium + firefox, ignores api/)
├── api.config.ts                   # API config (4 GRA brand projects + misc-api)
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

---

## Setup

### Prerequisites

- Node.js 18+
- Git

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Or install browsers with system dependencies (Linux/CI)
npm run install:browsers:deps
```

### Environment files

```bash
# Copy the example and fill in your values
cp .env.testing .env.local
```

Key variables in `.env.{NODE_ENV}`:

```bash
FRONT_SITE_URL=https://...          # Frontsite base URL
ADMIN_URL=https://...               # Admin CMS URL
API_BASE_URL=https://...            # REST API base URL
HEADLESS=true                       # true/false
WORKERS=50%                         # Worker count or percentage
TRACE_MODE=on-first-retry
SCREENSHOT_MODE=only-on-failure
VIDEO_MODE=retain-on-failure
PERCY_TOKEN=...                     # Required for visual regression runs
```

---

## Running Tests

### UI Tests

```bash
# Headless, chromium + firefox, 50% workers (default)
npm test

# Visible browser
npm run test:headed

# Playwright inspector
npm run test:debug

# Interactive UI mode
npm run test:ui

# Single browser, 1 worker (fastest for debugging)
npm run test:simple

# Area-specific (chromium, 1 worker)
npm run test:simple:admin
npm run test:simple:frontsite

# Parallel
npm run test:parallel            # 50% workers
npm run test:parallel:max        # 100% workers
npm run test:parallel:all        # chromium + firefox + webkit

# Environments
npm run test:testing
npm run test:staging
npm run test:production

# Run by file or grep
npx playwright test tests/frontsite/home-page.spec.ts
npx playwright test --grep "TC_01"
npx playwright test --grep "@smoke"
```

### API Tests

```bash
# All API tests — 4 GRA brand workers + misc-api
npm run test:api

# Environment-specific
npm run test:api:testing

# Debug / UI mode
npm run test:api:debug
npm run test:api:ui

# Non-GRA suites only
npm run test:api:booker           # restful-booker
npm run test:api:device-booker    # objects-crud
```

### Visual Regression (Percy)

```bash
npm run test:percy                # Full run against testing env
npm run test:percy:staging
npm run test:percy:smoke          # Smoke subset only
npm run test:percy:admin
npm run test:percy:login
```

Percy snapshots are silently skipped when `PERCY_TOKEN` is not set.

### Performance (Lighthouse CI)

```bash
npm run lhci:run                  # Collect + upload + assert
npm run lhci:collect
npm run lhci:assert
npm run lhci:run:mobile           # Mobile profile
```

### Reports

```bash
npm run report                    # Open HTML report
npm run report:open               # Port 9323
npm run report:api                # API report, port 9324
npm run report:monocart           # Interactive monocart grid (UI)
npm run report:monocart:api       # Interactive monocart grid (API)
```

### Docker

```bash
npm run docker:build
npm run docker:test               # All browsers
npm run docker:test:chromium
npm run docker:test:firefox
npm run docker:test:webkit
npm run docker:test:api
npm run docker:test:parallel      # All browsers in parallel
npm run docker:dev                # Start dev container
npm run docker:clean
```

### Utilities

```bash
npm run lint                      # TypeScript type check (no emit)
npm run clean                     # Remove all test output dirs
npm run clean:install             # Clean + npm ci + install browsers
npm run sync-memory               # Sync live memory → vault → LightRAG
npm run codegen                   # Playwright recording tool
```

### Knowledge Base — Jira Ingestion

Bulk-ingest GRA Jira Stories and Epics into the memory vault so requirements are queryable via LightRAG semantic search inside Claude Code.

**Step 1 — Create a Jira API token**

Go to `https://id.atlassian.com/manage-profile/security/api-tokens` and generate a token.

**Step 2 — Export credentials and run**

```powershell
$env:JIRA_EMAIL = "your-email@accentgroup.com.au"
$env:JIRA_API_TOKEN = "your-api-token"

# Quick probe — fetch and preview 5 issues without writing (API connectivity check)
npm run ingest:jira:probe

# Full dry run — preview all matching issues without writing files
npm run ingest:jira:dry

# Incremental ingestion — writes new issues, skips existing
npm run ingest:jira

# Force refresh — overwrites all existing vault notes
npm run ingest:jira:force
```

**Step 3 — Sync to LightRAG**

```bash
npm run sync:vault
```

Each issue is written to `memory-vault/20-memory/project/jira/jira-GRA-NNN.md` with frontmatter (key, status, priority, assignee, labels) and the full description including Acceptance Criteria.

Re-run `npm run ingest:jira` at any time to pick up newly created or updated issues — existing files are skipped unless `--force` is passed.

**Querying requirements from Claude Code**

After syncing, ask Claude Code natural-language questions against the vault:

```
What are the acceptance criteria for the PayPal checkout story?
Which GRA stories cover cart behaviour?
List all In Progress epics.
What does GRA-148 require?
```

---

## Architecture

### Page Object Model

All page classes extend `BasePage`, which owns 8 helper instances. Never call `page.locator()` or `page.click()` directly inside a page class — use the helpers:

| Property | Class | Purpose |
|---|---|---|
| `this.elements` | `ElementHelper` | Clicks, text input, queries, scroll, drag-drop |
| `this.waits` | `WaitHelper` | Page/element/network synchronisation |
| `this.style` | `StyleHelper` | Computed colour, dimensions, CSS reads |
| `this.frames` | `FrameHelper` | iframe operations |
| `this.files` | `FileHelper` | File upload / drag-and-drop |
| `this.storage` | `StorageHelper` | Cookies, localStorage, sessionStorage, clipboard |
| `this.network` | `NetworkHelper` | Route mocking, request interception, performance |
| `this.tables` | `TableHelper` | HTML table interactions |

`PercyHelper` is fixture-only (`percyHelper`) — not a `BasePage` field.

#### Page class template

```ts
import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class MyPage extends BasePage {
  // Locators must be private readonly class fields — never inline
  private readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });
  private readonly titleSelector = '[data-testid="page-title"]';

  constructor(page: Page) { super(page); }

  async clickSubmit(): Promise<void> {
    await this.elements.clickElement(this.submitBtn);
  }

  async getTitle(): Promise<string> {
    return this.elements.getText(this.titleSelector);
  }
}
```

Register every new page class as a fixture in `src/config/base-test.ts`.

### Import Rules

```ts
// UI tests — always this, never @playwright/test directly
import { test, expect } from '@config/base-test';
import { test, expect, softExpect } from '@config/base-test';

// API tests — always this, never @config/base-test
import { apiTest as test, expect } from '../../src/api/ApiTest';

// GRA API specs specifically
import { graTest as test, expect, softExpect } from './gra-test';
```

### Path Aliases (tsconfig)

```
@pages/*   → src/pages/*
@tests/*   → tests/*
@utils/*   → src/utils/*
@config/*  → src/config/*
@data/*    → src/data/*
```

---

## Writing Tests

### UI Test

```ts
import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('Feature Name @smoke @regression', () => {
  test('TC_01 - Description', async ({ homePage }) => {
    const logger = createTestLogger('TC_01 Description');

    logger.step('Step 1 - Navigate');
    await homePage.navigateToPage();

    logger.step('Step 2 - Assert');
    expect(await homePage.isLoaded()).toBeTruthy();
  });
});
```

Tags go in the `test.describe()` name string: `@smoke`, `@regression`, `@critical`.

### Soft Assertions

```ts
// Pattern A — bare, no logger
import { test, softExpect } from '@config/base-test';

test('TC_01 - Multi-check', async ({ myPage }) => {
  softExpect(title).toContain('Expected');   // continues on failure
  softExpect(count).toBe(12);
});

// Pattern B — fixture with logger integration (recommended)
test('TC_02 - Multi-check', async ({ myPage, softAssert }) => {
  const logger = createTestLogger('TC_02');
  logger.step('Step 1 - Verify');
  softAssert.toBe(count, 12, 'Item count');
  await softAssert.toBeVisible(myPage.header, 'Header visible');
});
```

Use soft assertions for multiple independent checks. Keep hard assertions for preconditions that guard subsequent steps.

### GRA GraphQL API Test

```ts
import { graTest as test, expect, softExpect } from './gra-test';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('GRA GraphQL API - Feature @api @graphql', () => {
  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    const client = await createGraphQLClient();
    customerToken = await signInAndStoreToken(client, logger, site, siteState);
  });

  test('TC_01 - Description', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_01 Description');

    logger.step('Step 1 - Execute query');
    const response = await graphqlClient.queryWrapped(
      `query GetCustomer { customer { email firstname } }`
    );

    logger.step('Step 2 - Assert');
    await response.assertNoErrors();
    await response.assertDataField('customer.email', site.testData.validCredentials.email);
  });
});
```

GRA specs use `fullyParallel: false` (sequential within spec) + 4 workers (one per brand, concurrently). Do **not** add `test.describe.configure({ mode: 'serial' })` to GRA specs.

---

## GRA Multi-Brand API Architecture

Each `gra-*.spec.ts` file runs 4 times — once per brand — via `api.config.ts` project fan-out:

| Project | Brand | GraphQL Endpoint |
|---|---|---|
| `pla-au` | Platypus AU | `stag-platypus-au.accentgra.com/graphql` |
| `skx-au` | Skechers AU | `stag-skechers-au.accentgra.com/graphql` |
| `drm-au` | Dr. Martens AU | `stag-drmartens-au.accentgra.com/graphql` |
| `van-au` | Vans AU | `stag-vans-au.accentgra.com/graphql` |

`gra-test.ts` reads `testInfo.project.metadata.siteCode` and resolves it to a `SiteContext` (baseURL, testData, currency, etc.) from `src/data/api/sites.ts`. Each test accesses `site.testData` for brand-specific credentials and expected values.

### ApiResponseWrapper chain (REST)

```ts
const response = await apiClientExt.getWithWrapper('/resource/1');
await response.assertStatus(200);
await response.assertJsonPath('id', 1);
await response.assertJsonPathContains('tags', 'active');
const value = await response.extract('data.name');
```

### GraphQLResponseWrapper chain

```ts
const response = await graphqlClient.queryWrapped(query, variables);
await response.assertNoErrors();          // always first on happy-path
await response.assertDataField('user.id', '1');
await response.assertListSize('products.items', 10);
```

---

## Reporting

### Reporters (both configs)

| Reporter | Output | Purpose |
|---|---|---|
| `html` | `playwright-report/` / `api-report/` | Interactive Playwright report |
| `json` | `test-results/results.json` / `api-results/results.json` | CI artifact parsing |
| `junit` | `test-results/results.xml` / `api-results/results.xml` | Test management integration |
| `list` / `line` | stdout | Console progress |
| `monocart-reporter` | `monocart-report/` / `monocart-api-report/` | Grid view, trend history, Slack summary |

Monocart appends a test count table to `$GITHUB_STEP_SUMMARY` automatically in CI.

---

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `playwright.yml` | Push / PR | UI tests across OS matrix |
| `playwright-with-slack.yml` | Push / PR | UI tests + Slack notification |
| `api-restful-tests.yml` | Push / PR | GRA API tests (4-brand) |
| `api-restful-tests-with-slack.yml` | Push / PR | API tests + Slack notification |
| `percy-visual-tests.yml` | Push / PR | Percy visual regression |
| `lighthouse-ci.yml` | Push / PR | Lighthouse performance audit |

---

## Test Naming Conventions

| Suite | Pattern | Example |
|---|---|---|
| UI / API | `TC_XX - Description` | `TC_01 - User can log in with valid credentials` |
| Ecommerce smoke | `E2E-{DOMAIN}-{NNN}-{site}` | `E2E-CART-001-pla-au` |
| Older GRA specs | `GRA_OperationName - description` | `GRA_SignIn - valid credentials` |

Do not rename existing tests — breaks CI tag filtering and monocart trend history.

---

## Contributing

- Extend `BasePage` — never call `this.page.*` directly in page classes
- Declare all locators as `private readonly` class fields — never inline in method bodies
- Use `getByRole` / `getByLabel` / `getByText` over CSS selectors
- Never import from `@playwright/test` directly in test files — always `@config/base-test` (UI) or `../../src/api/ApiTest` (API)
- Use `TIMEOUTS` constants from `src/constants/timeouts.ts` — never magic numbers
- Never hardcode test data — use typed modules in `src/data/`

---

## Author

Hoang Pham — Senior Quality Engineer  
hoanglk12@gmail.com
