---
name: gra-search-dom-contract
description: GRA storefront search DOM contract — autocomplete selectors, no-results state per brand, and three traps that make search tests pass for the wrong reason
metadata:
  type: project
---

Live-verified against all 8 GRA staging storefronts on 2026-09-12 while implementing
E2E-SRCH-004/005. Re-deriving this costs ~45 min of browser probing.

## Autocomplete (E2E-SRCH-005)
Present on **all 8** storefronts. Stable, non-hashed hooks inside `div.search`:
- `a.product-suggestion` — 2–6 nodes after typing, **0 before**. The reliable signal.
- `.category-suggestions button` — exactly 1 on four sites; too shallow to assert on.
- `.text-suggestion` / `.word-suggestions` ("Did you mean") — **absent on Skechers AU+NZ**.
  Asserting it fails 2/8.
- The dropdown's own container is a styled-components hash (`sc-eIWpXs OrHyt`) — never use.

`enterText` (Playwright `fill`) triggers it — the handler is React `onChange`, not keyup,
so `clearAndTypeSequentially` is unnecessary despite the helper's general docblock caveat.

**Scope the selector to `div.search`.** A page-wide `a.product-suggestion` count is wrong:
the "absent before typing" precondition then reads any homepage block that adopts the class.

**The suggestion list is network-backed and slow under parallel load** — observed ~21s on
Skechers AU at 4 workers, against 4–8s for its siblings. A wait sized at `ELEMENT_VISIBLE`
(10s local) fails intermittently on a *different* test each run, which is the signature of
a marginal timeout rather than a site-specific DOM fact. Use `PAGE_LOAD_SLOW`.

## No-results state (E2E-SRCH-004) — NOT all sites

> **Status: E2E-SRCH-004 is NOT implemented.** It was built with a `showsNoResultsState`
> per-site flag, then removed on request (2026-09-12) along with that flag,
> `NO_RESULTS_SEARCH_TERM` and `NO_RESULTS_MESSAGE_PATTERN`. Only E2E-SRCH-005 shipped.
> Everything below is the investigation record — read it before re-attempting the scenario.
Hook is `.empty-search-text` (2 nodes when shown, 0 on a normal results page — a genuine
discriminator, not merely hidden).

Measured 8 trials per site with one gibberish term, 2026-09-12:

| Site | empty state | behaviour |
|---|---|---|
| Skechers AU, Vans AU/NZ, Dr. Martens AU/NZ | 8/8 | deterministic empty state |
| **Platypus AU** | **4/8** | **bimodal** — alternates 0 cards (empty) / 46 fuzzy matches |
| Platypus NZ | 0/8 | deterministic fuzzy, always 7 products |
| Skechers NZ | 0/8 | deterministic fuzzy, always 2 products |

Platypus NZ and Skechers NZ genuinely fuzzy-match every term — confirmed query-dependent
(two different gibberish terms returned different product IDs and counts: 7 vs 13, 2 vs 5).
A zero-result page is unreachable there by term choice; do not hunt for a magic term.

**Platypus AU is bimodal, not fuzzy-only.** An identical query returns the empty state
about half the time and 46 matches the other half — so a single 3-run sample can point
either way, which is how it was first misclassified as fuzzy-only. Skipped because ~50%
is unassertable, NOT because the state is absent.

Its split varies both per-request and over time: outcomes interleaved within one 8-run
sequence (`E E f f f E f E`) at 10:28 UTC, then 12/12 fuzzy at 10:37 UTC. Do not trust a
short sample from a single sitting. When it does match, the matches are real and
query-dependent (6 products for one gibberish term, 15 for another, stable per term) —
so the two branches are genuinely different backend outcomes, not two fallback UIs.

### Telling the two apart
- Empty state: `.empty-search-text` present, **no "N PRODUCTS" count text**, and any cards
  are a *static* fallback carousel — identical product IDs across different queries.
- Fuzzy results: "N PRODUCTS" count text present, product IDs vary by query, no
  `.empty-search-text`.
- `.frh-products-row-fredhopper-zero` (Fredhopper is the search provider) appears in the
  zero branch, but only 2/8 on Platypus AU vs 8/8 on Vans AU — not a reliable proxy.

The discovery report lists E2E-SRCH-004 as "Sites: All". That is wrong; it is 5 of 8.

## Three traps (each yields a green test that proves nothing)
1. `waitForSearchResults()` waits for `[data-product-id] > 0` — which **succeeds on the
   no-results page**, because the empty state renders a trending-products carousel of
   6–18 real cards. Never use it in a no-results test.
2. `getResultCount() === 0` is not a no-results signal — the count is 0, 2, 6, 18 or 46
   depending on site and run.
3. Message copy differs per brand: "Don't give up**,** check" (Dr. Martens) vs
   "Don't give up**!** Check" (Skechers, Vans). Match with the tolerant
   a tolerant `/couldn.?t find what you were looking for/i`, not a literal string.

## Possible product defect
Platypus AU/NZ return fuzzy product matches for pure gibberish (46 and 7 cards for a
27-char random string). Reads as a search-relevance defect, not a test problem. Not filed.

Related: [[ecommerce-storefronts]], [[test-conventions]], [[gra-storefront-tech-notes]]
