---
type: project
tags: [memory, project, ecommerce, promotions, test-scoping]
last_verified: 2026-07-03
---
# E2E-CART-009 Omitted (Decision)

**Decision (2026-07-03):** E2E-CART-009 — `"BUY 2 GET 20% OFF" discount applies with 2 qualifying items` (was P1, all sites) — is **omitted** from the E2E backlog. User removed the row from `Guideline/E2E_DISCOVERY_REPORT.md` §7.16 after a technical-research-agent report.

**Why:**
- The promo is a **client-controlled Magento cart price rule** on shared staging; the client can toggle it at any time, so a hard-assert flakes and a skip-gated version gives no P1 signal.
- The repo has **no Magento admin API access** (no `/rest/V1/salesRules`, no integration token — confirmed by grep) to seed or verify the rule. Provisioning admin write access was rejected on security/scope grounds.
- "2 qualifying items" requires a **known-qualifying SKU per storefront** (the rule has conditions); none is curated, and `pdpPath` values in `storefronts.ts` are placeholders.

**How to apply:**
- If a future discovery run or test-plan agent proposes a promo/discount-dependent case (BUY X GET Y, Spend & Save E2E-CHKOUT-010, promo-amount assertions), flag this precedent: promo-config-dependent assertions against shared staging are not valid unconditional P1 tests.
- If ever revived, the researched approach was: GraphQL API test asserting `cart.prices.discounts` (machinery in `tests/api/gra-cart-minicart.spec.ts`; empty-cart baseline `discounts === null` at ~line 386), gated by a promo-active precondition skip, demoted to P2 — contingent on the client confirming rule type (cart vs catalog), coupon vs automatic, and qualifying SKUs.
- Related still-active cases: E2E-PDP-019 (badge visibility — display-only, still valid), E2E-CART-010 (promo field visible — display-only, still valid), E2E-CHKOUT-007/008 (promo code apply — same dependency concern, re-check before implementing).

Related: [[ecommerce-storefronts]], [[gra-api-testing]], [[test-conventions]]
