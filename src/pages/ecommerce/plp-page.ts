import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommercePLPPage extends BasePage {
  // Broad pattern — covers all 8 storefront URL structures after nav-link click
  private readonly PLP_URL_PATTERN =
    /(\/women|\/mens|\/men\/|\/kids|\/sale|\/outlet|\/shop\/|\/presale|\/all|black-friday)/i;

  constructor(page: Page) {
    super(page);
  }

  async waitForPlpUrl(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PLP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
  }

  async waitForProductGrid(): Promise<void> {
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

  async getProductCount(): Promise<number> {
    return this.executeScript(() => {
      return document.querySelectorAll('[data-product-id]').length;
    });
  }
}
