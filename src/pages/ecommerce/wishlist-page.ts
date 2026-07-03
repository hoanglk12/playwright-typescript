import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

/**
 * EcommerceWishlistPage — page object for the Wishlist utility page on
 * Magento PWA Studio GRA storefronts (E2E-UTIL-007).
 *
 * Confirmed live (headless Chromium investigation against staging Platypus AU,
 * Platypus NZ, Skechers AU, Skechers NZ, Vans AU, Vans NZ, Dr. Martens AU, and
 * Dr. Martens NZ — all 8 GRA storefronts): the header wishlist entry point is a
 * real `<a href="/wishlist">` anchor wrapping a `<button aria-label="Toggle
 * Wishlist">` icon (heart SVG). Unlike the Help/Support trigger (a `<figure>`
 * with no href — see help-support-page.ts), this element is a genuine link:
 * clicking it with a normal Playwright locator click reliably navigated from
 * the homepage to `{baseUrl}wishlist` on every one of the 8 storefronts
 * checked. No flyout/panel step is involved — the destination is a full page,
 * not an overlay.
 *
 * Locator strategy: `getByRole('button', { name: 'Toggle Wishlist', exact:
 * true })` targets the inner button directly rather than the wrapping anchor
 * — the anchor itself carries no accessible name (empty text, no aria-label),
 * only the nested button does. Confirmed exactly one match on every
 * storefront checked (no strict-mode violation).
 *
 * Guest render outcome (confirmed live on all 8 storefronts): the `/wishlist`
 * page always renders a "MY WISHLIST" heading and the empty-state message
 * "You have no items in your list." Most storefronts additionally render a
 * "Please Sign in or Register to manage your Saved items…" prompt with SIGN
 * IN / REGISTER controls above the empty-state message; this prompt was
 * observed to be intermittently absent on a fast-loading investigation pass
 * of one storefront (timing/hydration variance, not a confirmed per-brand
 * difference). Both the empty-state message and the sign-in prompt are
 * therefore treated as independently valid guest outcomes rather than a
 * single hard-coded expectation — `isEmptyWishlistMessageVisible()` and
 * `isLoginPromptVisible()` are exposed separately so the spec can soft-assert
 * either without hard-failing on the "wrong" valid variant.
 * `assertWishlistPageRendered` only asserts that navigation to the wishlist
 * page succeeded (URL changed and/or the "MY WISHLIST" heading is visible),
 * never which specific empty-state variant appeared.
 *
 * Heading note: unlike Dr. Martens PDPs (two `<h1>` — see
 * tests/ecommerce/CLAUDE.md "EcommercePDPPage — Known Storefront Gotchas"),
 * the wishlist page renders zero `<h1>` elements on every storefront checked;
 * "MY WISHLIST" is a non-`<h1>` heading matched via `getByRole('heading', ...)`
 * with a case-insensitive regex, confirmed to resolve to exactly one match on
 * every storefront checked. `.first()` is still applied defensively per
 * project convention.
 */
export class EcommerceWishlistPage extends BasePage {
  /**
   * Header wishlist trigger — a `<button aria-label="Toggle Wishlist">` nested
   * inside an `<a href="/wishlist">` anchor. Confirmed present in the header
   * icon bar (alongside "Toggle My Account Menu" and the mini-cart toggle) on
   * all 8 GRA storefronts. `exact: true` avoids accidentally matching a longer
   * label on a storefront not yet verified live.
   */
  private readonly headerWishlistTrigger = this.page
    .getByRole('button', { name: 'Toggle Wishlist', exact: true })
    .first();

  /**
   * "MY WISHLIST" page heading on the wishlist destination. Confirmed present
   * (as a non-`<h1>` heading role) with exactly one match on every storefront
   * checked.
   */
  private readonly wishlistHeading = this.page.getByRole('heading', { name: /my wishlist/i }).first();

  /**
   * Guest empty-state message. Confirmed present verbatim ("You have no items
   * in your list.") on every one of the 8 storefronts checked.
   */
  private readonly emptyWishlistMessage = this.page.getByText('You have no items in your list.').first();

  /**
   * Guest login/registration prompt shown above the empty-state message on
   * most storefronts checked ("Please Sign in or Register to manage your
   * Saved items and access them everywhere").
   */
  private readonly loginPrompt = this.page.getByText(/please sign in or register/i).first();

  /**
   * Homepage URL captured on `navigate()` — used by `hasNavigatedToWishlistPage`
   * to detect a URL change as one of two independent render-success signals.
   */
  private homeUrl = '';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the storefront homepage and wait (best-effort) for the header
   * wishlist trigger to become visible.
   *
   * `waitUntil: 'commit'` fires on the first byte of the HTTP response — too
   * early for the subsequent visibility check because document.body is null
   * at that point. `waitForPageLoadState('domcontentloaded')` waits for the
   * HTML to be fully parsed before the visibility wait begins (same pattern
   * as EcommerceHelpSupportPage / EcommerceTrackOrderPage).
   */
  async navigate(baseUrl: string): Promise<void> {
    await this.page.goto(baseUrl, { waitUntil: 'commit' });
    await this.waits.waitForPageLoadState('domcontentloaded');
    this.homeUrl = this.page.url();
    await this.headerWishlistTrigger.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD }).catch(() => {});
  }

  /**
   * Returns true if the header wishlist trigger is visible. Call after
   * `navigate()`. Returns false when it is not configured (or detectable) on
   * this staging storefront — the spec should call `test.skip` in this case.
   */
  async isWishlistLinkPresent(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.headerWishlistTrigger);
  }

  /**
   * Clicks the header wishlist trigger and waits (best-effort) for the
   * "MY WISHLIST" heading to become visible. The heading wait is
   * `.catch(() => {})` because `assertWishlistPageRendered` is the
   * authoritative failure gate, not this wait.
   */
  async clickWishlistLink(): Promise<void> {
    await this.elements.clickLocator(this.headerWishlistTrigger);
    await this.wishlistHeading.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD }).catch(() => {});
  }

  /**
   * Returns true if the "MY WISHLIST" heading is visible. Exposed so the spec
   * can soft-assert it without inlining the locator in the spec file.
   */
  async isWishlistHeadingVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.wishlistHeading);
  }

  /**
   * Returns true if the guest empty-state message ("You have no items in your
   * list.") is visible.
   */
  async isEmptyWishlistMessageVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.emptyWishlistMessage);
  }

  /**
   * Returns true if the guest sign-in/register prompt is visible.
   */
  async isLoginPromptVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.loginPrompt);
  }

  /**
   * Returns true if navigation away from the homepage succeeded — the URL
   * changed from the captured homepage URL and now points at a wishlist path.
   * The confirmed destination on every storefront checked live is
   * `{baseUrl}wishlist`.
   */
  private hasNavigatedToWishlistPage(): boolean {
    return this.page.url() !== this.homeUrl && /\/wishlist/i.test(this.page.url());
  }

  /**
   * Hard assertion: the Wishlist page must have rendered — either the URL
   * changed to a wishlist path, or the "MY WISHLIST" heading became visible
   * (or both). Deliberately does NOT assert which guest empty-state variant
   * appeared — see class docblock. Fails with a descriptive message that
   * includes the site name to aid debugging across the 8-storefront matrix.
   */
  async assertWishlistPageRendered(siteName: string): Promise<void> {
    const [urlChanged, headingVisible] = await Promise.all([
      Promise.resolve(this.hasNavigatedToWishlistPage()),
      this.isWishlistHeadingVisible(),
    ]);
    expect(
      urlChanged || headingVisible,
      `Expected the Wishlist page to render (URL changed to a wishlist path and/or "MY WISHLIST" heading visible) on ${siteName}`,
    ).toBe(true);
  }
}
