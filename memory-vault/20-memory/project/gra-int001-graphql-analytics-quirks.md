---
name: gra-int001-graphql-analytics-quirks
description: GRA storefront ATC quirks discovered during INT-001 (2026-07-17) — cart_add event name, POST-body-only mutation, addConfigurableProductsToCart field variant
metadata:
  type: project
---

# GRA INT-001 — live-verified add-to-cart quirks (all 8 storefronts)

Discovered while building `tests/ecommerce/integration/add-to-cart-integration.spec.ts` (E2E-INT-001-001..008), verified against live staging traffic on 2026-07-17. Shared utilities live in `tests/ecommerce/integration/integration-helpers.ts`; constants in `src/data/ecommerce/analytics-events.ts` (`AtcAnalyticsData`); Vans post-ATC popup dismissal is `EcommercePDPPage.dismissPostAtcPopup()`. Helper→fixture promotion threshold: promote `createAddToCartCapture` to a factory fixture when a second integration spec needs it.

1. **Analytics event name is `cart_add`, NOT GA4's `add_to_cart`** (Adobe Client Data Layer 2.0.2). Product name lives at `cart_items[0].name`, not `event.name` / `event.product.name`. Spec keeps `add_to_cart` only as a secondary fallback.
2. **The ATC mutation is `POST /graphql` with NO query string** — `operationName` is in the JSON body only. Any URL-shaped route pattern (`**/graphql?**operationName=...**`) can never match it. Queries are GraphQL-GET (see [[gra-storefront-tech-notes]]); mutations are bare-URL POST.
3. **Client operationName is `addConfigurableProductToCart` (singular Product); the GraphQL field is `addConfigurableProductsToCart` (plural)** — neither contains the doc-assumed `addProductsToCart`. Robust interception: route `**/graphql*`, filter POST + body query containing the `ProductsToCart` substring (matches all Magento variants: add/addConfigurable/addSimple; matched nothing else in observed traffic — createCart, createBraintreeClientToken, ClientConfiguration all pass through).
4. **Read the mutation payload positionally** (`Object.values(payload.data)[0]?.cart?.items`) — the response field name varies per variant; hardcoding `data.addProductsToCart` silently yields undefined.
5. TypeScript strict-mode gotcha: a `let` reassigned inside a `page.route` closure narrows to `never` on later optional-chained reads — box it in an object (`{ payload: T | null }`).
6. `docs/gra-integration-test-scenarios.html` INT-001 sample code has two bugs now known: the `adobeDataLayer?.getState?.() ?? dataLayer?.find(...)` analytics check is vacuously truthy, and its route pattern is the dead URL-shaped one from (2).
