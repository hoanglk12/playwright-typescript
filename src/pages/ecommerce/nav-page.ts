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

  // React SPA hydration completes asynchronously after <main> becomes visible.
  // Without this gate, link assertions fail on slow-network CI before the nav DOM is populated.
  // These SPAs render nav links as main > div > ul > li > a (no <header> or <nav> element).
  async waitForNavHydration(): Promise<void> {
    await this.waitForCustomCondition(
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
    return this.navLink(label).isVisible();
  }

  async getNavLinkHref(label: string): Promise<string | null> {
    return this.navLink(label).getAttribute('href');
  }

  // Scoped to <main> to exclude footer anchors sharing the same label text.
  // These SPAs use no <header> element — nav links live in main > div > ul > li > a.
  // Declared as a factory (not a class field) because the name is dynamic per invocation.
  // Regex-escaped so labels with special characters (e.g. "Dr.") match literally.
  private navLink(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page
      .locator('main')
      .getByRole('link', { name: new RegExp(`^${escaped}$`, 'i') })
      .first();
  }
}
