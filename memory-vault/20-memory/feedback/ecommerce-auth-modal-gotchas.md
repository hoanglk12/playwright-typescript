---
name: ecommerce-auth-modal-gotchas
description: EcommerceAccountModalPage patterns — addLocatorHandler for Bloomreach popup, CMS block discriminator for click verification, Firefox CI exclusion, locator strategy for account toggle button
type: feedback
tags: [memory, feedback]
last_verified: 2026-06-16
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

## 6. Account panel detection strategy

The login panel is a native `<aside>` with implicit ARIA role `complementary` (not explicit `role="complementary"`). `locator('[role="complementary"]')` (CSS attribute selector) finds nothing. Use `page.getByRole('complementary')` which matches the implicit ARIA role.

Detection in `isModalVisible()` / `waitForModalVisible()`: three-part gate:
1. Selector: `aside, [role="complementary"]`
2. Position: `fixed` or `absolute` (excludes static page content)
3. Text content: matches `/log.?in|sign.?in|welcome back|email address|password/i`

Deliberately excludes `role="dialog"` to avoid false-positives from the Vans AU Bloomreach popup.
