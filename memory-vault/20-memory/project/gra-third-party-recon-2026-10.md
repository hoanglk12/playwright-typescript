---
name: gra-third-party-recon-2026-10
description: "Live 3rd-party inventory of all 8 GRA staging storefronts (2026-10-16): vendor hosts per page, storeConfig vendor flags, environment-isolation leaks, CSP blocks, broken vendor configs"
type: project
tags: [memory, project, ecommerce, third-party]
last_verified: 2026-10-16
---

Passive Playwright recon of all 8 storefronts on 2026-10-16 (home, search suggest, search results, PDP, ATC to checkout, cart page, checkout shipping, payment step with each payment radio selected, footer service pages). No order placed, no form submitted. Supersedes the 2026-06-15 host table in [[gra-storefront-tech-notes]] (that one was homepage-only and missed most PDP/checkout vendors). Platform: `magento_2.4.6-p15 | pwa_9.0.1 | gra_10.0.28.8`.

**Why:** the integration-scenarios doc (`docs/study/gra-integration-test-scenarios.html`, INT-011+) is built on this. Re-recon before trusting it after a few months; vendor hosts drift.

**How to apply:** use `storeConfig` (`getStoreConfigData`) flags as the per-brand precondition for any 3rd-party test instead of hardcoding brand lists.

## storeConfig vendor flags (source of truth per brand)
- `braintree_paypal_pay_in_4_is_enabled`, `is_qantas_loyalty_enable`, `is_qantas_points_pay_enable`: AU true, NZ false (all brands). Payment step: AU shows 4 radios (`afterpay_gra`, `braintree_gra`, `braintree_paypal_gra`, `braintree_paypal_pay_in_4_gra`), NZ shows 3.
- `ewave_klaviyo_general_disabled`: false (Klaviyo on) for DRM/VAN, true for PLA/SKX. `ewave_adobe_campaign_newsletter_general_active`: false on all 8, which contradicts Confluence ([[gra-integration-summary]] says PLA/SKX footer subscribe goes to Adobe Campaign). Open question.
- `bazaarvoice_environment: "staging"` on all 8; clients `platypusshoes-anz`/`skechers-anz`/`vans-anz`/`drmartens-anz`; zones `main_site`/`skx_gra`/`vans_gra`/`drm_gra`.
- `afterpay`: sandbox `js-sandbox.squarecdn.com/square-marketplace.js`, PDP + cart messaging on, min 1, max 2000, **except PLA NZ and SKX NZ max 500** (open question which is intended).
- Payment codes: `getPaymentMethods` returns `checkmo` (5 of 6 sampled, not PLA AU; never rendered), `braintree_applepay`, `afterpay`, `braintree`, `braintree_paypal`. UI radios are the same codes + `_gra`, plus `braintree_paypal_pay_in_4_gra`, which has no GraphQL code (driven by the storeConfig flag).
- Shipping (`getShippingMethods`): `instore/pickup` + `flatrate` everywhere, `freeshipping` on most, `codecarrierau/sddau` same-day on DRM AU (time-window dependent).
- Adobe Tags library is `launch-*-staging.min.js` on all 8 (PLA NZ also loaded the production `launch-7e8498f759e1.min.js` during its production-redirect stages).
- `ewave_address_autocomplete.type: KLEBER` on all 8; browser calls `kleber.datatoolscloud.net.au` after a `getKleberTempKey` GraphQL query.
- `seko_iframe_endpoint_guest`: `accentgrouptest.omniparcelreturns.com/bookreturn/...` (SEKO test env).
- `free_shipping_threshold`: DRM 200, PLA AU 149.99, PLA NZ 149.999, SKX AU 149.999, SKX NZ 150, VAN AU 149.96, VAN NZ 150. `carriers_flatrate_price`: PLA 12.99, VAN NZ 13, others 15.
- `ewave_fredhopper_ai_score_enable` and `ewave_multiplerewards_enabled`: PLA/SKX only. `ewave_fredhopper_ab_testing_enable`: all 8. `four_sixty_instagram_enable_pdp`: false on all 8 (Foursixty still loads on home).
- `customer_jwt_expires_in: "60"`.

## Search data source (corrects INT-002/006/008 in the doc)
Search and PLP results come from the same-origin Fredhopper proxy `GET /fredhopper/query` plus GraphQL `fredhopperSeoConvertToFRH` / `fredhopperSearchFRHConvertToPretty` / `GetCategories`. No `products` or `productSearch` GraphQL query fires. Autocomplete is `GET /accent_{plat|skech|vans|drm}/json`.

## Vendors seen (8/8 unless noted)
Forter (per-site cdn subdomains), Attraqt `collect-ap2`, Bloomreach `api-accent.bloomreach.co`, Bazaarvoice (apps + `apps-stg` + `network-stg-a`), Adobe Launch `assets.adobedtm.com` + demdex + `smetrics.<brand>`, GTM/GA4/Google Ads, Meta pixel, TikTok (not Vans), Pinterest (DRM AU, SKX, VAN), FullStory (all 8, not just Platypus as June said), New Relic (per-brand NRJS ids), Zendesk messenger (`<brand><region>customercare.zendesk.com`), Unidays (7/8, not DRM NZ), Foursixty UGC, Google Maps (store locator / Click & Collect), Vimeo, Commission Factory-style affiliate tag (`cfjump.<brand domain>` + `lantern.roeye(cdn).com`, `CommissionFactory` global), TrueFit (`{pla,ske,van,dma}-cdn.staging.truefitcorp.com`), Afterpay via Square (`square-placement` element, `placement-api.sandbox.afterpay.com`, `iq.afterpay-beta.com`), Braintree sandbox (Drop-in 1.43.0 on cart, Hosted Fields 3.103.0 at payment), PayPal sandbox (Smart Buttons, Pay Later messaging), Qantas `cdn.stg.qantasloyalty.com` redemption widget (AU only, checkout), Kleber (6/6 that reached checkout), Cloudflare Turnstile (PLA AU, VAN AU, VAN NZ, on PLP/PDP: exactly the stores where Vimeo video 715894328 returns 401, so almost certainly Vimeo's bot check inside the embed, not a GRA form), PayPal `zoid@9.0.85` from public `cdn.jsdelivr.net`, ad-sync networks (Criteo, OpenX, Rubicon, PubMatic, AppNexus, SpotX). reCAPTCHA v3 config is queried (`getRecaptchaV3Config`) on every page but no reCAPTCHA script loaded; the research agent's read-only query got `null` config on PLA AU (others unchecked).
- Also: CLAUDE.md says `src/config/global-setup.ts` "tests connectivity to target apps"; it has no probe (checked 2026-10-16).

## Defects / hazards found
- **Platypus NZ search leaves staging:** "Nike" search redirected to production `www.platypusshoes.co.nz/shop/nike` (production `/graphql`, production `sw.js`, production Afterpay/BV/TrueFit hosts). Any ATC after that search writes to production.
- **Vans AU/NZ footer "Gift Cards" links to production** `giftcards.vans.com.au`; other brands use `<brand><region>giftcardsstage.viicloud.com.au` (which returned `ERR_HTTP2_PROTOCOL_ERROR` in headless Chromium on all 6).
- **CMS assets from the wrong environment/brand/region:** `admin-prod-platypus` / `admin-prod-skechers` media on staging PLPs; a Skechers image on Dr. Martens NZ; `www.drmartens.com` images on DRM; AU staging media and an "AU_Shipping_Cut_Off" banner on Vans NZ.
- **FullStory misconfigured on Platypus NZ:** org id carries a stray quote, so it requests `edge.na1".fullstory.com` (DNS failure).
- **TrueFit:** `consumer-dev.truefitcorp.com/api/experiments` ERR_FAILED on all 8; Vans TrueFit script blocked by ORB.
- **CSP blocks (every store has at least one):** Afterpay `iq.afterpay-beta.com` (all 8), Pinterest `s.pinimg.com` (SKX, VAN), Foursixty (DRM AU, PLA NZ, VAN), a Bazaarvoice request (PLA), GTM (DRM NZ), Bloomreach media `brxcdn.com` (VAN AU), Commission Factory lantern (SKX NZ), Vimeo (DRM NZ, SKX NZ), `cdnjs` qrcodejs (PLA AU, SKX AU), `cm.everesttech.net` (PLA).
- Vimeo embeds return 401 on several PDPs/PLPs.
- **`NOISE_ROUTE_PATTERNS` is a no-op** (`src/data/ecommerce/analytics-events.ts`): `**/truefitcorp.com/**`, `**/fullstory.com/**`, `**/facebook.com/tr**`, `**/taboola.com/**` match none of the real vendor hosts, because a Playwright glob of that shape needs `/` immediately before the domain. Verified offline (all requests fulfilled locally) on Playwright 1.61.1; the `**/*.<domain>/**` form matches. So E2E-INT-001 has been running with every vendor live. Found by the research agent, confirmed in the main session.

## Recon limits
Run from a Vietnam IP (Google Ads resolved to `www.google.com.vn`), headless Chromium 1920×1080; geo-gated vendor behaviour may differ from AU/NZ users or US-based CI runners.
Platypus NZ and Skechers NZ never reached checkout, so their payment step is unobserved: on PLA NZ the ATC ran but the cart badge stayed 0 ("got 0"); on SKX NZ no purchasable size in the first 10 MENS PLP products. The recon's search-results and PDP stages on PLA NZ ran against production after the search redirect. Besides page views they sent POSTs to production: Adobe `smetrics` events, an Afterpay `iq` event, TrueFit `api/experiments` and `api/store/pla`, `/rest/V1/fpid`, and two `POST /graphql` (op names not captured; on staging the only POST at those stages is `createBraintreeClientToken`). No cart was created: the ATC stage restarted from the staging URL and sent no `createCart`/ATC mutation at all. Future recon must abort any document navigation whose host isn't `stag-*.accentgra.com`. No committed spec follows that redirect into an ATC: `checkout-address-prefill.spec.ts` excludes Platypus, `search-smoke.spec.ts` only views the result page. Recon spec kept locally (gitignored, ACER machine only; since 2026-10-16 it aborts production-marker hosts and any main-frame navigation off `stag-*.accentgra.com`, logging each block to `notes`): `tests/manual/gra-3p-recon.spec.ts`, run with `$env:RECON_OUT='<dir>'; npx playwright test --config=manual.config.ts tests/manual/gra-3p-recon.spec.ts --workers=4` (~9 min for all 8). Footer page visits after the Vii gift-card error were interrupted, so SEKO iframe render and store-locator map were not verified live.

Related: [[gra-storefront-tech-notes]], [[gra-integration-summary]], [[gra-integration-test-report]], [[ecommerce-checkout-payment-flow]]
