import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceAccountModalPage extends BasePage {
  // Used in navigate() to wait for React hydration before interacting.
  private readonly mainElement: Locator = this.page.locator('main');

  // Trusted Playwright Locator for the account icon button. React synthetic
  // events need pointer/mouse events — page.evaluate().click() skips these and
  // frequently fails to toggle state. A trusted Locator.click() dispatches the
  // full event chain, including pointerdown → mousedown → click → pointerup.
  //
  // All 8 GRA storefronts (Platypus AU/NZ, Skechers AU/NZ, Vans AU/NZ,
  // Dr. Martens AU/NZ) expose the account icon with aria-label
  // "Toggle My Account Menu". The regex handles any cross-brand variation.
  private readonly accountToggleButton: Locator = this.page
    .getByRole('button', { name: /toggle my account/i })
    .first();

  // Fallback locator for storefronts that expose the account icon as a link
  // rather than a button. Only used when the button locator finds no visible
  // element. Scoped to header to avoid matching body nav links.
  private readonly accountToggleLink: Locator = this.page
    .locator('header')
    .getByRole('link', { name: /account|sign.?in|log.?in|my account/i })
    .first();

  // The account panel container after it opens. All GRA storefronts render this
  // as a native <aside> element with position: fixed and z-index: 101.
  // <aside> has an IMPLICIT ARIA role of "complementary" — there is no explicit
  // role="complementary" attribute, so locator('[role="complementary"]') (a CSS
  // attribute selector) finds nothing. page.getByRole('complementary') uses the
  // ARIA role and correctly matches native <aside> elements.
  // Filtered to the panel that contains login-specific text so it doesn't match
  // the adjacent mini-cart <aside>.
  private readonly accountPanel: Locator = this.page
    .getByRole('complementary')
    .filter({ hasText: /log.?in|sign.?in|welcome back|my account/i });

  // Login form input locators scoped to accountPanel.
  // Email input: <input name="email"> with no type attribute (defaults to text,
  // implicit ARIA role = textbox). No accessible name — label is a generic sibling
  // div, not a <label> element. Using CSS name selector is the most reliable match.
  //
  // Password input: <input type="password"> does NOT have ARIA role "textbox" per
  // the ARIA spec, so getByRole('textbox').nth(1) finds nothing. Using CSS
  // type selector is required here.
  private readonly emailInputLocator: Locator = this.accountPanel
    .locator('input[name="email"], input[type="email"]')
    .first();

  private readonly passwordInputLocator: Locator = this.accountPanel
    .locator('input[type="password"]')
    .first();

  private readonly loginButtonLocator: Locator = this.accountPanel
    .getByRole('button', { name: /^login$|^sign.?in$|^log.?in$/i });

  // CSS selector string for isModalVisible() and getModalTitle() which run
  // inside page.evaluate() where Playwright Locators cannot be used.
  // Deliberately restricted to aside and complementary — does NOT include
  // [role="dialog"] to avoid false-positives from the Vans AU Bloomreach popup.
  private readonly modalContainerSelector =
    'aside, [role="complementary"]';

  // Text pattern that positively identifies the account/login panel content.
  // Must match "LOGIN TO PLATYPUS", "Log in to your account", "Welcome Back",
  // "Email Address", "Password" — all present in the panel after CMS block loads.
  // Deliberately does NOT include "create account" (matches Bloomreach signup),
  // "newsletter", or "join" to avoid false-positives from promotional popups.
  private readonly loginPanelTextPattern = /log.?in|sign.?in|welcome back|email address|password/i;

  // CMS block identifier for the login popup heading — used to wait for the
  // account panel CMS content to load before asserting on panel visibility.
  // This fetch fires when the account button is clicked on GRA storefronts.
  private readonly loginCmsBlockPattern = /login_popup/;

  // Text pattern that unambiguously identifies a logged-in panel state.
  // Deliberately excludes "welcome" and "my account" — both appear in the
  // pre-login panel ("Welcome Back", "Toggle My Account Menu" aria-label) and
  // would produce false-positive logged-in signals on a failed login attempt.
  // Only "logout", "sign out", and "dashboard" are exclusive to an authenticated
  // session on GRA storefronts.
  private readonly loggedInPanelTextPattern = /logout|sign.?out|dashboard/i;

  // Error message locator for failed login attempts on GRA storefronts.
  //
  // The error renders as a plain <div> (generic in ARIA snapshot) — NOT as
  // role="alert". getByRole('alert') matches nothing. Observed text on Platypus AU:
  // "The email address and password entered doesn't match our records."
  // GRA Magento also uses: "The account sign-in was incorrect or your account is
  // disabled temporarily." Regex anchors on failure-only phrases — deliberately
  // excludes "email", "password", "sign in", "log in" because those strings appear
  // in the static panel labels (Email Address input, Password input, LOGIN button)
  // BEFORE any submission, which would make errorBeforeSubmit non-empty.
  private readonly loginErrorLocator: Locator = this.accountPanel
    .getByText(/doesn't match|do not match|incorrect.*account|account.*incorrect|disabled temporarily|try again/i)
    .first();

  constructor(page: Page) {
    super(page);
  }

  // Navigate to a storefront URL, wait for React to hydrate, and register a
  // handler for the Vans AU Bloomreach popup.
  //
  // addLocatorHandler fires during the actionability wait of ANY subsequent
  // action (hover, click, etc.) the moment the trigger locator becomes visible.
  // This handles both failure modes of a manual pre-click dismiss:
  //   1. Timing race — popup appears AFTER the pre-click check returns
  //   2. Z-index coverage — the #overlay div may sit above the close button,
  //      so clicking the button itself can be intercepted
  // Removing via JS is instant and cannot be blocked by z-index.
  // The handler is zero-cost on storefronts where the popup never appears.
  async navigate(url: string): Promise<void> {
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

    const firstGqlPromise = this.page
      .waitForResponse(
        (resp) => resp.url().includes('graphql') && resp.request().method() === 'GET',
        { timeout: TIMEOUTS.PAGE_LOAD },
      )
      .catch(() => null);

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await firstGqlPromise;
    await this.mainElement.waitFor({ state: 'visible' });
  }

  // Open the login panel by clicking the account icon button.
  //
  // On all 8 GRA storefronts the account flyout (aside, role="complementary")
  // is populated by lazy-fetched CMS blocks. The GraphQL requests for these
  // blocks fire only after a trusted Playwright click() on the account button
  // — NOT on hover alone. We register a response listener BEFORE clicking so
  // we can detect whether React actually handled the click.
  //
  // Retry rationale: on slow-hydrating storefronts the click can land before
  // React attaches its onClick handler. The button toggles its CSS :active state
  // (making it look active in the accessibility snapshot) but no CMS block
  // request fires. We use cmsResult !== null as the discriminator — a resolved
  // response proves React handled the click and the panel is opening; null means
  // the click was a no-op and it is safe to click again (the panel never opened).
  // We do NOT re-click when cmsResult !== null: the panel is open and a second
  // click would toggle it closed.
  async openModal(): Promise<void> {
    const buttonVisible = await this.accountToggleButton.isVisible().catch(() => false);

    if (buttonVisible) {
      const cmsBlockPattern = this.loginCmsBlockPattern;

      for (let attempt = 0; attempt < 3; attempt++) {
        // Register the waiter BEFORE each click to avoid missing a fast response.
        // Timeout is ELEMENT_VISIBLE (10s local / 20s CI): must be long enough
        // that a legitimate request that takes >2s still resolves as non-null.
        // null can only reliably mean "no request fired" when the window outlasts
        // the slowest genuine request on the staging network.
        const cmsResponsePromise = this.page
          .waitForResponse(
            (resp) => resp.url().includes('graphql') && cmsBlockPattern.test(resp.url()),
            { timeout: TIMEOUTS.ELEMENT_VISIBLE },
          )
          .catch(() => null);

        if (attempt === 0) {
          await this.accountToggleButton.hover();
        }
        await this.accountToggleButton.click();

        const cmsResult = await cmsResponsePromise;
        // CMS request fired → React handled the click → panel is opening.
        // Return without re-clicking to avoid toggling the panel closed.
        if (cmsResult !== null) return;
        // cmsResult === null → no request seen → no-op click → retry.
      }
      return;
    }

    // Fallback for storefronts using a link element for the account entry point.
    const linkVisible = await this.accountToggleLink.isVisible().catch(() => false);
    if (linkVisible) {
      await this.accountToggleLink.hover();
      await this.elements.clickLocator(this.accountToggleLink);
      return;
    }

    // Last-resort evaluate scan — targets header elements by semantic attributes.
    // Only reached if neither Playwright locator matched.
    await this.page.evaluate(() => {
      const headerEl = document.querySelector('header');
      if (!headerEl) return;
      const candidates = Array.from(
        headerEl.querySelectorAll('button, a, [role="button"]'),
      ).filter((el) => {
        const r = (el as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const label = (
          (el.getAttribute('aria-label') ?? '') +
          ' ' +
          (el.getAttribute('title') ?? '') +
          ' ' +
          ((el instanceof HTMLElement ? el.innerText : el.textContent) ?? '')
        ).toLowerCase();
        return /account|sign.?in|login|user/.test(label);
      });
      if (candidates.length > 0) (candidates[0] as HTMLElement).click();
    });
  }

  // Returns true when the account/login panel is visible in the DOM.
  //
  // Detection strategy: find any aside/complementary element that is
  // overlay-positioned (fixed or absolute with z-index > 0) and contains
  // login-specific text. Restricted to aside and complementary selectors only
  // (not dialog) to avoid matching the Vans AU Bloomreach email-capture popup.
  async isModalVisible(): Promise<boolean> {
    const sel = this.modalContainerSelector;
    const textPattern = this.loginPanelTextPattern;
    return this.page.evaluate(
      ({ selector, pattern }) => {
        const textRegex = new RegExp(pattern, 'i');
        const candidates = Array.from(document.querySelectorAll(selector));
        return candidates.some((el) => {
          // Must have non-zero dimensions
          const r = (el as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const style = getComputedStyle(el as Element);
          // Must be overlay-positioned (fixed panel, not static page content)
          const isPositioned =
            style.position === 'fixed' ||
            style.position === 'absolute' ||
            parseInt(style.zIndex, 10) > 0;
          if (!isPositioned) return false;
          // Must contain login-specific text (not empty panel before CMS load)
          const text = (
            (el instanceof HTMLElement ? el.innerText : el.textContent) ?? ''
          ).toLowerCase();
          return textRegex.test(text);
        });
      },
      { selector: sel, pattern: textPattern.source },
    );
  }

  // Waits until the login panel's text is visible in an overlay-positioned aside.
  // Uses page.waitForFunction() with requestAnimationFrame polling (~16ms) instead
  // of a manual 500ms interval — reacts within milliseconds of the React DOM commit
  // after the CMS block response is processed. Best-effort: .catch swallows timeout
  // so the hard expect() in the spec is the definitive failure point.
  async waitForModalVisible(): Promise<void> {
    const sel = this.modalContainerSelector;
    const pattern = this.loginPanelTextPattern.source;
    await this.page
      .waitForFunction(
        ({ selector, pat }) => {
          const textRegex = new RegExp(pat, 'i');
          return Array.from(document.querySelectorAll(selector)).some((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const style = getComputedStyle(el);
            const isPositioned =
              style.position === 'fixed' ||
              style.position === 'absolute' ||
              parseInt(style.zIndex, 10) > 0;
            if (!isPositioned) return false;
            return textRegex.test(
              (el instanceof HTMLElement ? el.innerText : el.textContent) ?? '',
            );
          });
        },
        { selector: sel, pat: pattern },
        { timeout: TIMEOUTS.ELEMENT_VISIBLE },
      )
      .catch(() => {});
  }

  // Returns the first meaningful line of the visible login panel's text content.
  // The panel heading ("LOGIN TO SKECHERS", "Welcome Back…") lives in a generic
  // <div> element — not in an h1-h4 or a class*="title" element — so semantic
  // heading selectors return nothing. innerText on the scoped accountPanel locator
  // gives the full visible text; the first non-trivial line is the title.
  async getModalTitle(): Promise<string> {
    try {
      const panelText = await this.accountPanel.first().innerText({ timeout: 2000 });
      return (
        panelText
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 3 && l.length < 120) ?? ''
      );
    } catch {
      return '';
    }
  }

  getEmailInput(): Locator {
    return this.emailInputLocator;
  }

  getPasswordInput(): Locator {
    return this.passwordInputLocator;
  }

  getLoginButton(): Locator {
    return this.loginButtonLocator;
  }

  // Fill the email input inside the login panel.
  async fillEmail(email: string): Promise<void> {
    await this.emailInputLocator.fill(email);
  }

  // Fill the password input inside the login panel.
  async fillPassword(password: string): Promise<void> {
    await this.passwordInputLocator.fill(password);
  }

  // Click the Login button and wait for the GraphQL customer-token mutation
  // response that follows a successful login attempt. The wait is best-effort
  // (POST to /graphql with generateCustomerToken in the body): if the mutation
  // is batched differently or renamed the catch silences the timeout and lets
  // waitForLoginComplete() handle the post-login state check.
  async clickLogin(): Promise<void> {
    const tokenMutationPromise = this.page
      .waitForResponse(
        (resp) =>
          resp.url().includes('graphql') &&
          resp.request().method() === 'POST' &&
          (resp.request().postData() ?? '').includes('generateCustomerToken'),
        { timeout: TIMEOUTS.API_RESPONSE },
      )
      .catch(() => null);

    await this.loginButtonLocator.click();
    await tokenMutationPromise;
  }

  // Convenience method: fill email, fill password, then click Login.
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  // Returns true when at least one unambiguous logged-in signal is detected.
  // Signals ordered strongest → weakest (see method body for rationale).
  async isLoggedIn(): Promise<boolean> {
    // Strongest signal: Magento redirects to the customer dashboard on successful login
    if (this.page.url().includes('/customer/account')) return true;

    // Second signal: authenticated-only panel text visible in the account aside
    const loggedInPattern = this.loggedInPanelTextPattern;
    const sel = this.modalContainerSelector;
    const foundLoggedInText = await this.page.evaluate(
      ({ selector, pattern }) => {
        const textRegex = new RegExp(pattern, 'i');
        return Array.from(document.querySelectorAll(selector)).some((el) => {
          const r = (el as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const style = getComputedStyle(el as Element);
          const isPositioned =
            style.position === 'fixed' ||
            style.position === 'absolute' ||
            parseInt(style.zIndex, 10) > 0;
          if (!isPositioned) return false;
          const text = (el instanceof HTMLElement ? el.innerText : el.textContent) ?? '';
          return textRegex.test(text);
        });
      },
      { selector: sel, pattern: loggedInPattern.source },
    );
    if (foundLoggedInText) return true;

    // Weakest fallback: panel closed after a token mutation was awaited in clickLogin()
    return !(await this.isModalVisible());
  }

  async waitForLoginError(): Promise<void> {
    await this.loginErrorLocator
      .waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE })
      .catch(() => {});
  }

  async getLoginErrorMessage(): Promise<string> {
    return this.loginErrorLocator.innerText().catch(() => '');
  }

  // Polls isLoggedIn() on the TypeScript side using a retry budget.
  // Cannot use page.waitForFunction() because isLoggedIn() is composite async
  // (it calls page.evaluate + page.url). Best-effort: catches timeout and lets
  // the hard expect() in the spec be the definitive failure point.
  async waitForLoginComplete(): Promise<void> {
    const deadline = Date.now() + TIMEOUTS.ELEMENT_VISIBLE;
    await (async () => {
      while (Date.now() < deadline) {
        const loggedIn = await this.isLoggedIn().catch(() => false);
        if (loggedIn) return;
        await this.page.waitForTimeout(TIMEOUTS.POLL_INTERVAL_NORMAL);
      }
    })().catch(() => {});
  }
}
