---
name: gra-integration-summary
description: Third-party integration architecture for the GRA platform (Magento/Adobe Commerce) covering AP21, email marketing, payments, search, and logistics
type: project
tags: [memory, project]
source: confluence-2567766048
last_verified: 2026-06-13
---

# GRA Integration Summary

Related: [[gra-api-testing]] [[ecommerce-storefronts]] [[project_context]]

## Core Architecture: AP21 via Mulesoft

The GRA platform (Adobe Commerce/Magento) routes nearly all back-end data through AP21 (Apparel21 ERP) via Mulesoft middleware. This is not a direct REST API — Mulesoft sits in between as a transformation and orchestration layer.

**Why:** AP21 is the system of record for products, inventory, customers, loyalty, and orders. Magento is purely the commerce front-end; AP21 holds the master data.

**How to apply:** When writing API tests that touch customer, product, order, or inventory state, expect eventual consistency — Mulesoft queues (Anypoint MQ) introduce latency. Don't assert immediate AP21 reflection from a Magento event in the same request cycle.

---

## Product Sync (AP21 → Magento)

6-step pipeline, all via Mulesoft:
1. Sync Reference Codes (AP21 ↔ Magento DB)
2. Sync Colours & Sizes (AP21/Magento BE ↔ AP21/Magento BE)
3. Fetch Attributes from Magento (Magento BE → Mulesoft)
4. Fetch AP21 Styles and transform → Configurable + Simple Products; batched into Anypoint MQ
5. Bulk ingest via Magento's custom Enhanced Bulk Catalog Import endpoint
6. Disable Products in Magento that are web-inactive or archived in AP21 — **skipped during DELTA runs**

**Why:** Products use a custom bulk import endpoint in Magento, not the standard REST API. Standard catalog endpoints will not reflect what the integration uses.

**How to apply:** Product catalog state in staging may lag actual AP21 data. DELTA runs do not disable products — only FULL runs clean up stale products. Tests asserting product visibility/status need to account for this.

---

## Customer Integration (Magento FE → AP21)

All customer events flow from Magento FE to AP21 in real-time, with a 30-minute batch fallback for offline events:

| Event | Direction | Detail |
|---|---|---|
| Registration | Magento FE → AP21 | Creates Person record in AP21 |
| Guest Order | Magento FE → AP21 | Also creates Person in AP21 |
| Login / Info Refresh | Magento FE → AP21 | AP21 is authoritative — if AP21 has newer data, it overwrites Magento |
| Customer Update | Magento FE → AP21 | Only if `apparel21_person_id` is set on the customer |
| Offline Batch | Magento BE → AP21 | Every 30 min loop for missed real-time events |

**Why:** AP21 is the master for customer identity. Magento customer records can be overwritten at login if AP21 holds more recent data — this means UI tests that update a customer field may see their changes overwritten on the next login.

**How to apply:** In ecommerce tests that update customer profile data, do not assume the update persists across login cycles. The `apparel21_person_id` field must be set for update events to fire.

---

## Loyalty (Rewards) Integration

Rewards are managed in AP21; Magento is a thin consumer:
- Rewards program details retrieved and stored in Magento at login (part of Customer Login event)
- Rewards Account created during Customer Registration OR Account Update
- Redemption fires at order placement (Reserve Reward Amount)
- Reversal fires on fraudulent/declined payment (Reverse Unconfirmed Redeem)

**How to apply:** Loyalty balance shown in tests reflects AP21 state at last login sync. Tests can't directly set loyalty balance via Magento APIs.

---

## Orders Integration

- Real-time: Magento FE → AP21 on order placement
- Offline batch fallback: Magento BE → AP21 for failed real-time creates OR when Forter fraud status changes to accepted/rejected
- Order History & Track Order: fetches live from AP21 on demand (Magento FE → AP21)

**Why:** Forter fraud detection (credit card, PayPal, PayPal Pay-In-4 via Braintree) can change order status asynchronously. An order created in Magento may not yet exist in AP21 if the fraud check is pending.

**How to apply:** Order assertion tests on staging should include a timing buffer or poll for AP21 sync. Forter is only active for Braintree payment methods.

---

## Email Marketing: Brand-Split Architecture

PLA/SKX (Platypus/Skechers): **Adobe Campaign**
- Footer subscription → direct Magento FE → Adobe Campaign
- All other subscription points (registration, checkout, My Account) go via the Customer Integration API to AP21, then Adobe Campaign reads from AP21

VAN/DRM (Vans/Dr. Martens): **Klaviyo**
- Only Footer Subscription → direct Magento FE → Klaviyo
- All other subscription/unsubscription events sync to AP21 profile first; AP21 exports to Klaviyo on a scheduled batch basis (not real-time)

**Why:** Different CRM platform per brand. Klaviyo for VAN/DRM only has direct integration at the footer; all other touchpoints rely on AP21 export schedule.

**How to apply:** When testing subscription flows for VAN/DRM brands, do NOT assert real-time Klaviyo updates outside of footer subscription. For PLA/SKX, Adobe Campaign receives direct updates only on footer subscribe; other subscription paths are indirect via AP21.

---

## Gift Cards (Vii)

Vii manages gift card state; AP21 can also hold gift cards (separate balance check endpoint):
- Balance Check: Magento FE → AP21 OR Vii (two separate systems)
- Freeze/Hold (PreAuthRequest): Magento BE → Vii on purchase; hold duration is 5 days (TBC)
- Redeem: triggers when order status changes to 'Processing'
- Undo Redemption: required for timed-out or no-response scenarios (Magento BE → Vii)

**How to apply:** Gift card balance tests must specify whether card is AP21-issued or Vii-issued — different endpoints. Vii redemption is triggered by order status, not by payment capture directly.

---

## Fredhopper (Search/Merchandising)

Fredhopper is the search and merchandising engine. It is NOT Magento's native search.

**Feeds (nightly + delta):**
- Full Products Update: runs nightly, updates full catalog in Fredhopper
- Partial Products Update: runs during day, incremental changes only
- Trigger Indexer Start: fires after Full or Partial to kick off Fredhopper reindex
- Get Indexer Status: polled by cron to check reindex progress
- Check Data Quality Reports: retrieves error report from Fredhopper catalog

**Feature integrations:**
- Search autocomplete via Fredhopper Suggest API
- Homepage product recommendations (FRH → Magento FE)
- PLP product listing (FRH → Magento FE)
- PDP product recommendations (FRH → Magento FE)
- Insights event tracking (Magento FE → FRH for analytics, AI Search, A/B testing)
- AI Scores and AI Search features
- A/B Testing via Insights tracking

**Why:** All search, PLP, and product recommendation results come from Fredhopper, not Magento catalog. PLP tests must account for Fredhopper as the data source — Magento product changes don't appear on PLP until Fredhopper reindexes.

**How to apply:** After product changes in staging, PLP/search results may be stale until the next nightly full update or partial delta sync. Do not assert newly created products appear immediately on PLP.

---

## BazaarVoice (Ratings & Reviews)

- Product feeds sent via Intelligent Reach (XML format, not directly)
- Magento fetches inline ratings and full reviews FROM BazaarVoice (pull model)
- Review submissions sent TO BazaarVoice from Magento BE
- BV SEO Snippets: Magento fetches Schema.org data from BV for search crawlers (invisible to users)
- Order Success pixel: sent via Adobe Launch Tag Manager (data layer event), not Magento BE

**How to apply:** Reviews and ratings shown on PDP come from BazaarVoice, not Magento. The product feed to BV goes through Intelligent Reach transformation — direct Magento product API changes do not update BV immediately.

---

## Intelligent Reach (Feed Hub)

Intelligent Reach acts as a feed transformation hub. Magento creates one Source Feed XML file; IR transforms and distributes to:
- Google Shopping
- Facebook Marketplace
- BazaarVoice
- TrueFit

**Important gap:** No documentation exists on how IR transforms the Source Feed into 3rd-party formats. Mapping must be requested directly from IR if needed.

---

## TrueFit (Size Recommendations)

- PDP Size Recommendations widget (Magento FE → TrueFit)
- Quick View Size Recommendations on PLP and Wishlist (also TrueFit)
- PLP widget is NOT implemented natively — it's delivered via Quick View only
- Order Confirmation tracking: Customer/Product data (PII-compliant) sent via Adobe Launch
- Historic catalog/sales/return data fed to TrueFit via eWave Shopping Feeds module → Intelligent Reach

**Critical note — July 2023 upgrade:** TrueFit Code & Widget were upgraded to a new version. This upgrade removed:
1. Automatic Size Selection (native)
2. Add Recommended Product to Cart Tracking

**How to apply:** Do not test or assert Automatic Size Selection behavior on GRA brands — it was removed. Cart tracking from TrueFit recommendation is also gone.

---

## SEKO Returns

- Return creation: embedded SEKO iFrame on Magento FE → SEKO
- Returns history in My Account: fetched from AP21 (covered by Orders/Returns History Integration)
- SEKO and AP21 have a **separate direct integration** outside Adobe Commerce — they sync independently

**How to apply:** Returns history tests pull from AP21, not SEKO directly. The SEKO iFrame is an embedded external UI — automation of it requires iFrame interaction (see `this.frames` helper in BasePage).

---

## Shippit (Advanced Delivery Methods)

Three-phase quote pipeline for Click+Deliver and Click+Collect:
1. Pre-Quote: Magento calculates eligible stores near delivery address
2. Shippit Merchant Quote: per-eligible-store live quote fetch from Shippit
3. Post-Quote: boundary logic to determine if advanced delivery should be offered

**How to apply:** Delivery method availability is dynamic (store proximity + Shippit live quote). Delivery method assertions in checkout tests depend on test address proximity to active stores.

---

## Kleber/DataTools (Address Validation)

- Checkout and My Account address autocomplete via Kleber
- AU address repair: Magento FE → Kleber
- NZ address repair: separate Kleber endpoint

**How to apply:** Address fields in checkout tests on staging may trigger Kleber autocomplete. Use addresses known to pass Kleber validation for AU and NZ to avoid checkout test failures due to address rejection.

---

## Forter (Fraud Detection)

- Only applies to Braintree payment methods: Credit Card, PayPal, PayPal Pay-In-4
- Forter requests are submitted as part of order completion (not before)
- Orders are completed via Braintree natively; Forter is triggered alongside

**How to apply:** Fraud detection is asynchronous — order status in Magento may change after initial placement if Forter flags it. Tests asserting final order status should wait for Forter resolution, not just order creation.

---

## Prerender (SEO Crawl Caching)

- No Magento extension needed — available natively in Adobe Commerce Cloud
- Middleware intercepts crawler requests and serves pre-rendered static HTML from Prerender.io
- Human users get normal dynamic pages; bots get cached static HTML

**How to apply:** Playwright tests run as a real browser (not a crawler), so Prerender middleware does not affect test results. SEO meta-tag assertions via Playwright see the live page, not the prerendered cache.

---

## TAF Instance (DEPRECATED)

The TAF (The Athlete's Foot) platform section is struck through in the source document — it is a legacy/deprecated instance. It used ERPLY (not AP21) and Fluent (OMS). These integrations are no longer active in GRA.

**Do not write tests for ERPLY or Fluent integrations** — they are TAF-only legacy systems not present in the GRA (PLA/SKX/VAN/DRM) platform.

---

## Key Integration Gaps Noted in Source Doc

- Intelligent Reach feed transformation mappings: not documented; must be requested from IR directly
- TAF Fredhopper, Shippit, Adobe Data Layer: documented elsewhere with Martech team
- Volumental (TAF only): foot scanning product tags — TAF legacy, not in GRA
