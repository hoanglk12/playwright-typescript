---
name: gra-card-checkout-forter-decline-rca
description: "E2E-PLAORD-003 (credit card checkout) all-8 failure RCA for CI run #355 (2026-10-28, commit 98fba87): placeOrder is rejected by the Forter pre-auth fraud decline, not by the UI or Braintree; plus 5 separate test-side/precondition failure modes, with per-attempt evidence"
type: project
tags: [memory, project, ecommerce, checkout, payment, forter, braintree, ci, rca]
last_verified: 2026-10-29
---

Root-cause analysis of all 8 failures of `Ecommerce Credit Card Checkout Regression` (`tests/ecommerce/regression/creditcard-checkout.spec.ts`, E2E-PLAORD-003-001..008) in GitHub Actions run #355 (run id 40741298243, commit `98fba87`, Windows shard, chromium, `RUN_CARD_CHECKOUT` set, 3 attempts each = 24 attempts). Report: `https://playwright-ui-reports.pages.dev/windows/#/?caseType=failed`.

**Why:** the previous leading hypothesis in [[gra-card-checkout-placeorder-blocker]] ("the UI never calls `setPaymentMethodOnCart`") is refuted by this run's network traces. The real blocker is server-side fraud screening. Anyone fixing locators, card-fill technique or UI timing for the `Unable to place order` failure is fixing the wrong layer.

**How to apply:** treat `Unable to place order: We are sorry, but we could not process your order at this time.` as a Forter decline. Until staging Forter is configured to approve test traffic, E2E-PLAORD-003 cannot go green in CI no matter what the test code does. Fix the 5 test-side defects below separately. They also affect PayPal (E2E-PLAORD-001/002) and cart specs that share the same helpers.

## Root cause A — Forter pre-authorization decline (8 of 24 attempts, 5 storefronts)

Affected attempts: Platypus NZ r0, Skechers NZ r1, Vans AU r0+r2, Dr. Martens AU r0, Dr. Martens NZ r0+r1+r2.

Evidence chain (strongest first):
1. **Staging Magento logs (New Relic Logs)**: for every rejected UI order, `/data/exports/local/<app>_stg/log/system.log` records `Our website is experiencing high demand Error Trace :#0 vendor/forter/magento2-module-forter/Observer/OrderValidation/PaymentPlaceStart.php(304): Forter\Forter\Model\ActionsHandler\Decline->handlePreTransactionDescision()` (called via `vendor/ewave/forter/Plugin/Observer/OrderValidation/PaymentPlaceStartPlugin.php(24)` → `Magento\Sales\Model\Order\Payment->place()` → `Order->_placePayment()`), followed milliseconds later by the `Unable to place order…` line in `exception.log`. Example: Skechers staging, 18:33:32.417Z (Windows r1 PlaceOrder started 18:33:29.191Z, 3.25 s). Same message appears in DM (18 lines), Vans (8), Platypus (12 + 6 Forter traces) staging logs in the 18:25–18:45Z window.
2. **Forter module source** (`forter/forter-magento2`, `etc/config.xml`): default `immediate_post_pre_decision/pre_thanks_msg` = exactly `We are sorry, but we could not process your order at this time.`, `decline_pre=1`. `Model/ActionsHandler/Decline.php:121` throws `PaymentException(getPreThanksMsg())`. The GraphQL `placeOrder` resolver wraps it as `Unable to place order: %1` (category `graphql-input`).
3. **The UI chain is complete** (Skechers NZ r1 and DM NZ r1 traces, `1-trace.network`): `setBillingAddressOnCart` ✅ → Braintree `tokenizeCreditCard` ✅ (real `tokencc_` nonce, VISA 411111…1111) → `setPaymentMethodOnCart` ✅ (`selected_payment_method.code = "braintree"`) → `storePaymentsGrandTotal` ✅ → `placeOrder` ❌. One click drives the whole chain.
4. **The Braintree sale never runs**: `sales_order_payment_place_start` (Forter) fires inside `Payment::place()` before gateway authorize. APM `Transaction` rollups: rejected UI PlaceOrder ≈ 3.0–3.7 s, ~262 DB calls, 2.0–2.3 s external (= 2 Forter calls ≈ 1.05 s each: validation + `sendOrderStatus`); successful API card PlaceOrder ≈ 4.5–5.7 s, ~355 DB calls, 3.0–3.5 s external (Forter + Braintree sale). `api.forter-secure.com` is called during the rejection window.
5. **Controls in the same run**: API `gra-place-order` TC_01 (same Braintree card chain via GraphQL) **passed on all 8 brands**; UI PayPal orders were **placed** on Platypus NZ (`PLANZST000414250`), Skechers NZ (`SKXNZST000226114`), Vans AU (`VANAUST000011147`), DM NZ (`DRMNZST000005749`). Same server, same resolver, same Forter module, so the failure is specific to browser-originated card orders.

Likely differentiator (not proven — Forter's decision payload is not logged to New Relic): the UI request carries the `forterToken` cookie from Forter's browser JS (`cdn0/3/4/6.forter.com`), a `sec-ch-ua: "HeadlessChrome"` client hint and a GitHub-hosted runner IP; the API request carries none of these. Forter's default `accepted_payment_methods` is `adyen,braintree,stripe,checkoutcom`; the card method code is `braintree`, PayPal is `braintree_paypal`.

Caveat: `PaymentPlaceStart.php:304` is reached on `action == "decline"` **or** when an exception is thrown inside the observer's try block (the catch falls through to the decline). A Forter API error/timeout (`status != success`) returns early and does NOT decline. Both Forter calls completed in ~1.05 s (< 2 s base timeout), so a real `decline` decision is most likely. Confirm in the Forter portal or `var/log/forter.log` (not forwarded to New Relic).

Fix options (backend/config owner, not test code): configure staging Forter to approve test traffic (Forter test-decision mechanism, allow-listing CI test emails/IPs, or `decline_pre` action off on staging). Ask the integrator (`ewave`) / Forter which one they support. Do not weaken the test's assertion.

## Root cause B — client stalls after `setPaymentMethodOnCart`, `placeOrder` never sent (2 attempts)

Skechers NZ r0 and r2: 45 s outcome timeout, no message. Staging APM shows `setBillingAddress` (18:31:31.2Z) + `setSelectedPaymentMethod` (18:31:38.0Z) for Windows r0 with **no PlaceOrder**; at 18:34:29–34Z two sessions (win r2 + mac r2) each sent billing + payment-method but only **one** PlaceOrder (18:34:37Z, the macOS one). The page snapshot shows the post-tokenization view `Ending in 1111 Visa` / `Choose another way to pay` with PLACE ORDER enabled and focused and no error. Intermittent storefront-side break in the place-order chain (between set-payment and placeOrder). Exact client cause not captured (only retry 1 has a trace).

## Root cause C — mini-cart CHECKOUT CTA silently no-ops; test never reaches checkout (3 attempts)

Platypus NZ r1+r2 (final status timedOut), Vans AU r1. Signature: Steps 12–13 complete in <1 s, Step 14 burns exactly 60 s, page snapshot is still the PDP. Screencast (Platypus NZ r1) shows no drawer and no change from 18:33:05.9Z to 18:34:50Z, cart badge = 1.
- `ensureCartOverlayOpen()` (`tests/ecommerce/smoke/smoke-helpers.ts:381`) trusts `isOverlayVisible()`, which `cart-overlay-page.ts` itself documents as true whether the drawer is open or closed (drawer permanently mounted at `position:fixed`, toggled by opacity). So the cart icon is never clicked.
- `clickCheckoutCtaFromOverlay()` returns `undefined` whether or not it clicked anything; `waitForCheckoutLoad()` swallows its timeout (`.catch(() => {})`). Step 0-14 returns `ok` without confirming checkout.
- On Vans AU the failure surfaces one step later: `isOnShippingStep()` returns a false positive on the PDP because `shippingStepHeadingPattern = /shipping|deliver(y|\s+to)|checking out as guest/i` matches the PDP's `Delivery & Returns` / `4HR DELIVERY` copy.
Fix direction: use `isOverlayGenuinelyOpen()` in `ensureCartOverlayOpen`, make the CTA click return a boolean, and hard-assert that the checkout URL or auth modal was reached after Step 14.

## Root cause D — PLP scan `goBack()` + over-broad PLP URL regex (3 attempts)

Platypus AU r0–r2 (`Custom condition not met within 60000ms` in `EcommercePLPPage.waitForProductGrid`). Product #0 (`/womens-ct-all-star-lift-560251-wht.html`) did not qualify, `findProductWithAvailableSizes()` called `pdpPage.goBack()`, and the URL **stayed on the PDP** for the full 60 s (trace frame URLs). `waitForPlpUrl()` still passed because `PLP_URL_PATTERN` (`plp-page.ts:7`) matches `/\/women/`, which also matches PDP slugs starting `/womens-…`. Then `waitForProductGrid()` waits for `[data-product-id]` on a PDP. The same signature hit PayPal E2E-PLAORD-001-001 Platypus AU in this run.

## Root cause E — size picker tries only the first 3 non-disabled sizes, which include out-of-stock ones (6 attempts)

Skechers AU r0–r2 and Vans NZ r0–r2 ("first 3 sizes all resulted in sold-out state"). `getAvailableSizes()` (`pdp-page.ts:363`) counts any non-disabled size button. These storefronts render OOS sizes as enabled, struck-through buttons. Server truth from `getProductForPDP` (map by `size_us_mens`, the system the UI displays, not the generic `size` attribute):
- Vans NZ OLD SKOOL BLACK/WHITE: US M 3.5/4/4.5 OUT (the 3 tried), 5/6/7/8/9/10/11–15 IN_STOCK.
- Skechers AU NAMPA – GROTON: US M 7/8/9 OUT (the 3 tried), 11/11.5 IN_STOCK (online only).
Also seen: `clickProductCard(i)` indexes `[data-product-id] a` (anchors), and each card has 2 anchors, so nth=0/1 opened the same product. The fully in-stock SKX 2 ELITE SOFT GROUND (16/16 IN_STOCK) returned `[]` from the in-loop size check and was skipped (render timing vs label format not determined).

## Root cause F — shipping address cleared after suggestion selection (2 attempts)

Dr. Martens AU r1+r2 (`A shipping method must be checked…`, index -1). Kleber `SearchAddress("1 Pitt Street Sydney")` → 1 result, `RetrieveAddress` → 1 result, Step 17 verified address committed = true at 18:37:09Z. By the failure snapshot (18:37:56Z) Address/Suburb/Postcode/State were empty with `Please enter your …` errors and `Please enter your details to see available shipping methods`. The storefront never sent `setCheckoutFieldsOnCart` / `setShippingAddressesOnCart`. A form-state race; the test's commit check is not durable. Whether the app or the fill timing reset the form was not determined.

## Attempt matrix (Windows shard)

| Test | r0 | r1 | r2 |
|---|---|---|---|
| 001 Platypus AU | D | D | D |
| 002 Platypus NZ | A | C | C (timedOut) |
| 003 Skechers AU | E | E | E |
| 004 Skechers NZ | B | A | B |
| 005 Vans AU | A | C | A |
| 006 Vans NZ | E | E | E |
| 007 Dr. Martens AU | A | F | F |
| 008 Dr. Martens NZ | A | A | A |

The macOS shard of the same run showed the same Forter decline on Skechers NZ (r0, r1, r2).

## How to re-gather this evidence (reusable)

- Monocart `index.json` is published next to the report (`/windows/index.json`, ~22 MB). Attachments with `content` (e.g. `test-steps.log`, `console-failure-context.log`) are inline; the per-attempt step log gives the exact terminal step.
- `playwright-with-slack.yml` deletes files >25 MiB before the Cloudflare Pages deploy, so long checkout traces are missing from the site (the URL returns the SPA fallback HTML, HTTP 200, 717 bytes). Full traces are in the GitHub artifact `ui-test-results-Windows-<n>-testing-parallel` (1–4 GB). Get a signed URL via GitHub MCP `download_workflow_run_artifact` (expires in ~10 min) and read only the needed `trace.zip` entries with HTTP Range requests against the zip central directory (KBs to list, one ranged GET per entry). Shorten local filenames, since the scratchpad path plus the entry name exceeds Windows MAX_PATH.
- Playwright traces do not store request bodies (`bodySize: 0`) but do store response bodies. Identify GraphQL mutations by the response `data` root key.
- New Relic: staging APM apps are `<appId>_stg` (Skechers `c27abj7wwbj5a_stg` in account 3562370; Vans 3736705; DM 3845367; Platypus 2956572). The browser `traceparent` is not linked to the server trace, so correlate by timestamp on `WebTransaction/Custom/GraphQl/Controller/GraphQl\Mutation\PlaceOrder` (`setPaymentMethodOnCart` is named `setSelectedPaymentMethod`, `setBillingAddressOnCart` is `setBillingAddress`). Staging Magento logs are forwarded under `filePath LIKE '/data/exports/local/<appId>_stg/log/%'` (`exception.log`, `system.log`). Unfiltered `Log` queries return production traffic, so always filter by `_stg` path. Forter's own debug log is not forwarded.

Related: [[gra-card-checkout-placeorder-blocker]], [[gra-braintree-payment]], [[gra-integration-summary]], [[ecommerce-checkout-payment-flow]], [[gra-storefront-tech-notes]]
