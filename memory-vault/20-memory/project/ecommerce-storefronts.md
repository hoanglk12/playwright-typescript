---
name: ecommerce-storefronts
description: "All 8 ecommerce storefronts — staging URLs, nav labels, quirks, preferMens brands, API project codes"
type: project
tags: [memory, project]
last_verified: 2026-06-12
---

## Storefront Registry (8 sites)

| Brand | Staging URL | hasQantasPoints | API siteCode |
|---|---|---|---|
| Platypus AU | stag-platypus-au.accentgra.com | ✅ | pla-au |
| Platypus NZ | stag-platypus-nz.accentgra.com | ❌ | — |
| Skechers AU | stag-skechers-au.accentgra.com | ✅ | skx-au |
| Skechers NZ | stag-skechers-nz.accentgra.com | ❌ | — |
| Vans AU | stag-vans-au.accentgra.com | ✅ | van-au |
| Vans NZ | stag-vans-nz.accentgra.com | ❌ | — |
| Dr. Martens AU | stag-drmartens-au.accentgra.com | ✅ | drm-au |
| Dr. Martens NZ | stag-drmartens-nz.accentgra.com | ❌ | — |

AU sites earn Qantas Points; NZ sites do not. Only 4 AU brands have GRA API projects.

## Nav Label Spelling — Critical

Each brand uses its own exact spelling for nav labels. Mismatches cause nav click failures.

| Brand | Women's | Men's | Kids | Sale |
|---|---|---|---|---|
| Platypus AU | WOMENS | MENS | KIDS | SALE |
| Platypus NZ | *(none)* | MENS | KIDS | SALE |
| Skechers AU | WOMEN | MENS | KIDS | SALE |
| Skechers NZ | WOMEN | MENS | KIDS | SALE |
| Vans AU | WOMEN | MEN | KIDS | OUTLET |
| Vans NZ | WOMEN | MEN | KIDS | SALE |
| Dr. Martens AU | WOMEN | MEN | KIDS | SALE |
| Dr. Martens NZ | WOMEN | MEN | KIDS | BLACK FRIDAY |

- Platypus NZ has **no WOMENS nav link** — excluded from E2E-NAV-002
- Vans AU uses **OUTLET** (navigates to /shop/sale) — not "SALE"
- Dr. Martens NZ uses **BLACK FRIDAY** (staging seasonal label, navigates to /shop/sale)
- Vans AU CLOTHING is a dropdown trigger with no `<a>` — excluded from nav link assertions

## preferMens — Which Brands Need It

`getPreferredNavLabel(site, preferMens)` in `smoke-helpers.ts` encodes this:

| Brand | preferMens | Why |
|---|---|---|
| Skechers AU | ✅ | WOMENS PLP starts with non-footwear (no size selector) |
| Skechers NZ | ✅ | Same reason |
| Vans NZ | ✅ | WOMENS lands on sub-category PLP (Classics), not individual PDPs |
| All others | ❌ | WOMENS PLP has footwear |

**Platypus AU exception:** MENS starts with socks — not a valid footwear fallback. Always use WOMENS for Platypus AU even when in doubt.

## Known Per-Brand DOM Quirks

See [[ecommerce-pdp-page-gotchas]] for full detail. Summary:

| Brand | Quirk | Impact |
|---|---|---|
| Vans AU | Bloomreach acquisition popup (`.bloomreach-acquisition-popup-template.state-open`) | Intercepts swatch clicks and cart icon clicks; `dismissAcquisitionPopup()` must be called first |
| Dr. Martens AU | Gallery images use `alt="image-product"` (styled-components hashed class names) | `[class*="gallery"] img` alone misses them — must include `img[alt*="product"]` |
| Dr. Martens NZ | Two `<h1>` elements on PDP (product name + marketing heading) | Always use `.first()` on `getByRole('heading', { level: 1 })` |
| Platypus AU | MENS PLP starts with socks | Don't use MENS as footwear fallback for E2E-CART-002 scan |
| All storefronts | Mini cart overlay renders as `<aside>` / `[role="complementary"]`, NOT `role="dialog"` | Three-part gate in `EcommerceCartOverlayPage.isOverlayVisible()` required |
| Dr. Martens AU | `getTotalProductCount()` returns 0 (open investigation 2026-06-10) | `<p>` regex `/^(\d+)\s+Products$/i` doesn't match DM AU format — causes E2E-PLP-004/006 to fail |

## GRA API Projects (4 AU brands only)

`api.config.ts` has 4 Playwright projects that share the 15 `pla-*.spec.ts` spec files:

| Project name | siteCode | Staging GraphQL endpoint |
|---|---|---|
| pla-au | pla-au | stag-platypus-au.accentgra.com/graphql |
| skx-au | skx-au | stag-skechers-au.accentgra.com/graphql |
| drm-au | drm-au | stag-drmartens-au.accentgra.com/graphql |
| van-au | van-au | stag-vans-au.accentgra.com/graphql |

drm-au and van-au have `testIgnore: ['**/pla-loyalty-rewards.spec.ts']` — loyalty feature not deployed.

**Import rule for GRA API specs:** use `graTest as test` from `./gra-test`, not `apiTest` from `ApiTest`. See [[pla-api-testing]].
