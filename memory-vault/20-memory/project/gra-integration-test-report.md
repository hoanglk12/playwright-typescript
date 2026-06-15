---
name: gra-integration-test-report
description: "Canonical INT-001–010 integration test scenarios for 8 GRA storefronts — ROI priority, system boundaries, file location"
type: project
tags: [memory, project]
source_session: b3f0ec60-b17d-47f8-9416-5b95e698f678
last_verified: 2026-06-15
---

Integration test strategy for all 8 GRA storefronts (Platypus AU/NZ, Skechers AU/NZ, Vans AU/NZ, Dr. Martens AU/NZ) is documented in `docs/gra-integration-test-scenarios.html` (created 2026-06-15).

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

## Key implementation facts

- **Route blocking:** block TrueFit, FullStory, Facebook, Taboola, PayPal, GA4, demdex in `beforeEach` — see [[gra-storefront-tech-notes]]
- **Vans popup:** `#popup.popup.visible` blocks clicks — must call `dismissVansPopup()` before any Vans interaction
- **Login constraint:** never navigate to `/customer/account/login` (404) — trigger modal via header account icon
- **Cart seeding:** use Magento REST API (`POST /rest/V1/guest-carts/{id}/items`) before checkout/promo tests
- **ACDL:** use `window.adobeDataLayer?.getState?.()` for current state; array scan only for event lookup
- **GraphQL interception:** `page.route('**/graphql?**operationName=X**', ...)` — pass through with `route.fulfill({ response })`, never mock unless testing error paths
- **Skechers h1:** never assert `h1` on Skechers — 8–14 empty `<h1>` from PageBuilder banners
- **DRM product count:** `getTotalProductCount()` returns 0 on DRM AU — use soft assertion, open investigation
