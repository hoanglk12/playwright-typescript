# Design Patterns Used in This Framework

## 1. Composition over Inheritance (Core Architecture)

`BasePage` owns **9 helper instances** (`WaitHelper`, `ElementHelper`, `StyleHelper`, `FrameHelper`, `FileHelper`, `StorageHelper`, `NetworkHelper`, `TableHelper`, `PercyHelper`) rather than inheriting from a monolithic base. New behaviour goes into helpers, not into `BasePage` itself.

> `src/pages/base-page.ts:31–50`

---

## 2. Page Object Model (POM)

Each area of the app (frontsite, admin, ecommerce) has a dedicated class that encapsulates locators and interactions. Tests interact with the app only through these classes, never raw Playwright APIs.

> `src/pages/frontsite/home-page.ts`, `src/pages/admin/login-page.ts`, etc.

---

## 3. Facade Pattern

`BasePage` exposes ~60 backward-compatible delegations (`clickElement`, `waitForPageLoad`, etc.) that forward calls to the underlying helpers. Tests and existing page objects see a single simplified surface, not the helper subsystem. `ApiMockService` similarly aggregates all mock scenarios behind named methods.

> `src/pages/base-page.ts:230–330`, `src/api/ApiMockService.ts`

---

## 4. Decorator / Wrapper Pattern

`ApiResponseWrapper` and `GraphQLResponseWrapper` wrap Playwright's raw `APIResponse` to layer on fluent assertion methods (`assertStatus`, `assertJsonPath`, `assertNoErrors`, `extract`, etc.) without modifying the original objects.

> `src/api/ApiResponse.ts`, `src/api/GraphQLResponse.ts`

---

## 5. Inheritance Chain (API Layer)

A deliberate class hierarchy for the API clients:

```
ApiClient
  ├── ApiClientExt          (adds *WithWrapper methods)
  ├── GraphQLClient         (adds query/mutate/batch)
  ├── RestfulBookerService  (restful-booker domain operations)
  └── RestfulApiClient      (restful-device domain operations)
```

> `src/api/ApiClientExt.ts:7`, `src/api/GraphQLClient.ts:41`, `src/api/services/*/`

---

## 6. Strategy Pattern

`AuthType` enum + a `switch` block in `ApiClient.init()` selects the auth strategy at runtime (`NONE` / `BASIC` / `BEARER` / `API_KEY` / `CUSTOM`). Callers choose a strategy by passing an option; the switch applies it.

> `src/api/ApiClient.ts:51–73`

---

## 7. Static Factory Method

`ApiClient.withStoredToken(options, tokenKey)` is a static factory that retrieves a stored token and returns a fully initialised `ApiClient` in a single call — the caller never touches the constructor or `init()` directly.

> `src/api/ApiClient.ts:118–133`

---

## 8. Fixture / Dependency Injection Pattern

Playwright's `test.extend<Fixtures>()` in `base-test.ts` and `ApiTest.ts` injects page objects, API clients, and helpers into tests. Tests declare what they need in their signature; the harness constructs and tears down the objects.

> `src/api/ApiTest.ts:33`, `src/config/base-test.ts`

---

## 9. Service Object Pattern

`RestfulBookerService` and `RestfulApiClient` wrap domain-specific API operations (`authenticate`, `createBooking`, `deleteBooking`, …) behind named methods. Tests call domain language, not raw HTTP verbs.

> `src/api/services/restful-booker/RestfulBookerService.ts`, `src/api/services/restful-device/`

---

## 10. Centralised Mock Service

`ApiMockService` aggregates all route-mocking scenarios (`mockSuccessfulLogin`, `mockProductList`, `mockGraphQLError`, etc.) in one place. Tests call one method per scenario instead of configuring `page.route()` individually.

> `src/api/ApiMockService.ts`

---

## 11. Fluent Interface / Method Chaining

Both `ApiResponseWrapper` and `GraphQLResponseWrapper` expose sequential assertion methods that read like prose, improving test readability without boilerplate.

```ts
const response = await apiClientExt.getWithWrapper('/resource/1');
await response.assertStatus(200);
await response.assertJsonPath('id', 1);
await response.assertHasHeader('content-type');
```

> `src/api/ApiResponse.ts`, `src/api/GraphQLResponse.ts`

---

## 12. Static Shared State (Token Store)

`ApiClient.tokenStore` is a `static` field — a single in-process store that survives across test instances within the same worker. `storeToken` / `getToken` provide the interface for cross-test token sharing.

> `src/api/ApiClient.ts:35, 99–108`

---

## 13. Data Transfer Object (DTO)

Every data shape is backed by a named TypeScript `interface` — `LoginCredentials`, `BookingRequest`, `AuthResponse`, etc. — and passed between layers as plain objects. No logic lives in the data classes.

> `src/data/`, `src/api/services/restful-booker/models.ts`

---

## 14. Abstract Class / Template Method

`BasePage` is declared `abstract`. Subclasses must provide page-specific locators and methods; `BasePage` supplies shared navigation, window-management, and utility operations that apply to every page.

> `src/pages/base-page.ts:28`

---

## 15. Adapter Pattern

Each helper class (`ElementHelper`, `WaitHelper`, `NetworkHelper`, etc.) adapts Playwright's low-level `page.*` API into a higher-level, domain-meaningful interface. Page objects never call `page.locator()` or `page.click()` directly.

> `src/pages/helpers/element-helper.ts`, `src/pages/helpers/wait-helper.ts`, etc.

---

## Summary Table

| # | Pattern | Where Applied |
|---|---|---|
| 1 | Composition over Inheritance | `BasePage` + 9 helpers |
| 2 | Page Object Model | `src/pages/**` |
| 3 | Facade | `BasePage` delegations; `ApiMockService` |
| 4 | Decorator / Wrapper | `ApiResponseWrapper`, `GraphQLResponseWrapper` |
| 5 | Inheritance Chain | `ApiClient` → `ApiClientExt`, `GraphQLClient`, services |
| 6 | Strategy | `AuthType` enum + `switch` in `ApiClient.init()` |
| 7 | Static Factory Method | `ApiClient.withStoredToken()` |
| 8 | Fixture / Dependency Injection | `test.extend()` in `base-test.ts`, `ApiTest.ts` |
| 9 | Service Object | `RestfulBookerService`, `RestfulApiClient` |
| 10 | Centralised Mock Service | `ApiMockService` |
| 11 | Fluent Interface | `ApiResponseWrapper`, `GraphQLResponseWrapper` chains |
| 12 | Static Shared State | `ApiClient.tokenStore` |
| 13 | Data Transfer Object (DTO) | `src/data/`, `src/api/services/*/models.ts` |
| 14 | Abstract Class / Template Method | `abstract class BasePage` |
| 15 | Adapter | All helper classes in `src/pages/helpers/` |
