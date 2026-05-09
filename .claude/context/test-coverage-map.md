# Test Coverage Map

## Page Objects → Spec Files

### Frontsite (`src/pages/frontsite/`)

| Page Object | Fixture | Spec file |
|---|---|---|
| `home-page.ts` | `homePage` | `tests/frontsite/home-page.spec.ts` |
| `form-drag-and-drop.ts` | `formDragAndDropPage` | `tests/frontsite/form-drag-and-drop.spec.ts` |
| `profile-listing-page.ts` | `profileListingPage` | `tests/frontsite/profile-listing-page.spec.ts` |
| `insights-page.ts` | `insightsPage` | `tests/frontsite/insights-search.spec.ts` |
| `services-az-page.ts` | `servicesAZPage` | `tests/frontsite/services-az-list.spec.ts` |

### Admin (`src/pages/admin/`)

| Page Object | Fixture | Spec file |
|---|---|---|
| `login-page.ts` | `loginPage` | `tests/admin/login.spec.ts` |

### Ecommerce (`src/pages/ecommerce/`)

| Page Object | Fixture | Spec file |
|---|---|---|
| `home-page.ts` | `ecommerceHomePage` | `tests/ecommerce/smoke/homepage-smoke.spec.ts` |
| `nav-page.ts` | `ecommerceNavPage` | `tests/ecommerce/smoke/navigation-smoke.spec.ts` |
| `search-page.ts` | `ecommerceSearchPage` | `tests/ecommerce/smoke/search-smoke.spec.ts` |
| `plp-page.ts` | — | `tests/ecommerce/smoke/plp-smoke.spec.ts` |

### API (`tests/api/`)

| Spec | Client/Service fixture | Scope |
|---|---|---|
| `restful-booker.spec.ts` | `bookingService` | CRUD for Restful Booker API |
| `objects-crud.spec.ts` | `restfulApiClient` | Device API CRUD (restful-api.dev) |
| `graphql-examples.spec.ts` | `graphqlClient` | GraphQL queries + mutations |
| `api-mocking-examples.spec.ts` | `apiClient` | API mock/intercept patterns |
| `pla-account-creation-signin.spec.ts` | `apiClientExt` | PLA account flow |
| `pla-cart_minicart.spec.ts` | `apiClientExt` | PLA cart operations |
| `pla-my-details.spec.ts` | `apiClientExt` | PLA profile details |
| `pla-support-features.spec.ts` | `apiClientExt` | PLA support features |

## Coverage gaps (as of 2026-05-10)

- No UI tests for ecommerce checkout flow
- No UI tests for admin content management
- `plp-smoke.spec.ts` — all tests currently skipped (`test.skip(true, ...)`) — PLP nav links not configured
