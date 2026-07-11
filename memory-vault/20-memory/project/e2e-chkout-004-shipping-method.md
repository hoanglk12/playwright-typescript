---
name: e2e-chkout-004-shipping-method
description: E2E-CHKOUT-004 implemented as baseline→selected-method delta; GRA storefronts expose only ONE guest shipping method; staging has address-commit→rate-calc concurrency race
metadata:
  type: project
---

# E2E-CHKOUT-004 — Shipping Method Selection (implemented 2026-07-11)

**Design decision:** Implemented as **baseline → selected-method delta**, NOT "select a different method". Live recon (Platypus AU, 3 addresses incl. Sydney CBD) proved GRA storefronts offer only **one selectable guest shipping method** — a strict two-method design would skip everywhere. Final logic in `tests/ecommerce/regression/checkout.spec.ts` (E2E-CHKOUT-004-* loop):
- No method selected → select it → assert delivery/total increased from $0 baseline (proven live: $139.99 → $152.98 on Platypus AU, delivery $12.99)
- Multiple methods, one pre-selected → switch → assert delta (guard: if checked index = -1, fall back to consistency check)
- Single method pre-selected → assert `subtotal + delivery + discount ≈ total`

**Key facts discovered (healer pass):**
- All 8 GRA storefronts share **identical shipping-address form markup** (earlier field-pattern-mismatch theory for Skechers AU / Dr. Martens AU was wrong)
- Address-autocomplete widget has a **hydration race** — not ready when `isOnShippingStep()` first returns true
- Shipping-method readiness gate must wait for an **enabled** radio, not just visible; pre-selected carrier needs a settle wait before reading selection state
- NZ storefronts need NZ addresses — `createGuestShippingAddress(isNz)` in `src/data/ecommerce/test-accounts.ts` is region-aware
- Vans AU/NZ order summary includes a **promotion/discount line** that total-parsing must account for
- `ElementHelper.clearAndTypeSequentially()` added for debounced address-autocomplete input

**Staging flakiness:** address-commit → shipping-rate-calculation has a **concurrency race** under parallel workers hitting the same staging backend — skip counts fluctuate 1–3 of 8 per run; affected storefronts pass in isolation. Environment issue, not code. All skips route through the `methodCount === 0` guard in `waitForShippingMethodsReady()` (checkout.spec.ts ~line 327). Mitigation lever if skip rate matters: lower worker count (`--workers=1` or `WORKERS=2`) to reduce concurrent staging load — infra tuning, not a code fix. Confirmed stable across two independent runs (7P/1S, then 5P/3S, zero hard failures both times).

**Unexercised branch:** "paid method pre-checked while alternates exist" never observed live on any storefront — implemented + guarded but untested by real staging data.

Related: [[ecommerce-pdp-page-gotchas]], [[ecommerce-storefronts]]
