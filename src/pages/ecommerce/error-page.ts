import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

/**
 * EcommerceErrorPage — page object for client-side 404 error pages on Magento PWA Studio
 * storefronts.
 *
 * These storefronts return HTTP 200 for unknown URLs (soft-404) and render the error UI
 * client-side via React. Assertions must check rendered DOM content — never response status.
 *
 * Styled-components generates hashed class names on these storefronts, so only semantic
 * locators (getByRole) are used here.
 */
export class EcommerceErrorPage extends BasePage {
  /**
   * "Back to Home" CTA — rendered as a <button> (not <a>) across all 8 GRA storefronts.
   * Confirmed via live DOM inspection on staging: Platypus AU/NZ, Skechers AU/NZ,
   * Vans AU/NZ, Dr. Martens AU/NZ all render a <button> element with this text.
   * A case-insensitive regex covers all observed label variants:
   *   Platypus    → "Back to Home"
   *   Skechers    → "Back to Home"
   *   Vans        → "Back to Home"
   *   Dr. Martens → "Back to Home"
   * `.first()` prevents strict-mode violations when multiple matches exist on the page.
   */
  private readonly backToHomeBtn = this.page
    .getByRole('button', { name: /back to home|continue shopping|keep shopping|go to home|homepage/i })
    .first();

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigates to a deliberately invalid URL to trigger the client-side 404 error UI.
   *
   * Uses `waitUntil: 'commit'` — the same rationale as EcommerceHomePage.navigate():
   * these SPAs have dozens of analytics/tracking scripts that delay 'load' and
   * 'domcontentloaded' events by minutes. 'commit' fires as soon as the server
   * starts sending the document, which is sufficient for SPA bootstrap.
   *
   * The subsequent `waitFor` is best-effort (`.catch(() => {})`). If the SPA has not
   * hydrated the 404 UI within PAGE_LOAD, `assertBackToHomeVisible` is the authoritative
   * failure gate — it carries its own PAGE_LOAD_SLOW timeout.
   */
  async navigateToNotFound(baseUrl: string): Promise<void> {
    await this.page.goto(new URL('this-page-does-not-exist-404', baseUrl).toString(), { waitUntil: 'commit' });
    await this.backToHomeBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD }).catch(() => {});
  }

  /**
   * Asserts that a "Back to Home"-style button is visible on the rendered 404 error page.
   * Carries an explicit PAGE_LOAD_SLOW timeout because the best-effort wait in
   * `navigateToNotFound` may have timed out on slow SPA hydration.
   */
  async assertBackToHomeVisible(): Promise<void> {
    await expect(this.backToHomeBtn).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD_SLOW });
  }

  /**
   * Asserts the brand name appears somewhere in the rendered 404 error page.
   *
   * Mirrors EcommerceHomePage.assertBrandNameVisible exactly:
   *   1. Normalise to alphanumeric-only so "Dr. Martens" matches "drmartens" / "Dr Martens".
   *   2. Check document.title first — reliable even when the brand appears only as an
   *      <img alt="..."> logo (textContent excludes alt attribute values).
   *   3. Fall back to document.body.textContent for brands expressed in body copy.
   *
   * Uses expect.poll() to tolerate SPA hydration latency on staging environments.
   *
   * Note: Vans AU/NZ and Dr. Martens AU/NZ 404 brand UI is TBD — these storefronts
   * may render a generic error page without the brand name. Flag these for the healer
   * if they fail on staging.
   */
  async assertBrandErrorUiVisible(brandName: string, siteName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          try {
            return await this.page.evaluate((name) => {
              const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
              const target = norm(name);
              if (norm(document.title).includes(target)) return true;
              const bodyText = norm(document.body.textContent ?? '');
              return bodyText.includes(target);
            }, brandName);
          } catch {
            return null;
          }
        },
        {
          message: `Expected brand name "${brandName}" to appear in page title or body on 404 error page for ${siteName}`,
          timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          intervals: [500, 1000, 2000],
        },
      )
      .toBe(true);
  }
}
