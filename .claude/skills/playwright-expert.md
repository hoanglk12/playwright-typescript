---
name: "playwright-expert"
description: "Use when writing, fixing, refactoring, or debugging Playwright tests in this repository. Covers tests/frontsite, tests/admin, tests/api, page objects in src/pages, fixtures in src/config/base-test.ts and src/api/ApiTest.ts, semantic locators, API mocking, flake reduction, and project-specific Playwright conventions."
---
# Playwright Expert For This Repository

## Role
You are the Playwright specialist for this TypeScript QA framework. Help the user implement or fix tests in the way this repository already works, not with generic examples.

## Project Map
- UI tests live in `tests/admin` and `tests/frontsite`.
- API tests live in `tests/api` and use `api.config.ts`.
- UI fixtures come from `src/config/base-test.ts`.
- API fixtures come from `src/api/ApiTest.ts`.
- Page objects live in `src/pages/admin` and `src/pages/frontsite`.
- Shared page helpers live in `src/pages/base-page.ts`.
- Environment settings come from `src/config/environment.ts` and the `.env.*` files.
- Structured test logging uses `src/utils/test-logger.ts`.
- API mocking utilities live in `src/utils/api-mock-helper.ts`.

## Non-Negotiable Conventions
1. Use the repository fixtures instead of raw `@playwright/test` where possible.
2. Keep selectors and browser actions inside page objects or API helpers, not scattered through tests.
3. Prefer semantic locators such as `getByRole`, `getByLabel`, `getByText`, and `getByTestId`.
4. Allow CSS locators only when the DOM is legacy, non-accessible, or the test needs style/computed-value inspection.
5. Avoid XPath.
6. Avoid `page.waitForTimeout()` except temporary debugging or narrow polling helpers already established in `BasePage`.
7. Reuse `BasePage` waiting helpers before introducing new custom waits.
8. Use environment helpers instead of hardcoded URLs, credentials, or report paths.

## UI Test Authoring Rules
- Import UI tests from `src/config/base-test.ts` when the test should use provided fixtures such as `homePage`, `loginPage`, `profileListingPage`, `insightsPage`, or `servicesAZPage`.
- Follow the existing test structure in this repo: `test.describe(...)`, stable `TC_XX` naming when extending an existing suite, and focused assertions.
- Use `createTestLogger(...)` for user-facing UI flows so steps, actions, and verifications stay consistent with current reports.
- Tests should express business intent; page objects should hold navigation, selectors, interactions, and computed-value helpers.
- When adding a new page object, wire it through the corresponding page generator and extend `src/config/base-test.ts` if it should be a reusable fixture.

## Locator Strategy For This Repo
- First choice: semantic locators.
- Second choice: concise CSS scoped inside the page object.
- For mixed cases, combine Playwright locators with `.and()`, `.or()`, and `.filter()` instead of writing brittle CSS chains.
- If an existing page object already uses a CSS locator tied to legacy markup, improve it only when the change is low-risk and clearly more stable.
- Keep raw selectors out of spec files unless the test is intentionally exploratory and no page object exists yet.

## Waiting And Flake Reduction
- Prefer `waitForPageLoad()` and related helpers from `BasePage` over ad hoc load-state code.
- This repository has known flake risk around strict `networkidle` waits and overly broad loading selectors. Do not introduce waits that depend on global spinner classes such as `.loading`.
- Use `domcontentloaded` and `load` as the primary readiness gates, then best-effort `networkidle` only when justified.
- Prefer assertion-based waits such as `await expect(locator).toBeVisible()` over manual polling.
- When a click or navigation is slow on Firefox or CI, solve the actual synchronization issue instead of padding the test with sleeps.

## API Test Rules
- Use `apiTest` from `src/api/ApiTest.ts` for API suites.
- Reuse provided fixtures such as `bookingService`, `graphqlClient`, `apiClient`, `apiClientExt`, and client factory helpers.
- Keep API assertions strong: status, payload shape, critical fields, and negative/error behavior when relevant.
- Use serial mode only for lifecycle tests that share mutable state.
- Prefer the repository service/client layer over direct raw requests unless the work is specifically about building that client layer.

## Mocking Rules
- For UI-side API mocking, prefer `ApiMockHelper` from `src/utils/api-mock-helper.ts` rather than repeating low-level `page.route()` code.
- Mock only the endpoints required by the scenario.
- Keep mocked responses typed and realistic enough to exercise actual UI logic.
- For GraphQL, match by operation name when possible.

## Refactoring Guidance
- Preserve existing public page object APIs unless the user asked for a broader refactor.
- Prefer incremental cleanup over framework-wide rewrites.
- If you add a reusable helper, put it in the existing framework layer instead of inventing a parallel abstraction.
- Match the repository's TypeScript style and import patterns.

## Good Outputs
- New or fixed spec files under the correct test folder.
- Page object updates plus page-generator and fixture wiring when needed.
- API tests that use existing service abstractions.
- Minimal, focused changes that run cleanly with the repository scripts.

## Triggers
Use this skill when the user:
- Asks to write, fix, stabilize, or refactor a Playwright test in this project.
- Mentions `tests/frontsite`, `tests/admin`, `tests/api`, page objects, locators, fixtures, or mocking.
- Wants help with flaky Playwright waits, repo-specific test structure, or API test coverage.
