---
name: ecommerce-guest-wishlist
description: Guest wishlist flow on all 8 GRA storefronts — PDP add button, session guest wishlist, header badge gate, wishlist card DOM quirks (GRA-3403 / E2E-WISH-001)
type: project
tags: [memory, project, ecommerce, wishlist]
last_verified: 2026-10-28
---

**Status (2026-10-27):** the spec and its page-object methods (`addToWishlist()`, `getHeaderWishlistCount()`, item/header/footer helpers) were built, passed 8/8 on Chromium (headless, and headed with `--workers=2`), then **removed from the repo at the user's request** — this note is kept for a demo. Re-implement from the facts below; the methods do not currently exist.

Guests CAN add to wishlist on all 8 GRA staging storefronts (confirmed live 2026-10-27). Spec: `tests/ecommerce/regression/wishlist.spec.ts` (E2E-WISH-001, Xray GRA-3403, guest variant of its `${userType}` dataset) — Chromium 8/8.

- **Entry point:** PDP button "ADD TO WISHLIST" / "Add to Wishlist" (casing varies by brand) → `EcommercePDPPage.addToWishlist()`. No wishlist control on PLP cards. Button text does NOT change after adding.
- **Session:** storefront calls `addProductsToGuestWishlist`; `localStorage.wishlist_guest` holds `{id, guest_hash}`. A fresh browser context = empty wishlist, so tests are independent.
- **Gate on the header badge**, not the button or a GraphQL `waitForResponse`: `Toggle Wishlist` button text becomes the count (`getHeaderWishlistCount()` + `expect.poll`). Skechers AU once added the item without the mutation appearing in the probe's request log.
- **Wishlist page:** heading "MY WISHLIST" (h2) + "(N)"; guest sign-in prompt still shows with items present. Item cards have NO `data-product-id`; image gallery is one `<a>` wrapping a swiper carousel (incl. off-canvas loop clones). Clicking an individual `<img>` fails with `div.page-content intercepts pointer events` — click the gallery link instead. CTA wording varies: "Quick Add" / "add to cart" / "Add To Cart".
- **Header/footer:** plain `<header>`/`<footer>` tags with no `banner`/`contentinfo` roles; footer only renders after scrolling to the bottom.
- PDP h1 text matches the wishlist image `alt` case-insensitively on all 8 storefronts.

**Mobile (390×844, Platypus AU, live 2026-10-28 for GRA-3214 / E2E-PDP-016):** a guest PDP→wishlist spec covering Platypus AU and NZ on Desktop and Mobile passed 4/4 on Chromium twice. Like E2E-WISH-001, it was then **reverted at the user's request**, so its code (PDP `addToWishlist()`, the survey-popup `addLocatorHandler`, wishlist count and listing helpers, `pdp-wishlist.spec.ts`) does not exist in the repo.
- `ADD TO WISHLIST` is a single visible button (also `data-analytics-pdp="add-to-wishlist"`), below the fold; no size selection needed. `Toggle Wishlist` header badge stays in the header (not in the hamburger) and goes "" → "1". Mobile `/wishlist` card `alt` equals the PDP h1 exactly.
- **Exit-intent survey popup** `#surveyPopup` (`popup-container`, fixed, z-index 99, "Why did you decide to leave today?") intercepted the wishlist click. Close via `#closeBtn` (`aria-label="Close popup"`). Scope the close locator to `#surveyPopup`, because Vans' Bloomreach `#popup-close` has the same aria-label.
- Top-nav links are probably collapsed on mobile, so reach a PDP through `{site.url}search?q={searchTerm}` (product `.html` links render at 390px), not `navigateToPlp()`.
- Xray steps for GRA tickets are in a cross-origin iframe: `get_page_text`/`read_page` return nothing, so scroll to "Test details" and screenshot it instead.

Related: [[ecommerce-pdp-page-gotchas]], [[execution-config]], [[fixture-registry]]
