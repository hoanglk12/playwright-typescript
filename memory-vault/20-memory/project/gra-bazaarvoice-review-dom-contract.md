---
name: gra-bazaarvoice-review-dom-contract
description: GRA Bazaarvoice review widgets (PLP inline rating + PDP review section) — stable hooks, and two traps where data-bv-ready / "out of 5 stars" pass for unrated products
metadata:
  type: project
type: project
tags: [memory, project, ecommerce, bazaarvoice, reviews]
last_verified: 2026-10-16
---

Live-verified 2026-10-16 while implementing E2E-REV-002 (`tests/ecommerce/smoke/pdp-review-smoke.spec.ts`).
PDP probe covered Platypus AU, Skechers AU, Vans NZ, Dr. Martens NZ; the "0.0" PLP widget finding
came from the healer's failing run on Platypus NZ + Skechers AU/NZ.

## PDP review section (E2E-REV-002)
- Host: `[data-bv-show="reviews"]` (DIV, `id="bv-reviews"`, carries `data-bv-product-id`). Same on all 4 brand platforms.
- **Not** under an `aria-hidden` ancestor — unlike `[data-bv-show="rating_summary"]` next to the title, which is.
- Renders without scrolling. Latency observed: ~6s Vans NZ, ~10s DM NZ, ~16s Skechers AU → poll with `TIMEOUTS.PAGE_LOAD_SLOW`.
- Rated product text includes "Rating Snapshot" and "Overall Rating" (case varies by brand CSS → use `/i`).

## Trap 1 — `data-bv-ready="true"` is set on unrated products too
Unrated PDP (Platypus AU `/classic-clog-10001-83a-org.html`): the reviews host has `data-bv-ready="true"`
but is **0px tall with empty text**. Any assertion keyed on the attribute alone passes with no reviews on screen.
Key on rendered text via `.filter({ hasText })`, and make sure the test lands on a rated product.

## Trap 2 — unrated PLP cards can say "0.0 out of 5 stars"
Platypus NZ, Skechers AU and Skechers NZ render an inline rating widget on **unrated** cards reading
"0.0 out of 5 stars. 0 reviews". Platypus AU renders nothing for unrated cards. So filtering on
`'out of 5 stars'` picks unrated products on 3/8 sites. Rated-only filter: `/[1-9]\.\d out of 5 stars/i`
(`EcommercePLPPage.nonZeroRatingPattern`, used by `getRatedInlineRatingCount()` / `clickFirstRatedProductCard()`).

E2E-REV-001 (`plp-rating-smoke.spec.ts`) still uses the plain `'out of 5 stars'` filter and a 0–5 range check,
so a "0.0" widget satisfies it — it proves a widget rendered, not that a rated product exists. Left as-is pending a team decision.

## Shadow DOM — `textContent()` vs `hasText`
Bazaarvoice content is in an open shadow root. `locator.textContent()` on the `#bv-reviews` host returned
**empty** on Skechers/Vans/DM (it reads DOM `textContent`, which doesn't pierce shadow roots), while
`locator.filter({ hasText })` matched (Playwright's text engine pierces). Never parse review text via
`textContent()`/`innerText`/`evaluate`; never assert on review body text (shared BV data holds test reviews).

## PLP card anchors
A rated Platypus AU card holds 2 anchors (promo badge "USE: KBC30" + product link), same PDP href.
`clickProductCard(index)` indexes `[data-product-id] a` (anchors, not cards), so a card index ≠ anchor index —
use the card-scoped `clickFirstRatedProductCard()` instead.

Related: [[gra-storefront-tech-notes]], [[gra-third-party-recon-2026-10]], [[ecommerce-pdp-page-gotchas]], [[gra-search-dom-contract]]
