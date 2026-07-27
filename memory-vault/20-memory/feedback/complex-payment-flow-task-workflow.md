---
name: complex-payment-flow-task-workflow
description: "Time/process pattern for building a new slow external-payment-integration E2E test (PayPal/Braintree) via qa-orchestrator — confirmed effective approach"
type: feedback
tags: [memory, feedback]
last_verified: 2026-07-27
---

Building E2E-PLAORD-001 (new UI test requiring a live third-party payment sandbox integration) took ~2 hours end-to-end via a single `qa-orchestrator` dispatch (build → review → run → fix → review), 2026-07-27.

**Why it took that long:** most of the time was inherent, not avoidable — a recon-only pass before touching credentials (to verify sandbox vs. live host before any login attempt), then 5 separate live PayPal sandbox round-trips (each a real external network round-trip through a popup, not mockable), 2 full review rounds, and CI workflow wiring. This is a materially different cost profile from a DOM-scan smoke test and should be expected for any new payment/BNPL integration test, not treated as a sign something went wrong.

**How to apply:** for E2E-PLAORD-002/003/004 or any new payment-provider integration test:
1. Front-load a recon-only pass (no credentials entered, nothing submitted) to confirm sandbox-vs-live via network host inspection before writing any spec/page-object code — worth the extra round-trip even though it costs time. See [[ecommerce-checkout-payment-flow]] for the confirmed Braintree+PayPal verification method to reuse directly instead of re-deriving it.
2. Default to a single representative storefront (Platypus AU) rather than the discovery report's "All sites" scope for a first implementation of a new slow/external flow — call this out explicitly as a scope decision rather than silently deciding it, but it is the right default.
3. Delegate the entire build→review→run→fix→review cycle to `qa-orchestrator` in one dispatch with a detailed brief (existing files to extend, the zero-hard-wait constraint spelled out explicitly, data-module/env-var requirements) rather than micromanaging each hop — the orchestrator correctly caught its own scope/safety judgment calls (sandbox verification, CI secret wiring gap, plaintext credential sitting in a pre-existing doc) without those being spelled out in the brief.
4. A background dispatch is the right call for this class of task — it is long-running due to live external round-trips and doesn't need step-by-step supervision; surface only the safety checkpoint (sandbox confirmation) and the final report to the user.

**What reduces time next round:** the confirmed integration shape, sandbox-verification method, and specific UI gotchas (button-enable timing race, unlabeled PAY WITH button disambiguation) are now in [[ecommerce-checkout-payment-flow]] — the next payment-flow test should skip recon entirely for anything already answered there and only recon what's genuinely new (e.g. Credit Card / Braintree Hosted Fields for PLAORD-003/004 is a different UI shape than the PayPal popup and will need its own recon pass).
