import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceNavPage extends BasePage {
  private readonly mainContainerSelector = 'main';
  private readonly logoLinkSelector = 'main a[href="/"]';
  // Hydration probe: nav links live inside <main> on these SPA storefronts (no <header>/<nav>).
  private readonly navLinksHydrationSelector = 'main ul li a[href]';
  private readonly acquisitionPopupSelector = '[class*="bloomreach-acquisition-popup"][class*="state-open"]';

  constructor(page: Page) {
    super(page);
  }

  async navigate(url: string): Promise<void> {
    // SPA analytics scripts delay 'load'/'domcontentloaded' — same commit strategy as EcommerceHomePage
    await this.gotoWithOptions(url, { waitUntil: 'commit' });
    await this.waits.waitForElement(this.mainContainerSelector, TIMEOUTS.ELEMENT_VISIBLE);
  }

  // Polls until React SPA hydration populates nav links in <main> (no <header>/<nav> exists).
  async waitForNavHydration(): Promise<void> {
    const selector = this.navLinksHydrationSelector;
    await this.waits.waitForCustomCondition(
      async () => {
        try {
          return await this.page.evaluate(
            (sel) => document.querySelectorAll(sel).length > 0,
            selector,
          );
        } catch {
          return false;
        }
      },
      { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST }
    );
  }

  async isNavLinkVisible(label: string): Promise<boolean> {
    return this.elements.isLocatorVisible(this.navLink(label));
  }

  async getNavLinkHref(label: string): Promise<string | null> {
    return this.elements.getLocatorAttribute(this.navLink(label), 'href');
  }

  async clickNavLink(label: string): Promise<void> {
    await this.dismissBloomreachPopup();

    // On Magento PWA Studio SPAs, top-level nav links are also megamenu triggers.
    // Playwright's synthetic click fires the browser event but React's delegated
    // router handler can be outpaced by async hydration or staging load lag —
    // the megamenu opens while the SPA router stays on the homepage.
    // Guard: if the link carries a real PLP href, navigate directly via goto()
    // (same strategy as swatch navigation — gotcha #4 in ecommerce-pdp-page-gotchas).
    // Fallback: click for links with no href or anchor-only hrefs (e.g. dropdown triggers).
    const href = await this.getNavLinkHref(label);
    if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:')) {
      const current = new URL(this.page.url());
      const target = new URL(href, current);
      if (target.origin === current.origin) {
        await this.gotoWithOptions(target.href, { waitUntil: 'commit' });
        return;
      }
    }
    await this.elements.clickLocator(this.navLink(label));
  }

  private async dismissBloomreachPopup(): Promise<void> {
    try {
      const popup = this.elements.locator(this.acquisitionPopupSelector);
      if ((await popup.count()) === 0) return;
      const closeBtn = popup.getByRole('button').first();
      if (await closeBtn.isVisible({ timeout: TIMEOUTS.ELEMENT_CLICKABLE }).catch(() => false)) {
        await closeBtn.click({ force: true });
      } else {
        await this.page.keyboard.press('Escape');
      }
      await this.waits
        .waitForCustomCondition(async () => (await popup.count()) === 0, {
          timeout: TIMEOUTS.DIALOG_DISMISS,
          interval: TIMEOUTS.POLL_INTERVAL_FAST,
        })
        .catch(() => {});
    } catch {
      // best-effort dismissal
    }
  }

  async waitForUrlContaining(pattern: RegExp): Promise<void> {
    await this.waits.waitForUrlMatches(pattern, TIMEOUTS.PAGE_LOAD_SLOW);
  }

  async clickLogo(): Promise<void> {
    await this.elements.clickLocator(this.logoLink());
  }

  async waitForHomepage(siteUrl: string): Promise<void> {
    const escaped = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '');
    await this.waits.waitForUrlMatches(new RegExp(`^${escaped}\\/?$`), TIMEOUTS.PAGE_LOAD_SLOW);
  }

  // Scoped to <main> to avoid footer link collisions; label regex-escaped for special chars (e.g. "Dr.").
  private navLink(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.elements
      .locator(this.mainContainerSelector)
      .getByRole('link', { name: new RegExp(`^${escaped}$`, 'i') })
      .first();
  }

  // Logo is an <a href="/"> inside <main> across all 8 SPA storefronts (no <header>/<nav> element).
  private logoLink(): Locator {
    return this.elements.locator(this.logoLinkSelector).first();
  }
}
