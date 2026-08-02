import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

/**
 * EcommerceTrackOrderPage — page object for the Track Order utility page on
 * Magento PWA Studio GRA storefronts.
 *
 * Reached via the footer link rather than a hardcoded URL — the URL path varies
 * per storefront and is unconfirmed. Also matches how a real user navigates.
 *
 * Footer lazy-load: the footer is intersection-observer-gated on all 8 GRA
 * storefronts and only renders once the viewport reaches the bottom of the page
 * (same pattern used by `assertLoyaltyProgramVisible` in home-page.ts) —
 * `navigate()` scrolls to the bottom before checking for the link.
 *
 * Input label pattern (GRA Magento PWA): inputs use a sibling <div> as their
 * visible label, not a <label> element, so `getByLabel()` alone does not match.
 * Locators chain getByLabel → getByPlaceholder → container-scoped textbox as
 * fallback strategies.
 *
 * StarTrack constraint (Section 3, Constraint 12): form submission triggers a
 * third-party StarTrack tracking call. Only form presence is asserted — never
 * submission.
 */
export class EcommerceTrackOrderPage extends BasePage {
  /** `.filter({ visible: true })` excludes a hidden mobile/desktop nav duplicate. */
  private readonly trackOrderLink = this.page
    .getByRole('link', { name: /track (my )?order/i })
    .filter({ visible: true })
    .first();

  /**
   * Anchored regex `/^(track|submit)$/i` excludes persistent header/footer
   * buttons whose labels contain "check" ("Checkout") or "find" ("Find a
   * store") as substrings — those appear before the form in document order
   * and would otherwise be picked up by `.first()`.
   */
  private readonly submitButton = this.page
    .getByRole('button', { name: /^(track|submit)$/i })
    .first();

  /**
   * Deepest div (`.last()`) that contains exactly "Order Number" (anchored
   * regex, excludes wider ancestor divs with extra sibling/nested text) and a
   * textbox. Declared before orderNumberInput so the field initializer is available.
   */
  private readonly orderNumberInputContainer = this.page
    .locator('div')
    .filter({ hasText: /^order number$/i, has: this.page.getByRole('textbox') })
    .last();

  /**
   * Same scoping as orderNumberInputContainer. The anchored regex
   * `/^email address$/i` deliberately excludes the Vans AU Bloomreach popup
   * container, whose text content is "First Name*Email Address*Date of Birth…"
   * (a concatenation of all sibling inputs).
   */
  private readonly emailInputContainer = this.page
    .locator('div')
    .filter({ hasText: /^email address$/i, has: this.page.getByRole('textbox') })
    .last();

  /**
   * Strategy chain (tried left-to-right via .or()): getByLabel (storefronts
   * with a real <label>) → getByPlaceholder → container-scoped textbox
   * (confirmed fallback on Platypus, Skechers, Vans, Dr. Martens staging).
   */
  private readonly orderNumberInput = this.page
    .getByLabel(/order (id|number)/i)
    .or(this.page.getByPlaceholder(/order (id|number)/i))
    .or(this.orderNumberInputContainer.getByRole('textbox').first())
    .first();

  /**
   * getByLabel(/email/i) can also match the Bloomreach popup's email input
   * (e.g. Vans AU); the track order form input appears earlier in DOM order,
   * so `.first()` on the combined .or() result resolves to the correct one.
   */
  private readonly emailInput = this.page
    .getByLabel(/email/i)
    .or(this.page.getByPlaceholder(/email/i))
    .or(this.emailInputContainer.getByRole('textbox').first())
    .first();

  /**
   * Settle target for clickTrackOrderLink() — waits on what assertFormPresent()
   * actually checks. `.first()` is required: `.or()` is a union (up to 3
   * elements here), and waitFor() enforces strict mode.
   */
  private readonly anyFormControl = this.orderNumberInput
    .or(this.emailInput)
    .or(this.submitButton)
    .first();

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the storefront homepage and scroll to the bottom to trigger
   * lazy-loaded footer content. The Track Order link lives in the footer; without
   * scrolling it remains outside the viewport and the intersection observer does
   * not inject it into the DOM.
   *
   * `waitUntil: 'commit'` fires on the first byte of the HTTP response — too early
   * for evaluate() calls because document.body is null at that point. The subsequent
   * `waitForPageLoadState('domcontentloaded')` waits for the HTML to be fully parsed,
   * which makes document.body available for scrollToBottom(). DOMContentLoaded fires
   * after HTML parsing but before deferred analytics scripts, so it avoids the
   * "delayed by minutes" problem associated with 'load'/'networkidle'.
   */
  async navigate(baseUrl: string): Promise<void> {
    await this.gotoWithOptions(baseUrl, { waitUntil: 'commit' });
    await this.waits.waitForPageLoadState('domcontentloaded');
    await this.elements.scrollToBottom();
    await this.elements.waitForLocatorVisible(this.trackOrderLink, TIMEOUTS.PAGE_LOAD);
  }

  /**
   * Call after `navigate()` (which already scrolls to the bottom).
   * Returns false when the link is not configured on the storefront — the spec
   * should call `test.skip` in this case.
   */
  async isTrackOrderLinkPresent(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.trackOrderLink);
  }

  /**
   * Clicks the Track Order footer link and waits (best-effort) for a form
   * control to render, settling the page transition before `assertFormPresent`
   * — the authoritative failure gate — checks visibility with no retry of its own.
   */
  async clickTrackOrderLink(): Promise<void> {
    await this.elements.clickLocator(this.trackOrderLink);
    await this.elements.waitForLocatorVisible(this.anyFormControl, TIMEOUTS.PAGE_LOAD);
  }

  async isOrderNumberInputVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.orderNumberInput);
  }

  async isEmailInputVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.emailInput);
  }

  async isSubmitButtonVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.submitButton);
  }

  /**
   * Used as the hard pass/fail gate before per-field soft assertions.
   */
  async isFormPresent(): Promise<boolean> {
    const [orderInputVisible, emailVisible, submitVisible] = await Promise.all([
      this.isOrderNumberInputVisible(),
      this.isEmailInputVisible(),
      this.isSubmitButtonVisible(),
    ]);
    return orderInputVisible || emailVisible || submitVisible;
  }

  /**
   * Hard assertion: at least one Track Order form element must be visible.
   * Fails with a descriptive message that includes the site name to aid
   * debugging across the 8-storefront matrix.
   */
  async assertFormPresent(siteName: string): Promise<void> {
    expect(
      await this.isFormPresent(),
      `Expected Track Order form to be present (order number input, email input, or submit button visible) on ${siteName}`,
    ).toBe(true);
  }
}
