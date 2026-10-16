---
name: gra-integration-test-report
description: "Canonical INT-001–035 integration test scenarios (incl. third-party INT-011+) for 8 GRA storefronts — ROI priority, system boundaries, file location"
type: project
tags: [memory, project]
source_session: b3f0ec60-b17d-47f8-9416-5b95e698f678
last_verified: 2026-10-16
---

Integration test strategy for all 8 GRA storefronts (Platypus AU/NZ, Skechers AU/NZ, Vans AU/NZ, Dr. Martens AU/NZ) is documented in `docs/study/gra-integration-test-scenarios.html` (created 2026-06-15; third-party update 2026-10-16 added Boundary E, INT-011..035, a vendor map and a back-office tier-C table, built on [[gra-third-party-recon-2026-10]]).

**Corrections applied 2026-10-16:** INT-001/006/007 samples and the mutation-interceptor pattern now match body-only `POST /graphql` (see [[gra-int001-graphql-analytics-quirks]]); ACDL event is `cart_add`; INT-002/006/008 now name the same-origin `/fredhopper/query` proxy as the search/PLP data source (there is no `products`/`productSearch` GraphQL query); INT-004 no longer claims automation stops before payment; the default noise-block list is the 4-pattern `NOISE_ROUTE_PATTERNS`, not a list that aborts PayPal/GA4/demdex.

**Why:** Defines 10 canonical scenarios (INT-001–010) with ROI scoring, cross-storefront coverage map, per-brand gotchas, and reusable TypeScript code patterns. Single source of truth for integration test planning.

**How to apply:** When writing integration tests for GRA, consult this report first for scenario IDs, system boundaries to assert, and which brands need special handling.

## Scenario Registry (P1 → P2)

| ID | Scenario | Coverage | ROI |
|---|---|---|---|
| INT-001 | Add to Cart — GraphQL mutation ↔ UI ↔ Analytics | All 8 | ★★★★★ |
| INT-002 | Search → Attraqt → PDP → ATC full revenue path | All 8 | ★★★★★ |
| INT-003 | Auth modal → Login → Cart persistence (cart merge) | All 8 | ★★★★ |
| INT-004 | Checkout entry → Shipping address → Order total | All 8 | ★★★★ |
| INT-005 | Localization — Currency + Qantas + dataLayer site config | All 8 | ★★★★ |
| INT-006 | GraphQL error fallback — 4 failure modes, graceful degradation | AU ×4 | ★★★★ |
| INT-007 | Promo code → `applyCouponToCart` → cart recalculation | All 8 | ★★★★ |
| INT-008 | PLP filter → GraphQL `products` query → count reduces | ×6 + △DRM | ★★★ |
| INT-009 | Colour swatch → variant URL (page.goto) → Swiper gallery sync | All 8 | ★★★ |
| INT-010 | Spend & Save threshold tiers (Skechers NZ only) | Skx NZ | ★★★ |
| INT-011 | Staging isolation: no navigation or vendor call reaches production (fails today: PLA NZ search, Vans gift-card link) | All 8 | ★★★★★ P1 |
| INT-012 | Payment radios ↔ storeConfig flags ↔ sandbox SDK iframes (AU 4 radios, NZ 3) | All 8 | ★★★★ P1 |
| INT-013 | Fredhopper proxy search/PLP + `/accent_{brand}/json` autocomplete + Attraqt beacon | All 8 | ★★★★ P1 |
| INT-014 | Kleber `getKleberTempKey` → lookup → `setShippingAddress`; outage → manual entry | All 8 | ★★★★ P1 |
| INT-015 | Abort one vendor at a time; purchase path still works | All 8 | ★★★★ P1 |
| INT-016 | Afterpay (Square) messaging on PDP/cart + $1–$2000 limit eligibility | All 8 | ★★★ P2 |
| INT-017..032 | Catalog rows: Qantas, Bazaarvoice, free-shipping threshold, Click & Collect, SEKO, Vii, Bloomreach, Adobe beacon, vendor bootstrap, CSP, PII in beacons, CMS media provenance, TrueFit, Zendesk, marketing tags, 3P weight/SRI/Lighthouse | varies | P2/P3 |
| INT-033 | storeConfig vendor contract (API project, no browser) | All 8 | P1 |
| INT-034 | Order-success tag checks bolted onto the opt-in PLAORD specs (no new orders) | All 8 | P2 |
| INT-035 | Fastly/origin preflight: mark a store env-down instead of N red tests | All 8 | P2 |

## Key implementation facts

- **Route blocking:** `AtcAnalyticsData.NOISE_ROUTE_PATTERNS` / `applyNoiseRouteBlocks()` currently blocks nothing: `**/truefitcorp.com/**`-style globs need a `/` right before the domain, so they never match subdomain hosts (verified offline 2026-10-16, Playwright 1.61.1). Use `**/*.truefitcorp.com/**`, `**/*.fullstory.com/**`, `**/www.facebook.com/tr**`, `**/*.taboola.com/**`. Fixing `analytics-events.ts` is a pending code change. Never block PayPal/Braintree/Afterpay in payment scenarios, Adobe/GA in analytics scenarios, or anything in INT-011.
- **Vans popup:** `#popup.popup.visible` blocks clicks — must call `dismissVansPopup()` before any Vans interaction
- **Login constraint:** never navigate to `/customer/account/login` (404) — trigger modal via header account icon
- **Cart seeding:** use Magento REST API (`POST /rest/V1/guest-carts/{id}/items`) before checkout/promo tests
- **ACDL:** use `window.adobeDataLayer?.getState?.()` for current state; array scan only for event lookup
- **GraphQL interception:** URL `operationName=` matching works for GET queries only. Mutations are body-only `POST /graphql`: route `**/graphql*` and match a substring of the body's `query` (see `createAddToCartCapture()`). Pass through with `route.fulfill({ response })`; mock only for error paths.
- **Skechers h1:** never assert `h1` on Skechers — 8–14 empty `<h1>` from PageBuilder banners
- **DRM product count:** `getTotalProductCount()` returns 0 on DRM AU — use soft assertion, open investigation
