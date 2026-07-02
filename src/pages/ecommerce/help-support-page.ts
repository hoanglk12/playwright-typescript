import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

/**
 * EcommerceHelpSupportPage — page object for the Help/Support entry point exposed in
 * the site header on Magento PWA Studio GRA storefronts (E2E-UTIL-005).
 *
 * Confirmed live (Playwright MCP browser session against staging Platypus AU and
 * Skechers AU — both share the same PWA Studio stack as all 8 GRA storefronts):
 * the header "Help" element is a `<figure>` icon+label **trigger**, not an `<a>` link
 * (no `href`, accessible role "figure", not "link"). Clicking it opens a flyout panel
 * (an unlabeled `role="complementary"` region, same landmark pattern documented for
 * the mini-cart overlay in `tests/ecommerce/CLAUDE.md`) containing the real
 * destination links. The exact link label varies by brand — Platypus AU renders a
 * link literally named "Help"; Skechers AU renders no "Help" link but does render
 * "FAQs" and "Contact Us", both pointing to the same external Zendesk help-center
 * domain (`https://help.{brand}.com.au/hc/en-us`). `flyoutSupportLink` therefore
 * matches on a label set, not a single exact string.
 *
 * A `getByRole('link', ...)` locator on the top-level "Help" figure will NEVER match
 * — this was the root cause of a false `test.skip()` on all 8 storefronts in an
 * earlier version of this file (the figure has no accessible link role to match).
 *
 * Click reliability note: a raw DOM `element.click()` (e.g. via `page.evaluate`) did
 * NOT reliably open the flyout in live testing, but a real Playwright locator
 * `.click()` (full trusted-like pointer event sequence) did. Always click through
 * `this.elements.clickLocator()` / a Playwright locator — never simulate the click via
 * `evaluate()`.
 *
 * Footer-collision avoidance: `<footer>` is intersection-observer-gated and absent
 * from the initial DOM until the viewport scrolls to the bottom (same as
 * EcommerceTrackOrderPage). `navigate()` deliberately does not scroll, so a
 * lazily-rendered footer "Help" duplicate, if one exists, is never in the DOM when
 * these locators resolve.
 */
export class EcommerceHelpSupportPage extends BasePage {
  /**
   * Header "Help" trigger — a `<figure>` with accessible name "Help", confirmed
   * present in the header icon bar (alongside "Track my order" and "Stores") on
   * Platypus AU and Skechers AU staging. `exact: true` avoids accidentally matching
   * "Help Centre" or similar longer labels on brands not yet verified live.
   */
  private readonly headerHelpTrigger = this.page.getByRole('figure', { name: 'Help', exact: true }).first();

  /**
   * Defensive fallback: some storefronts may expose "Help" directly as a link with no
   * flyout step. Tried by `isHelpSupportLinkPresent()`/`clickHelpSupportLink()` only
   * when `headerHelpTrigger` is not visible.
   */
  private readonly directHelpLink = this.page.getByRole('link', { name: /^help$/i }).first();

  /**
   * The flyout panel opened by `headerHelpTrigger`. Confirmed live (Platypus AU): a
   * new `role="complementary"` region appears after the click, containing the
   * destination links — same landmark pattern as the mini-cart overlay documented in
   * `tests/ecommerce/CLAUDE.md`. Other `complementary` regions (account menu, mini
   * cart) exist on the page but are empty until their own trigger is clicked, so
   * `.filter({ has: ... })` reliably isolates the opened Help panel rather than
   * matching an unrelated landmark.
   */
  private readonly helpFlyoutPanel = this.page
    .locator('aside, [role="complementary"]')
    .filter({ has: this.page.getByRole('link', { name: /^(help|faqs?|support)$/i }) })
    .first();

  /**
   * Destination link inside the opened flyout panel. Matches "Help", "FAQs", or
   * "Support" (case-insensitive, whole-name) — confirmed live that brands expose one
   * or more of these labels, all routing to the same external help-center
   * destination. `.first()` resolves to whichever label this brand renders. Scoped to
   * `helpFlyoutPanel` (rather than page-wide) so an unrelated same-named link
   * elsewhere in the DOM can never be clicked instead.
   */
  private readonly flyoutSupportLink = this.helpFlyoutPanel
    .getByRole('link', { name: /^(help|faqs?|support)$/i })
    .first();

  /**
   * URL pattern confirming the destination is a genuine help/support resource, not
   * just any different page. Confirmed live: both Platypus AU and Skechers AU route
   * to `https://help.{brand}.com.au/hc/en-us` (a Zendesk help center) — neither
   * exposes a semantic heading element on that destination (verified: zero `<h1-h3>`
   * on the Zendesk homepage template), so heading-visibility is not a usable signal
   * here. `.test()` against the URL is the reliable secondary content check instead.
   */
  private static readonly HELP_DESTINATION_URL_PATTERN = /help\.|\/hc\/|support/i;

  /**
   * Homepage URL captured on `navigate()` — used by `assertNavigatedToHelpSupportPage`
   * to detect a URL change as one of two independent navigation success signals.
   * The confirmed destination is an external domain, so a URL change is expected to be
   * the primary, reliable signal.
   */
  private homeUrl = '';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the storefront homepage and wait (best-effort) for the header Help
   * trigger (or a direct Help link, as a fallback) to become visible.
   *
   * `waitUntil: 'commit'` fires on the first byte of the HTTP response — too early
   * for the subsequent visibility check because document.body is null at that point.
   * `waitForPageLoadState('domcontentloaded')` waits for the HTML to be fully parsed
   * before the visibility wait begins (same pattern as EcommerceTrackOrderPage).
   * No scroll is performed — the Help trigger is expected in the header, not the
   * lazily-rendered footer.
   */
  async navigate(baseUrl: string): Promise<void> {
    await this.page.goto(baseUrl, { waitUntil: 'commit' });
    await this.waits.waitForPageLoadState('domcontentloaded');
    this.homeUrl = this.page.url();
    await this.headerHelpTrigger
      .or(this.directHelpLink)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
      .catch(() => {});
  }

  /**
   * Returns true if either the header Help trigger or a direct Help link is visible.
   * Call after `navigate()`. Returns false when neither is configured (or detectable)
   * on this staging storefront — the spec should call `test.skip` in this case.
   */
  async isHelpSupportLinkPresent(): Promise<boolean> {
    const [triggerVisible, directVisible] = await Promise.all([
      this.elements.isLocatorVisible(this.headerHelpTrigger),
      this.elements.isLocatorVisible(this.directHelpLink),
    ]);
    return triggerVisible || directVisible;
  }

  /**
   * Opens the Help/Support destination. If the header trigger is present, clicks it
   * to open the flyout, then clicks the matching link inside it. Falls back to
   * clicking a direct Help link if the trigger is not present. Waits (best-effort)
   * for the destination page to finish navigating — `assertNavigatedToHelpSupportPage`
   * is the authoritative failure gate, not this wait.
   */
  async clickHelpSupportLink(): Promise<void> {
    if (await this.elements.isLocatorVisible(this.headerHelpTrigger)) {
      await this.elements.clickLocator(this.headerHelpTrigger);
      await this.flyoutSupportLink.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE }).catch(() => {});
      await this.elements.clickLocator(this.flyoutSupportLink);
    } else {
      await this.elements.clickLocator(this.directHelpLink);
    }
    await this.waits.waitForPageLoadState('domcontentloaded').catch(() => {});
  }

  /**
   * Returns true if the current URL matches the confirmed help/support destination
   * pattern (see `HELP_DESTINATION_URL_PATTERN`). Exposed so the spec can soft-assert
   * it without inlining the pattern in the spec file.
   */
  isOnHelpDestination(): boolean {
    return EcommerceHelpSupportPage.HELP_DESTINATION_URL_PATTERN.test(this.page.url());
  }

  /**
   * Returns true if navigation away from the homepage succeeded — the URL changed
   * from the captured homepage URL. The confirmed destination on every storefront
   * checked live is an external domain, so a URL change is an unfakeable signal.
   */
  private hasNavigatedToHelpSupportPage(): boolean {
    return this.page.url() !== this.homeUrl;
  }

  /**
   * Hard assertion: navigation to the Help/Support page must have succeeded (URL
   * changed from homepage). Fails with a descriptive message that includes the site
   * name to aid debugging across the 8-storefront matrix.
   */
  async assertNavigatedToHelpSupportPage(siteName: string): Promise<void> {
    expect(
      this.hasNavigatedToHelpSupportPage(),
      `Expected navigation away from the homepage after clicking the Help/Support link on ${siteName}`,
    ).toBe(true);
  }
}
