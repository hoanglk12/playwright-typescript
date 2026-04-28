import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceSearchPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToHome(siteUrl: string): Promise<void> {
    await this.gotoWithOptions(siteUrl, { waitUntil: 'commit' });
    await this.waits.waitForElement('main', TIMEOUTS.ELEMENT_VISIBLE);
  }

  async search(term: string): Promise<void> {
    await this.waits.waitForElement('input[type="text"]', TIMEOUTS.ELEMENT_VISIBLE);
    await this.elements.enterText('input[type="text"]', term);
    await this.elements.pressKey('Enter');
    await this.waits.waitForUrlMatches(/search/i, TIMEOUTS.PAGE_LOAD_SLOW);
    await this.waits.waitForElement('main', TIMEOUTS.ELEMENT_VISIBLE);
  }

  async waitForSearchResults(): Promise<void> {
    await this.waits.waitForCustomCondition(
      async () => {
        try {
          return await this.executeScript(() => {
            return document.querySelectorAll('[data-product-id]').length > 0;
          });
        } catch {
          return false;
        }
      },
      { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST }
    );
  }

  async getResultCount(): Promise<number> {
    return this.executeScript(() => {
      return document.querySelectorAll('[data-product-id]').length;
    });
  }
}
