import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommercePLPPage extends BasePage {
  // Broad pattern — covers all 8 storefront URL structures after nav-link click
  private readonly PLP_URL_PATTERN =
    /(\/women|\/mens|\/men\/|\/kids|\/sale|\/outlet|\/shop\/|\/presale|\/all|black-friday)/i;
  private readonly productCardSelector = '[data-product-id]';

  // Quick Add button — class "quick-add-button" is on the button itself (not a parent)
  private readonly quickAddBtnSelector = '[data-product-id] button[class*="quick-add"]';

  // After Quick Add click, an inline size panel expands on the card with size buttons
  // that carry the semantic "available" class (indicating the size is in stock)
  private readonly sizeSelectorSelector = 'button.available';

  // Bloomreach acquisition popup — blocks pointer events on Vans AU / other storefronts
  private readonly overlaySelector = '.overlay.visible';

  constructor(page: Page) {
    super(page);
  }

  private async dismissOverlays(): Promise<void> {
    try {
      const overlay = this.page.locator(this.overlaySelector).first();
      if (!(await overlay.isVisible({ timeout: 800 }).catch(() => false))) return;

      const dialog = this.page.getByRole('dialog').first();
      const closeBtn = dialog.getByRole('button', { name: /close/i });
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click();
        await this.waits.sleep(600);
        return;
      }

      await this.page.keyboard.press('Escape');
      await this.waits.sleep(600);
    } catch {
      // Overlay dismissal is best-effort — proceed with Quick Add regardless
    }
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

  async applySizeFilter(sizeLabel: string): Promise<void> {
    const checkbox = this.page
      .getByRole('checkbox', { name: sizeLabel, exact: true })
      .first();
    await checkbox.evaluate((el: HTMLInputElement) => el.click());
  }

  async waitForSizeFilterApplied(
    sizeLabel: string,
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
      { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST },
    );
  }

  async quickAdd(index = 0): Promise<void> {
    await this.dismissOverlays();

    // Some storefronts inject a newsletter form at the same page-Y as the first row's
    // Quick Add buttons. The form renders on top and blocks the click. We scan up to
    // 6 candidates starting at `index`, picking the first one that is the topmost
    // element at its own center (i.e. not covered by another element).
    const btns = this.page.locator(this.quickAddBtnSelector);
    const count = await btns.count();

    for (let i = index; i < Math.min(count, index + 6); i++) {
      const btn = btns.nth(i);
      await btn.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const isTopmost = await btn.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      });
      if (isTopmost) {
        await btn.click();
        return;
      }
    }
    // All candidates were obstructed — fall back to clicking the requested index
    await btns.nth(index).click();
  }

  async isSizeSelectorVisible(): Promise<boolean> {
    try {
      await this.waits.waitForElement(this.sizeSelectorSelector, TIMEOUTS.ELEMENT_VISIBLE);
      return true;
    } catch {
      return false;
    }
  }
}
