import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

/**
 * EcommerceTrackOrderPage — page object for the Track Order utility page on
 * Magento PWA Studio GRA storefronts.
 *
 * Navigation strategy: reach Track Order by clicking the footer link rather than
 * navigating to a hardcoded URL. The exact URL path varies across storefronts and
 * is not confirmed. This approach also matches how a real user navigates and survives
 * any future URL restructuring.
 *
 * Footer lazy-load: on all 8 GRA storefronts the footer is intersection-observer-gated
 * and is only injected into the DOM after the viewport reaches the bottom of the page.
 * `navigate()` explicitly scrolls to the bottom before checking for the Track Order link
 * (same pattern used by `assertLoyaltyProgramVisible` in home-page.ts).
 *
 * Input label pattern (GRA Magento PWA): the Track Order form uses sibling <div> text
 * as visible labels, NOT <label> elements. The DOM looks like:
 *   <div>
 *     <input type="text" />         ← no accessible label
 *     <div>Order Number</div>       ← visual label (sibling, not a <label>)
 *   </div>
 * Playwright's getByLabel() does not match this pattern. The locators here chain
 * getByLabel → getByPlaceholder → container-scoped textbox as fallback strategies.
 *
 * StarTrack constraint (Section 3, Constraint 12): form submission triggers a third-party
 * StarTrack tracking call. Only form presence is asserted — never submission.
 */
export class EcommerceTrackOrderPage extends BasePage {
  /**
   * Footer/header link whose accessible name matches "Track Order" or
   * "Track My Order" (case-insensitive). `.first()` prevents strict-mode violations
   * if the same link appears in both the mobile and desktop nav layers.
   */
  private readonly trackOrderLink = this.page
    .getByRole('link', { name: /track (my )?order/i })
    .first();

  /**
   * Page heading on the Track Order page — best-effort only.
   * Some storefronts may not render an explicit heading. `.first()` prevents
   * strict-mode violations on storefronts with multiple headings.
   */
  private readonly pageHeading = this.page
    .getByRole('heading', { name: /track (your |my )?order/i })
    .first();

  /**
   * Submit button on the Track Order form.
   * Anchored regex `/^(track|submit)$/i` matches only exact "Track" or "Submit"
   * button labels. This deliberately excludes persistent header/footer buttons
   * whose labels contain "check" ("Checkout") or "find" ("Find a store") as
   * substrings — those buttons appear before the form in document order and would
   * be incorrectly selected by a substring regex with `.first()`.
   */
  private readonly submitButton = this.page
    .getByRole('button', { name: /^(track|submit)$/i })
    .first();

  /**
   * Container div for the order number field.
   * Scoped to the DEEPEST div (`.last()` in document order) that:
   *   (a) contains exactly "Order Number" as its text content (anchored regex), AND
   *   (b) contains a textbox.
   * The anchored regex `/^order number$/i` excludes wider ancestor divs whose
   * text content includes additional text from sibling or nested elements.
   * Declared before orderNumberInput so the field initializer is available.
   */
  private readonly orderNumberInputContainer = this.page
    .locator('div')
    .filter({ hasText: /^order number$/i, has: this.page.getByRole('textbox') })
    .last();

  /**
   * Container div for the email field.
   * Same scoping strategy as orderNumberInputContainer. The anchored regex
   * `/^email address$/i` deliberately excludes the Vans AU Bloomreach popup
   * container, whose text content is "First Name*Email Address*Date of Birth…"
   * (a concatenation of all sibling inputs) and therefore does not match the anchor.
   * Declared before emailInput so the field initializer is available.
   */
  private readonly emailInputContainer = this.page
    .locator('div')
    .filter({ hasText: /^email address$/i, has: this.page.getByRole('textbox') })
    .last();

  /**
   * Order number input.
   * Strategy chain (tried left-to-right via .or()):
   *   1. getByLabel — works on storefronts with proper <label> elements.
   *   2. getByPlaceholder — works on storefronts using placeholder text.
   *   3. Container-scoped textbox — fallback for GRA Magento PWA storefronts
   *      that use sibling-div text as the visible label (confirmed: Platypus,
   *      Skechers, Vans, Dr. Martens staging environments).
   */
  private readonly orderNumberInput = this.page
    .getByLabel(/order (id|number)/i)
    .or(this.page.getByPlaceholder(/order (id|number)/i))
    .or(this.orderNumberInputContainer.getByRole('textbox').first())
    .first();

  /**
   * Email input.
   * Same strategy chain as orderNumberInput.
   * Note: getByLabel(/email/i) may also match inputs in the Bloomreach popup
   * (e.g. "Email Address*" on Vans AU). Because the track order form inputs
   * appear earlier in DOM order than the popup inputs, `.first()` on the .or()
   * result correctly returns the track order email input.
   */
  private readonly emailInput = this.page
    .getByLabel(/email/i)
    .or(this.page.getByPlaceholder(/email/i))
    .or(this.emailInputContainer.getByRole('textbox').first())
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
    await this.page.goto(baseUrl, { waitUntil: 'commit' });
    // Wait for the HTML to be parsed so document.body is available before
    // scrollToBottom() accesses document.body.scrollHeight.
    await this.waits.waitForPageLoadState('domcontentloaded');
    // Scroll to bottom so the intersection observer renders the footer and the
    // Track Order link becomes part of the DOM (same rationale as home-page.ts
    // assertLoyaltyProgramVisible which also targets footer-gated content).
    await this.elements.scrollToBottom();
    await this.trackOrderLink.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD }).catch(() => {});
  }

  /**
   * Returns true if the Track Order link is visible in the footer/nav.
   * Call after `navigate()` (which already scrolls to the bottom).
   * Returns false when the link is not configured on the storefront — the spec
   * should call `test.skip` in this case.
   */
  async isTrackOrderLinkPresent(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.trackOrderLink);
  }

  /**
   * Clicks the Track Order footer link and waits (best-effort) for the page
   * heading to become visible. The heading wait is `.catch(() => {})` because
   * some storefronts may not render a heading — `assertFormPresent` is the
   * authoritative failure gate.
   */
  async clickTrackOrderLink(): Promise<void> {
    await this.elements.clickLocator(this.trackOrderLink);
    await this.pageHeading.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD }).catch(() => {});
  }

  /**
   * Individual field visibility queries — exposed so the spec can soft-assert
   * each field independently without inlining locators in the spec file.
   */
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
   * Returns true if at least one of the three expected form elements
   * (order number input, email input, submit button) is visible on the page.
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
