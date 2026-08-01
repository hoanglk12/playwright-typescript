import { type Locator, type Page } from '@playwright/test';
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
  private readonly closeButtonPattern = /close/i;

  // Product card anchor wrapping the image — used for PDP navigation (E2E-PLP-012)
  private readonly productCardLinkSelector = '[data-product-id] a';

  // Broad PDP URL pattern covering all 8 storefronts (Magento uses .html extension for PDPs; other sites use /product/, /p/, /pdp/)
  private readonly PDP_URL_PATTERN = /(\/product\/|\/p\/|\/pdp\/|\.html)/i;

  // Price pattern scoped to $X.XX format (decimals required) — used for LOC-001 currency assertion.
  // Matches AUD/NZD price leaf nodes that carry the two-decimal cent portion.
  private readonly priceTextPattern = '^\\$[\\d,]+\\.\\d{2}$';

  constructor(page: Page) {
    super(page);
  }

  private async waitUntilVisible(locator: Locator): Promise<boolean> {
    return locator
      .waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_CLICKABLE })
      .then(() => true)
      .catch(() => false);
  }

  private async waitUntilDismissed(isGone: () => Promise<boolean>): Promise<void> {
    await this.waits
      .waitForCustomCondition(isGone, {
        timeout: TIMEOUTS.DIALOG_DISMISS,
        interval: TIMEOUTS.POLL_INTERVAL_FAST,
      })
      .catch(() => {});
  }

  private async dismissOverlays(): Promise<void> {
    try {
      // Bloomreach acquisition popup has a <div> container (not <dialog>) — target it directly
      const bloomreachPopup = this.elements.locator(this.acquisitionPopupSelector);
      if ((await bloomreachPopup.count()) > 0) {
        const bloomreachCloseBtn = bloomreachPopup.getByRole('button').first();
        if (await this.waitUntilVisible(bloomreachCloseBtn)) {
          await bloomreachCloseBtn.click({ force: true });
        } else {
          await this.page.keyboard.press('Escape');
        }
        await this.waitUntilDismissed(async () => (await bloomreachPopup.count()) === 0);
        return;
      }

      // Generic overlay fallback (non-Bloomreach modals)
      const overlay = this.elements.locator(this.overlaySelector).first();
      if (!(await this.waitUntilVisible(overlay))) return;

      const closeBtn = this.page
        .getByRole('dialog')
        .first()
        .getByRole('button', { name: this.closeButtonPattern });
      if (await this.waitUntilVisible(closeBtn)) {
        await closeBtn.click();
        await this.waitUntilDismissed(async () => !(await overlay.isVisible().catch(() => true)));
        return;
      }

      await this.page.keyboard.press('Escape');
      await this.waitUntilDismissed(async () => !(await overlay.isVisible().catch(() => false)));
    } catch {
      // Overlay dismissal is best-effort — proceed with Quick Add regardless
    }
  }

  /**
   * Clicks the first of up to 6 candidates starting at `index` that is the topmost element at
   * its own centre point, i.e. not covered by anything. Returns false when every candidate is
   * obstructed, leaving the caller to apply its own fallback.
   */
  private async clickFirstUnobstructed(candidates: Locator, index: number): Promise<boolean> {
    const count = await candidates.count();

    for (let i = index; i < Math.min(count, index + 6); i++) {
      const candidate = candidates.nth(i);
      await candidate.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const isTopmost = await candidate.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      });
      if (isTopmost) {
        await candidate.click();
        return true;
      }
    }
    return false;
  }

  async waitForPlpUrl(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PLP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
  }

  async waitForProductGrid(): Promise<void> {
    await this.waits.waitForCustomCondition(
      async () => (await this.dom.count(this.productCardSelector)) > 0,
      { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST }
    );
  }

  async clickProductCard(index: number): Promise<void> {
    await this.dismissOverlays();

    // Sticky header can cover the first card's midpoint
    const cards = this.elements.locator(this.productCardLinkSelector);
    if (await this.clickFirstUnobstructed(cards, index)) return;

    // All candidates obstructed (e.g. sticky nav dropdown left open after nav-link click) — JS
    // synthetic click fires navigation on the anchor regardless of covering elements
    await cards.nth(index).evaluate((el: HTMLElement) => el.click());
  }

  async waitForPdpUrl(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PDP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
  }

  async getProductCount(): Promise<number> {
    return this.dom.count(this.productCardSelector);
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

  private async waitForCountBelow(initialCount: number): Promise<void> {
    await this.waits.waitForCustomCondition(
      async () => {
        const currentCount = await this.getTotalProductCount();
        return currentCount > 0 && currentCount < initialCount;
      },
      { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST },
    );
  }

  async waitForCategoryFilterApplied(
    filterLabel: string,
    initialCount: number,
  ): Promise<void> {
    await this.waitForCountBelow(initialCount);
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
    await this.waitForCountBelow(initialCount);
  }

  async quickAdd(index = 0): Promise<void> {
    await this.dismissOverlays();

    // Some storefronts inject a newsletter form at the same page-Y as the first row's
    // Quick Add buttons. The form renders on top and blocks the click.
    const btns = this.elements.locator(this.quickAddBtnSelector);
    if (await this.clickFirstUnobstructed(btns, index)) return;

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

  /**
   * Returns the first visible price text in `$X.XX` format found within product cards.
   * Scoped to `[data-product-id]` elements to avoid matching non-product prices
   * (e.g. free-shipping banners). Returns an empty string if no matching price is found.
   * Used by E2E-LOC-001 to assert AUD price format on PLP product grids.
   */
  async getPriceText(): Promise<string> {
    let result = '';
    await this.waits
      .waitForCustomCondition(
        async () => {
          result = await this.page.evaluate(
            ({ cardSel, pat }: { cardSel: string; pat: string }) => {
              const re = new RegExp(pat);
              for (const card of document.querySelectorAll(cardSel)) {
                for (const el of card.querySelectorAll('*')) {
                  if (el.children.length > 0) continue;
                  const text = el.textContent?.trim() ?? '';
                  if (!re.test(text)) continue;
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) return text;
                }
              }
              return '';
            },
            { cardSel: this.productCardSelector, pat: this.priceTextPattern },
          );
          return result.length > 0;
        },
        { timeout: TIMEOUTS.ELEMENT_VISIBLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return result;
  }
}
