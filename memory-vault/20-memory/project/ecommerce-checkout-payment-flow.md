---
name: ecommerce-checkout-payment-flow
description: "E2E-PLAORD-001 PayPal guest checkout implementation — Platypus AU payment step, Braintree+PayPal popup integration shape, recon findings"
type: project
tags: [memory, project]
last_verified: 2026-07-27
---

E2E-PLAORD-001 (Place order via PayPal, guest user) implemented 2026-07-27, scoped to Platypus AU only (not all 8 storefronts).

**Why:** Discovery report (`Guideline/E2E_DISCOVERY_REPORT.md` §7.28) lists this P1 across "All" sites; single-site scope was a deliberate judgment call given the real per-run cost of a live PayPal sandbox round-trip vs. the existing fast DOM-scan smoke tests.

**How to apply:** When building E2E-PLAORD-002/003/004 (PayPal logged-in, Credit Card guest/logged-in — same discovery-report section) or extending PayPal coverage to other storefronts, reuse these confirmed findings instead of re-deriving them:

- **Integration shape:** Braintree + PayPal Smart Payment Buttons, popup-based (zoid dispatch-frame → separate popup window) — NOT an inline iframe login form, NOT a same-tab redirect. `TabHelper` (now has `switchToPage()` for popup/opener restoration) is the right tool, not `FrameHelper`.
- **Sandbox vs. live verification method:** don't trust credential format alone — this account's plain `@gmail.com` address looked unusual for a generated sandbox account but was legitimate. Confirm via network instead: the functional PayPal SDK calls carrying the client-id resolve to `www.sandbox.paypal.com` with `env=sandbox`, and Braintree gateway calls go to `payments.sandbox.braintree-api.com`. Some loader/telemetry scripts legitimately load from the bare `www.paypal.com` host in both sandbox and live — that alone is not evidence of anything. Cross-check against `src/data/api/gra-test-data.ts`'s `braintree_paypal` expected-payment-methods entry as corroboration.
- **Payment-method radio value:** `braintree_paypal_gra` on the standard checkout flow. The two unlabeled "PAY WITH" buttons visible on `/cart` (class names `afterpay-button` / `paypal-button`, no accessible-name markup) are a separate cart-level express-checkout shortcut, not the main flow — the test uses the checkout radio, not the shortcut.
- **CONTINUE TO PAYMENT button gotcha:** its disabled→enabled state lags behind the shipping-method radio's own `checked` state — a genuine UI timing race, not a missing field. Poll it directly (`waitForContinueToPaymentEnabled()`) rather than assuming a checked radio means the button is ready.
- **Guest email on shipping form:** persists from the auth-modal step; the shipping form has no separate email field to re-fill.

**Files:** `src/pages/ecommerce/checkout-page.ts` (payment-step methods added to the single `EcommerceCheckoutPage`/`ecommerceCheckoutPage` fixture — no second page object), `src/pages/helpers/tab-helper.ts` (`switchToPage()`), `src/data/ecommerce/payment-accounts.ts` (`PayPalSandboxAccount`, password via `PAYPAL_SANDBOX_PASSWORD` env var, empty-string fallback → `test.skip()`), `tests/ecommerce/regression/paypal-checkout.spec.ts` + `checkout-helpers.ts` (extracted `addToCartAndReachCheckoutCta()`/`parsePriceToken()` out of `checkout.spec.ts` so the new spec doesn't import a spec file into a spec file).

**Open items (not resolved by this build, flagged to user):**
- Plaintext PayPal sandbox password still sits in `Guideline/E2E_DISCOVERY_REPORT.md:504` (pre-existing, predates this work) — needs redaction/rotation, user's call.
- `PAYPAL_SANDBOX_PASSWORD` GitHub Actions secret is referenced in CI workflows but not yet created — needs repo admin access.
- A pre-existing ~1-in-4 flake in shared `fillGuestShippingContactFields()` (shipping-method radio never becomes checked) surfaced during test runs, unrelated to this task. Candidate fix: extend `waitForShippingFormReady()` to also gate on name/phone fields being present, not just the address field.
