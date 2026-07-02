---
name: ecommerce-header-help-gotcha
description: GRA storefront header "Help" is a figure-trigger (not a link) that opens a complementary flyout; live Playwright MCP investigation found this after a diagnostic-script false negative caused an 8/8 vacuous test.skip()
type: feedback
tags: [memory, feedback]
last_verified: 2026-07-02
---

## The bug: 8/8 false `test.skip()` on E2E-UTIL-005

First implementation of `EcommerceHelpSupportPage` (`src/pages/ecommerce/help-support-page.ts`) used `getByRole('link', { name: /help|support/i })` for the header "Help" element, reasoning from `menuItemsByCode` GraphQL evidence (`help_menu` fires on every homepage load — see [[gra-storefront-tech-notes]]) without a live DOM check. Result: `isHelpSupportLinkPresent()` returned `false` on all 8 storefronts, every test hit the skip-guard, and `qa-code-reviewer` APPROVED it — an 8/8 skip looked like "correctly tolerant of an unconfigured feature" rather than a broken locator, because nothing distinguished the two cases.

## Root cause (confirmed live via Playwright MCP against staging)

The header "Help" element is a `<figure>` **click-trigger** — no `href`, accessible role `"figure"`, not `"link"`. `getByRole('link', ...)` can never match it. Clicking it opens a flyout panel rendered as a new `role="complementary"` region (same landmark family as the mini-cart overlay — see item 9 in [[ecommerce-pdp-page-gotchas]]) containing the real destination links.

Confirmed on 2 of 8 storefronts (Platypus AU, Skechers AU — both share the PWA Studio stack all 8 GRA storefronts run on):
- Platypus AU flyout: "Track My Order", **"Help"** (→ `https://help.platypusshoes.com.au/hc/en-us`), "Delivery", "Returns", "FAQs", "Contact Us"
- Skechers AU flyout: "Track My Order", "Delivery", "Returns", **"FAQs"**, **"Contact Us"** (→ `https://help.skechers.com.au/hc/en-us` — no literal "Help" link on this brand)

Both destinations are the same external Zendesk help-center domain pattern: `https://help.{brand}.com.au/hc/en-us`. That destination page renders **zero semantic heading elements** (`<h1>`–`<h3>`) — a heading-visibility soft-check (the originally planned secondary signal) would never pass on any brand. Replaced with a URL-pattern check (`/help\.|\/hc\/|support/i` against `page.url()`) instead.

## Fix in `help-support-page.ts`

1. `headerHelpTrigger`: `getByRole('figure', { name: 'Help', exact: true })`
2. Click it, wait for a `role="complementary"` panel containing a Help/FAQs/Support link to appear
3. Click the matching link **scoped to that panel** (not page-wide — see below)
4. Hard-assert URL changed from homepage (external domain navigation = unfakeable signal)
5. Soft-assert `isOnHelpDestination()` — URL matches the help-center pattern

**Scoping correction (qa-code-reviewer WARNING, fixed same session):** the flyout link locator must be scoped to the just-opened flyout container, not page-wide. A page-wide `getByRole('link', {name: /^(help|faqs?|support)$/i})` risks a false-positive "green when broken" result on an untested brand — if the trigger click does nothing but a same-named link exists elsewhere in the initial DOM (nav, account menu), the wrong link gets clicked, the URL still changes, and both the hard and soft checks pass while testing the wrong flow. Fix: scope via `.filter({ has: ... })` on `aside, [role="complementary"]`, same pattern as [[ecommerce-pdp-page-gotchas]] item 9.

## Process lesson: why the diagnostic-script approach produced a false negative

1. **A sub-agent orchestrator pipeline with no live browser tool will guess at locators from indirect evidence (GraphQL operation names, prior tech notes) and cannot verify DOM structure.** The fix required a Playwright MCP browser session in the *main* agent — sub-agents in the `qa-orchestrator` pipeline used in this session did not have that tool available.
2. **A raw DOM `element.click()` (via `page.evaluate()`) did NOT reliably open the flyout in live testing; a real Playwright locator `.click()` (full trusted-like pointer event sequence) did.** This is a second, independent false-negative source: even a diagnostic script that found the `<figure>` correctly could still conclude "clicking does nothing" if it clicked via `evaluate()` instead of a locator. Always click through `this.elements.clickLocator()` / a Playwright locator when verifying interactive behaviour — never simulate via `evaluate()`.
3. **An 8/8 skip should be treated as a suspicious result, not a passing one**, especially when the source requirement/coverage matrix says the feature is confirmed present ("Help center: Yes" for all profiled brands in `Guideline/E2E_DISCOVERY_REPORT.md`). A test that skips everywhere verifies nothing — this should trigger live-DOM verification before accepting the result, not after a user manually questions it.

See also: [[ecommerce-pdp-page-gotchas]], [[gra-storefront-tech-notes]], [[fixture-registry]]
