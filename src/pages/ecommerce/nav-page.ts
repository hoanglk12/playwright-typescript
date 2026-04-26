import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceNavPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(url: string): Promise<void> {
    // SPA analytics scripts delay 'load'/'domcontentloaded' — same commit strategy as EcommerceHomePage
    await this.gotoWithOptions(url, { waitUntil: 'commit' });
    await this.waits.waitForElement('main', TIMEOUTS.ELEMENT_VISIBLE);
  }

  // Polls until React SPA hydration populates nav links in <main> (no <header>/<nav> exists).
  async waitForNavHydration(): Promise<void> {
    await this.waits.waitForCustomCondition(
      async () => {
        try {
          return await this.executeScript(() => {
            return document.querySelectorAll('main ul li a[href]').length > 0;
          });
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
    await this.elements.clickLocator(this.navLink(label));
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
      .locator('main')
      .getByRole('link', { name: new RegExp(`^${escaped}$`, 'i') })
      .first();
  }

  // Logo is an <a href="/"> inside <main> across all 8 SPA storefronts (no <header>/<nav> element).
  private logoLink(): Locator {
    return this.elements.locator('main a[href="/"]').first();
  }
}
