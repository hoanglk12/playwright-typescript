import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommercePLPPage extends BasePage {
  // Broad pattern — covers all 8 storefront URL structures after nav-link click
  private readonly PLP_URL_PATTERN =
    /(\/women|\/mens|\/men\/|\/kids|\/sale|\/outlet|\/shop\/|\/presale|\/all|black-friday)/i;
  private readonly productCardSelector = '[data-product-id]';

  constructor(page: Page) {
    super(page);
  }

  async waitForPlpUrl(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PLP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
  }

  async waitForProductGrid(): Promise<void> {
    const selector = this.productCardSelector;
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

  async getProductCount(): Promise<number> {
    return this.page.evaluate(
      (selector) => document.querySelectorAll(selector).length,
      this.productCardSelector,
    );
  }

  async applyCategoryFilter(filterLabel: string): Promise<void> {
    const checkbox = this.page
      .getByRole('checkbox', { name: new RegExp(filterLabel, 'i') })
      .first();
    await checkbox.evaluate((el: HTMLInputElement) => el.click());
  }

  async getTotalProductCount(): Promise<number> {
    return this.page.evaluate(() => {
      for (const p of document.querySelectorAll('p')) {
        const m = p.textContent?.trim().match(/^(\d+)\s+Products$/i);
        if (m) return parseInt(m[1], 10);
      }
      return 0;
    });
  }

  async waitForCategoryFilterApplied(
    filterLabel: string,
    initialCount: number,
  ): Promise<void> {
    await this.waits.waitForCustomCondition(
      async () => {
        try {
          const currentCount = await this.getTotalProductCount();
          return currentCount > 0 && currentCount < initialCount;
        } catch {
          return false;
        }
      },
      {
        timeout: TIMEOUTS.PAGE_LOAD_SLOW,
        interval: TIMEOUTS.POLL_INTERVAL_FAST,
      },
    );
  }
}
