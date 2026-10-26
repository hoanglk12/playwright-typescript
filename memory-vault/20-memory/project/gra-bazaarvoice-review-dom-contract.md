---
name: gra-bazaarvoice-review-dom-contract
description: GRA Bazaarvoice review widgets (PLP inline rating, PDP review section, write-a-review form) — stable hooks, unrated-product traps, and the fill() trap that silently drops review text on submit
metadata:
  type: project
type: project
tags: [memory, project, ecommerce, bazaarvoice, reviews]
last_verified: 2026-10-26
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

## Write-a-review form (E2E-REV-008)
Live-verified 2026-10-26 (Platypus AU and Vans AU submitted; DM AU and Skechers AU checked without submitting). The user approved
automating real submits on BV staging that day, overriding the discovery report's "manual only" status.
- **Entry:** on rated PDPs, the reviews section has five `role="button"` divs, "Select to rate the item with N stars".
  Clicking one opens the form with that rating pre-selected (seen on Vans, DM and Skechers AU). The other entry, "Write a review"
  (`button.bv_war_button`), sits under the `aria-hidden` `role="button"` rating-summary wrapper, so `getByRole` can't find it
  and `getByText` can. Vans has no working "Write a review", so try the star buttons first.
- **Dialog:** `getByRole('dialog')` filtered by "My Review". Its close button renders seconds before the fields, so wait on a field.
- **Fields:** textboxes named "Review." / "Review Title." / "Nickname." / "Email."; rating radios `#bv-ips-star-rating-1..5`.
  The terms checkbox only toggles by clicking `label[for="sps-termsAndConditions-checkbox"]`. Clicking the styled div does nothing.
- **Trap: `fill()` is not seen by BV on review text and title.** The DOM holds the value, but BV submits without it.
  Platypus accepted a rating-only review. Vans (title required) blocked submit with "Required: Review Title."
  `clear()` + `pressSequentially()` works. Nickname and email take `fill()`, but type every field anyway.
- **Network:** a POST to `apps-stg.bazaarvoice.com/.../initiateSubmit.json` fires when the form opens, then
  `progressiveSubmit.json` fires on Submit. Its body has `submissionFields.{rating, reviewtext, title, usernickname,
  hostedauthentication_authenticationemail, agreedtotermsandconditions}`. On success the response is
  `{response:{hasErrors:false, response:{submissionId, isFormComplete:true}}}`. These give a deterministic pass/fail.
  Assert on the request payload, because a DOM check misses the `fill()` trap.
- **Limits** (from the response `fields`): reviewtext min 50, title max 50, nickname min 4. Required fields are rating, nickname,
  email and terms; Vans also requires title.
- **UI after submit:** an `aria-live` span says "Your response was submitted successfully for Your reviews." Step 1 then
  shows Completed, and the optional steps (images, personal info, product rating) follow. The review is final at step 1.
- **Recon submissions to reject in BV moderation:** `r212868-en_17930215LxkoV0cLQK` (Platypus AU, rating-only) and
  `r227976_1__17930218mkKLR0xsd5` (Vans AU).

Related: [[gra-storefront-tech-notes]], [[gra-third-party-recon-2026-10]], [[ecommerce-pdp-page-gotchas]], [[gra-search-dom-contract]], [[gra-braintree-payment]]
