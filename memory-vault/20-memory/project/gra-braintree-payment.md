---
name: gra-braintree-payment
description: "Braintree sandbox credit-card payments are testable via pure API calls on all 8 GRA storefronts; gra-place-order.spec.ts and gra-order-history.spec.ts now place real orders through this chain instead of checkmo"
type: project
tags: [memory, project]
source_session: c82d13c1-cc80-4067-a9e9-4d9e47b5a0d8
last_verified: 2026-07-26
---

## Braintree credit-card payment is testable via API only (confirmed 2026-07-26)

[[gra-api-testing]] previously stated that Braintree payment methods (`braintree`, `braintree_applepay`, `braintree_paypal`) could not be tested without a real Braintree SDK, because `setPaymentMethodOnCart` with just `{ code: "braintree" }` fails with `"Required parameter 'braintree' for 'payment_method' is missing."` That conclusion was wrong. It only meant the input needed a nonce, not that a browser or SDK was required to get one.

The nonce can be obtained with plain HTTP calls, no browser involved:

1. `mutation { createBraintreeClientToken }` against the storefront's own GraphQL endpoint, no auth needed. Returns a base64 string.
2. Decode it. It's JSON: `{ authorizationFingerprint, environment: "sandbox"|"production", merchantId, merchantAccountId, graphQL: { url, date, features } }`. The `graphQL.url` points at Braintree's own GraphQL API (`payments.sandbox.braintree-api.com/graphql` on all 8 storefronts, confirmed sandbox everywhere).
3. POST `mutation tokenizeCreditCard(input:{creditCard:{number, expirationMonth, expirationYear, cvv}})` to that URL, with `Authorization: Bearer <authorizationFingerprint>` and `Braintree-Version: <graphQL.date>` headers. Returns a single-use nonce.
4. Feed the nonce into `setPaymentMethodOnCart` on the storefront: `payment_method: { code: "braintree", braintree: { payment_method_nonce: <nonce>, is_active_payment_token_enabler: false } }`.
5. `placeOrder` as normal.

This was verified end to end on all 8 brands (pla-au, skx-au, drm-au, van-au, pla-nz, skx-nz, drm-nz, van-nz): every one places a real sandbox order through this chain. No 3DS challenge fired for the one card and amount tested (`4111111111111111`), but that's scenario-specific, not proven absent for other cards or amounts.

**Non-negotiable safety guard:** before calling `tokenizeCreditCard`, decode the client token and refuse to proceed unless `environment` is exactly `"sandbox"`. This is the only thing standing between this code and a real charge if a storefront's Braintree config ever points at production. `getBraintreeClientConfig()` in `tests/api/api-test-helpers.ts` also checks that the token actually has a `graphQL.url`/`graphQL.date` block before returning: a malformed token used to get silently misclassified as a network error and skip the test instead of failing it.

**Nonce lifecycle:** mint it fresh inside the test body that uses it. Never in `beforeAll`, never stored in `shared-state.ts`. It's single-use and short-lived, and `api.config.ts` retries on CI, so a persisted nonce would just be stale on the retry.

## What changed in the existing specs (2026-07-26)

`gra-place-order.spec.ts` and `gra-order-history.spec.ts` were converted in place. TC_01 in each now places its order via Braintree credit card instead of `checkmo`. This was a deliberate user override of the original recommendation, which was to add a separate new spec and leave these two alone, to avoid coupling order-placement/history tests to gateway uptime and Forter's async fraud check (see [[gra-integration-summary]]). Both specs' `beforeAll` now stops at billing-address setup; payment and `placeOrder` moved into TC_01's body so the nonce is minted per test.

One real regression surfaced during review and was fixed before merge: `gra-order-history.spec.ts` TC_03 used to gate on a flag that only got set inside TC_01's body. Since `beforeAll` runs once per worker, not per test (verify against `node_modules/playwright/lib/worker/workerProcessEntry.js` if this ever comes up again; the original comment claiming per-test re-runs was flat wrong), a flag set only in TC_01 doesn't exist yet when TC_03 needs it. TC_03 now gates on the flag `beforeAll` itself sets (`cartReadyForPayment`), which is what it actually needs.

One side effect of that fix worth remembering: `cartReadyForPayment` no longer implies an order was placed, only that billing setup succeeded. So on any brand where `braintree` drops out of `available_payment_methods`, TC_03 will run its structure-only path instead of skipping. The reviewer judged this a tolerated degradation, not a regression, since Step 2 of TC_03 already handles the no-orders case explicitly. Worth checking if TC_03 ever passes suspiciously often.

`setPaymentMethod` (the old helper both specs used to call for `checkmo`) has no callers left anywhere in the repo and was deleted along with its `PaymentResult` type. `simplePaymentCodes` in both `gra-place-order-data.ts` and `gra-order-history-data.ts` was dead for the same reason and was also removed.

New files: `src/data/api/gra-braintree-payment-data.ts` (`BraintreeTestCardGenerator.generateSandboxVisa()`: fixed verified sandbox Visa number, but CVV is random 3 digits and expiry is always 3 years out from the current month, generated fresh per call so nothing here is a stale hardcoded date; no invented decline/expired numbers). New GraphQL exports in `gra-graphql-operations.ts`: `CREATE_BRAINTREE_CLIENT_TOKEN_MUTATION`, `SET_BRAINTREE_PAYMENT_METHOD_MUTATION`. These are kept distinct from the existing `SET_PAYMENT_METHOD_MUTATION` since the input shape differs, even though both hit the same `setPaymentMethodOnCart` resolver. `redact.ts` gained a `nonce` key, though it turned out not to matter much in practice: the raw HTTP call to Braintree's own endpoint never goes through `GraphQLClient`/`ApiClientExt`, so it was never going to enter the `VERBOSE_LOGS` buffering path that redaction protects.

## Known gaps

- `customer.orders` on pla-au and pla-nz staging returns a `graphql-input` "integration issues" error. This is pre-existing and unrelated to this change, confirmed by reproducing it on unmodified code via `git stash`. Order-history verification is non-signal on those two brands regardless of payment method.
- 3DS/card-verification behavior on cards or amounts other than the one tested is unverified.
- This is staging, dedicated for testing, so every run of these two specs places a real order and leaves it there. Not a concern per the user, but worth knowing if staging order counts ever look odd.

See [[gra-api-testing]] for the file/data structure this sits inside, and [[gra-integration-summary]] for the Forter/AP21 downstream flow that any placed order (real or test) triggers.
