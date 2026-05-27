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
  private readonly acquisitionPopupSelector = '[class*="bloomreach-acquisition-popup"][class*="state-open"]';

  // Product card anchor wrapping the image — used for PDP navigation (E2E-PLP-012)
  private readonly productCardLinkSelector = '[data-product-id] a';

  // Broad PDP URL pattern covering all 8 storefronts (Magento uses .html extension for PDPs; other sites use /product/, /p/, /pdp/)
  private readonly PDP_URL_PATTERN = /(\/product\/|\/p\/|\/pdp\/|\.html)/i;

  constructor(page: Page) {
    super(page);
  }

  private async dismissOverlays(): Promise<void> {
    try {
      // Bloomreach acquisition popup has a <div> container (not <dialog>) — target it directly
      const bloomreachPopup = this.page.locator(this.acquisitionPopupSelector);
      if ((await bloomreachPopup.count()) > 0) {
        const closeBtn = bloomreachPopup.getByRole('button').first();
        if (await closeBtn.isVisible({ timeout: TIMEOUTS.ELEMENT_CLICKABLE }).catch(() => false)) {
          await closeBtn.click({ force: true });
        } else {
          await this.page.keyboard.press('Escape');
        }
        await this.waits
          .waitForCustomCondition(async () => (await bloomreachPopup.count()) === 0, {
            timeout: TIMEOUTS.DIALOG_DISMISS,
            interval: TIMEOUTS.POLL_INTERVAL_FAST,
          })
          .catch(() => {});
        return;
      }

      // Generic overlay fallback (non-Bloomreach modals)
      const overlay = this.page.locator(this.overlaySelector).first();
      if (!(await overlay.isVisible({ timeout: TIMEOUTS.ELEMENT_CLICKABLE }).catch(() => false))) return;

      const dialog = this.page.getByRole('dialog').first();
      const closeBtn = dialog.getByRole('button', { name: /close/i });
      if (await closeBtn.isVisible({ timeout: TIMEOUTS.ELEMENT_CLICKABLE }).catch(() => false)) {
        await closeBtn.click();
        await this.waits
          .waitForCustomCondition(
            async () => !(await overlay.isVisible().catch(() => true)),
            { timeout: TIMEOUTS.DIALOG_DISMISS, interval: TIMEOUTS.POLL_INTERVAL_FAST },
          )
          .catch(() => {});
        return;
      }

      await this.page.keyboard.press('Escape');
      await this.waits
        .waitForCustomCondition(async () => !(await overlay.isVisible({ timeout: 200 }).catch(() => true)), {
          timeout: TIMEOUTS.DIALOG_DISMISS,
          interval: TIMEOUTS.POLL_INTERVAL_FAST,
        })
        .catch(() => {});
    } catch {
      // Overlay dismissal is best-effort — proceed with Quick Add regardless
    }
  }

  async waitForPlpUrl(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PLP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
  }

  async waitForProductGrid(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => {});
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

  async clickProductCard(index: number): Promise<void> {
    await this.dismissOverlays();

    // Scan up to 6 candidates from `index` — sticky header can cover the first card's midpoint
    const cards = this.page.locator(this.productCardLinkSelector);
    const count = await cards.count();

    for (let i = index; i < Math.min(count, index + 6); i++) {
      const card = cards.nth(i);
      await card.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const isTopmost = await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      });
      if (isTopmost) {
        await card.click();
        return;
      }
    }
    // All candidates obstructed (e.g. sticky nav dropdown left open after nav-link click) — JS
    // synthetic click fires navigation on the anchor regardless of covering elements
    await cards.nth(index).evaluate((el: HTMLElement) => el.click());
  }

  async waitForPdpUrl(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PDP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
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
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => {});
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
