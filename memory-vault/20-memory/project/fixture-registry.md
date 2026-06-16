---
name: fixture-registry
description: "All registered test fixtures — UI base-test.ts and API ApiTest.ts — with Firefox teardown list and registration rules"
type: project
tags: [memory, project]
last_verified: 2026-06-16
---

## UI Fixtures (src/config/base-test.ts)

Import: `import { test, expect } from '@config/base-test'`

| Fixture | Type | Area | Firefox teardown? |
|---|---|---|---|
| `homePage` | `HomePage` | frontsite | — |
| `loginPage` | `LoginPage` | admin | — |
| `formDragAndDropPage` | `FormDragAndDropPage` | frontsite | — |
| `profileListingPage` | `ProfileListingPage` | frontsite | — |
| `insightsPage` | `InsightsPage` | frontsite | — |
| `servicesAZPage` | `ServicesAZPage` | frontsite | — |
| `ecommerceHomePage` | `EcommerceHomePage` | ecommerce | ✅ |
| `ecommerceNavPage` | `EcommerceNavPage` | ecommerce | ✅ |
| `ecommerceSearchPage` | `EcommerceSearchPage` | ecommerce | ✅ |
| `ecommercePLPPage` | `EcommercePLPPage` | ecommerce | ✅ |
| `ecommercePDPPage` | `EcommercePDPPage` | ecommerce | ✅ |
| `ecommerceCartOverlayPage` | `EcommerceCartOverlayPage` | ecommerce | ✅ |
| `ecommerceAccountModalPage` | `EcommerceAccountModalPage` | ecommerce | ✅ |
| `percyHelper` | `PercyHelper` | visual regression | — |
| `softAssert` | `SoftAssertHelper` | soft assertions | — |

**Firefox teardown pattern** (all 6 ecommerce fixtures): navigates to `about:blank` before context teardown on Firefox. Prevents Juggler protocol hang caused by SPA service workers + persistent WebSocket/analytics connections on staging storefronts. **Do not remove.**

## API Fixtures (src/api/ApiTest.ts)

Import: `import { apiTest as test, expect } from '../../src/api/ApiTest'`

| Fixture | Type | Purpose |
|---|---|---|
| `apiBaseUrl` | `string` | Resolved base URL from env |
| `apiClient` | `ApiClient` | Raw REST client |
| `apiClientExt` | `ApiClientExt` | REST client with `*WithWrapper` methods (preferred) |
| `graphqlClient` | `GraphQLClient` | GraphQL queries/mutations |
| `bookingService` | `RestfulBookerService` | Restful-booker abstraction |
| `restfulApiClient` | `RestfulApiClient` | Device API client |
| `softAssert` | `SoftAssertHelper` | Soft assertions with logger |
| `createClient` | factory | Custom `ApiClient` |
| `createClientExt` | factory | Custom `ApiClientExt` |
| `createGraphQLClient` | factory | Custom `GraphQLClient` |

**GRA API fixtures** (`src/api/gra-test.ts`, extends `apiTest`):

| Fixture | Type | Purpose |
|---|---|---|
| `site` | `SiteContext` | Current brand config (siteCode, baseURL, testData, hasLoyalty) |
| `siteState` | `TestState` | Per-brand isolated shared state (Map-keyed by siteCode) |

Import: `import { graTest as test, expect } from './gra-test'` — only for `pla-*.spec.ts` files.

## softExpect vs softAssert

| | `softExpect` (Pattern A) | `softAssert` fixture (Pattern B) |
|---|---|---|
| Import | `import { softExpect } from '@config/base-test'` | inject `{ softAssert }` in test args |
| Logs internally? | ❌ — call `logger.verify()` yourself | ✅ — logs with `🔵 [SOFT]` automatically |
| Use when | Quick multi-check, no logger needed | Preferred for structured tests |

Do NOT call `logger.verify()` before `softAssert.*` — it logs internally. DO call `logger.verify()` before `softExpect()` — it doesn't.

## Registering a New Fixture

1. Create page class extending `BasePage` in `src/pages/{area}/`
2. Import the class in `src/config/base-test.ts`
3. Add to `CustomFixtures` type
4. Add fixture definition in `base.extend<CustomFixtures>({ ... })`
5. If ecommerce area: add Firefox teardown workaround (see existing ecommerce fixtures for pattern)
6. Update CLAUDE.md fixture table

**Never call `page.locator()` or `page.click()` directly in page classes** — use `this.elements.*`, `this.waits.*`, etc.
