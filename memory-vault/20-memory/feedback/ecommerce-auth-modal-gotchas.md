---
name: ecommerce-auth-modal-gotchas
description: EcommerceAccountModalPage patterns — addLocatorHandler for Bloomreach popup, CMS block discriminator for click verification, Firefox CI exclusion, locator strategy for account toggle button, modal title race condition fix
type: feedback
tags: [memory, feedback]
last_verified: 2026-06-20
---

## 1. Page object location and fixture

- Page object: `src/pages/ecommerce/account-modal.ts` → `EcommerceAccountModalPage`
- Fixture: `ecommerceAccountModalPage` (registered in `src/config/base-test.ts`)
- Firefox teardown: ✅ (navigates to `about:blank` before context close)
- Tests: `tests/ecommerce/smoke/auth.spec.ts` — E2E-AUTH-001-001 through -008

---

## 2. Vans AU — Bloomreach popup blocks account button click

The Bloomreach acquisition popup's `<div id="overlay" class="overlay visible">` intercepts all pointer events. The dialog is a SIBLING of `.bloomreach-acquisition-popup-template`, not a child — scoped close button lookups return nothing.

**Fix:** `page.addLocatorHandler()` registered in `navigate()` before `page.goto()`:

```ts
await this.page.addLocatorHandler(
  this.page.getByRole('dialog', { name: /join the crew|10% off/i }),
  async () => {
    await this.page.evaluate(() => {
      document
        .querySelectorAll('[class*="bloomreach-acquisition-popup"]')
        .forEach((el) => el.remove());
    });
  },
);
```

Handler fires during the actionability wait of any subsequent action. JS removal bypasses z-index. Zero-cost on non-Vans storefronts.

---

## 3. CMS block discriminator for click verification

GRA storefronts lazily load the login panel via a GraphQL CMS block request (`login_popup` in URL). Register a `waitForResponse` listener BEFORE each click, then use the response as a discriminator:

- `cmsResult !== null` → React handled the click → panel opening → do NOT re-click
- `cmsResult === null` → no-op click (React handler not yet attached) → retry

```ts
const cmsResponsePromise = this.page
  .waitForResponse(
    (resp) => resp.url().includes('graphql') && /login_popup/.test(resp.url()),
    { timeout: TIMEOUTS.ELEMENT_VISIBLE },
  )
  .catch(() => null);

await this.accountToggleButton.click();
const cmsResult = await cmsResponsePromise;
if (cmsResult !== null) return;  // panel is opening — don't toggle it closed
```

---

## 4. Account toggle button — locator strategy

`getByRole('button', { name: /toggle my account/i })` matches `aria-label="Toggle My Account Menu"` on all 8 GRA storefronts on Chromium.

Fallbacks in `openModal()`:
1. `accountToggleButton` — `getByRole('button', { name: /toggle my account/i }).first()`
2. `accountToggleLink` — `header.getByRole('link', { name: /account|sign.?in|log.?in|my account/i }).first()`
3. `page.evaluate()` scan of header buttons/links by aria-label + text content

---

## 5. Firefox excluded from ecommerce/smoke in CI

`playwright.config.ts` Firefox project:
```ts
testIgnore: process.env.CI ? ['**/api/**', '**/ecommerce/smoke/**'] : ['**/api/**'],
```

Firefox never runs auth.spec.ts (or any ecommerce/smoke) in CI. Chromium 8/8 is the CI bar.
Local Firefox failures on ecommerce smoke are pre-existing and out of scope for CI fixes.

---

## 7. Modal branded title — CMS lazy-injection race condition

**Symptom:** `getModalTitle()` returns "Email Address" or "Welcome Back" instead of the brand-specific heading (e.g. "Sign In to Platypus") on 3–5 of 8 storefronts. Happens specifically when the spec calls `getModalTitle()` immediately after the panel opens.

**Root cause:** GRA storefronts inject the branded heading via a GraphQL CMS block request (`login_popup`) that is lazily loaded after the panel DOM appears. A one-time `innerText()` snapshot races against this injection and loses on slower storefronts (Skechers NZ, Vans AU, Dr. Martens NZ observed failing in E2E-AUTH-011, 2026-06-20).

**Fix:** Use a retrying web-first assertion against the panel locator instead of a one-time text snapshot:

```ts
// WRONG — snapshot races against CMS lazy-load
const title = await ecommerceAccountModalPage.getModalTitle(); // innerText()
expect(title).toContain('Platypus');

// CORRECT — polls until CMS heading renders
expect(ecommerceAccountModalPage.getModalPanel()).toContainText(/platypus/i, {
  timeout: TIMEOUTS.ELEMENT_VISIBLE,
});
```

`getModalPanel()` was added to `EcommerceAccountModalPage` (`src/pages/ecommerce/account-modal.ts`) returning `this.accountPanel.first()` as a `Locator`. The retrying `expect(locator).toContainText()` assertion polls automatically — no explicit wait needed.

**Pattern:** Whenever asserting CMS-injected text content in a GRA modal, always use `expect(locator).toContainText()` (web-first, retrying) — never `expect(await locator.innerText()).toContain()` (one-shot snapshot).

See also: [[ecommerce-pdp-page-gotchas]] §3 (CMS block discriminator for click verification).

---

## 8. GRA login panel branded heading format + dynamic brand token derivation

**DOM fact:** GRA login panels inject a heading of the form `"LOGIN TO {BRAND}"` or `"SIGN IN TO {BRAND}"`. For multi-word brands, only the last word appears — e.g. `"Dr. Martens"` → `"LOGIN TO MARTENS"`, not `"LOGIN TO DR. MARTENS"`.

**Consequence for assertions:** Never assert against the full `site.name` string (e.g. `"Dr. Martens AU"`). Strip the market suffix AND take only the last word.

**Reusable derivation pattern** (from E2E-AUTH-011, spec line 230–233):

```ts
// Derive brand token from site.name — handles multi-word brands and regex-special chars
const brandToken = site.name.replace(/\s+(AU|NZ)$/i, '').trim();       // "Dr. Martens"
const brandLastWord = brandToken.split(/\s+/).pop() ?? brandToken;      // "Martens"
const escapedToken = brandLastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // "Martens" (dot in "Dr." escaped if it appears)
const brandRegex = new RegExp(escapedToken, 'i');

await expect(ecommerceAccountModalPage.getModalPanel()).toContainText(brandRegex, {
  timeout: TIMEOUTS.ELEMENT_VISIBLE,
});
```

Single-word brands (Platypus, Skechers, Vans) are unaffected — `split().pop()` returns the only word.

**No `storefronts.ts` change needed** — the derivation is fully algorithmic from `site.name`. Do not add a `brandTitleRegex` field to `storefronts.ts` unless a brand's actual panel heading diverges from this pattern.

---

## 6. Account panel detection strategy

The login panel is a native `<aside>` with implicit ARIA role `complementary` (not explicit `role="complementary"`). `locator('[role="complementary"]')` (CSS attribute selector) finds nothing. Use `page.getByRole('complementary')` which matches the implicit ARIA role.

Detection in `isModalVisible()` / `waitForModalVisible()`: three-part gate:
1. Selector: `aside, [role="complementary"]`
2. Position: `fixed` or `absolute` (excludes static page content)
3. Text content: matches `/log.?in|sign.?in|welcome back|email address|password/i`

Deliberately excludes `role="dialog"` to avoid false-positives from the Vans AU Bloomreach popup.
