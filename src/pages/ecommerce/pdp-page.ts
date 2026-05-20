import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommercePDPPage extends BasePage {
  private readonly productNameHeading = this.page.getByRole('heading', { level: 1 }).first();
  // Storefronts use styled-components with hashed class names — CSS class selectors are
  // unreliable across builds. Match by price text pattern ($X.XX or $X,XXX.XX) on leaf nodes.
  private readonly priceTextPattern = '^\\$[\\d,]+(\\.[\\d]{2})?$';
  private readonly galleryImageSelector =
    '[class*="gallery"] img, .product-gallery img, .swiper-slide img, img[class*="product"], img[alt*="product"]';
  private readonly PDP_URL_PATTERN = /(\/product\/|\/p\/|\/pdp\/|\.html)/i;
  // Colour swatches: .swiper-slide <a> links inside the container that owns the colorScroller controls.
  // :has() targets the swiper-container that directly contains a colorScroller-next button.
  private readonly colorScrollerContainerSelector =
    '[class*="swiper-container"]:has([class*="colorScroller-next"])';
  private readonly acquisitionPopupSelector = '[class*="bloomreach-acquisition-popup"][class*="state-open"]';
  private readonly sizePatternSource = '^(US\\s+|UK\\s+|EU\\s+)?\\d+(\\.\\d+)?$';
  private readonly genderPatternSource =
    '\\b(mens?|womens?|male|female|us\\s+mens?|us\\s+womens?|uk\\s+mens?|uk\\s+womens?)\\b';

  constructor(page: Page) {
    super(page);
  }

  async waitForPdpLoad(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PDP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
    await this.productNameHeading.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
  }

  async getProductName(): Promise<string> {
    return (await this.productNameHeading.textContent())?.trim() ?? '';
  }

  async getPrice(): Promise<string> {
    const pattern = this.priceTextPattern;
    let result = '';
    await this.waits.waitForCustomCondition(
      async () => {
        result = await this.page.evaluate((pat) => {
          const re = new RegExp(pat);
          const all = Array.from(document.querySelectorAll('*'));
          for (const el of all) {
            const text = el.textContent?.trim() ?? '';
            if ((el as Element).children.length === 0 && re.test(text)) return text;
          }
          return '';
        }, pattern);
        return result.length > 0;
      },
      { timeout: TIMEOUTS.ELEMENT_VISIBLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
    ).catch(() => {});
    return result;
  }

  async isImageGalleryVisible(): Promise<boolean> {
    const selector = this.galleryImageSelector;
    return this.page.evaluate((sel) => {
      const imgs = Array.from(document.querySelectorAll(sel));
      return imgs.some((img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, selector);
  }

  async getColourSwatchCount(): Promise<number> {
    return this.page
      .locator(this.colorScrollerContainerSelector)
      .locator('.swiper-slide')
      .count();
  }

  private async dismissAcquisitionPopup(): Promise<void> {
    try {
      const popup = this.page.locator(this.acquisitionPopupSelector);
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

  async clickColourSwatch(index: number): Promise<void> {
    await this.dismissAcquisitionPopup();
    const currentUrl = this.page.url();
    const slides = this.page
      .locator(this.colorScrollerContainerSelector)
      .locator('.swiper-slide');
    const count = await slides.count();
    let alternativeIndex = 0;
    for (let i = 0; i < count; i++) {
      const slide = slides.nth(i);
      const href = await slide.locator('a').getAttribute('href');
      const absolute = href ? new URL(href, currentUrl).toString() : '';
      if (absolute !== currentUrl) {
        if (alternativeIndex === index) {
          await this.page.goto(absolute, {
            waitUntil: 'domcontentloaded',
            timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          });
          return;
        }
        alternativeIndex++;
      }
    }
    throw new Error(`clickColourSwatch: no alternative swatch found at index ${index}`);
  }

  async waitForVariantNavigation(previousUrl: string): Promise<void> {
    await this.page.waitForURL((url) => url.toString() !== previousUrl, {
      timeout: TIMEOUTS.PAGE_LOAD_SLOW,
    });
    await this.waitForPdpLoad();
    const selector = this.galleryImageSelector;
    await this.page
      .waitForFunction(
        (sel) => {
          const imgs = Array.from(document.querySelectorAll(sel));
          return imgs.some((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
        },
        selector,
        { timeout: TIMEOUTS.ELEMENT_VISIBLE },
      )
      .catch(() => {
        // best-effort — gallery selector may not match all storefront DOM structures;
        // the explicit isImageGalleryVisible() soft assertion in the spec reports the real state
      });
  }

  async getFirstGalleryImageSrc(): Promise<string> {
    const selector = this.galleryImageSelector;
    return this.page.evaluate((sel) => {
      const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
      const visible = imgs.find((img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return visible?.src ?? '';
    }, selector);
  }

  async waitForGalleryImageChange(previousSrc: string): Promise<void> {
    if (!previousSrc) return;
    const selector = this.galleryImageSelector;
    await this.page.waitForFunction(
      ({ sel, prev }) => {
        const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
        const visible = imgs.find((img) => {
          const r = img.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return visible?.src !== undefined && visible.src !== prev;
      },
      { sel: selector, prev: previousSrc },
      { timeout: TIMEOUTS.ELEMENT_VISIBLE },
    );
  }

  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: TIMEOUTS.PAGE_LOAD_SLOW });
  }

  async ensureNoOverlay(): Promise<void> {
    await this.dismissAcquisitionPopup();
  }

  async isSizeSelectorVisible(): Promise<boolean> {
    return this.page.evaluate((sizePatSrc) => {
      // Storefronts use styled-components — class names are hashed and don't contain "size".
      // Detect the size selector by checking for visible buttons with numeric size labels,
      // or as a fallback, a visible leaf node containing the word "SIZE".
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasSizeButtons = buttons.some((btn) => {
        const text = btn.textContent?.trim() ?? '';
        if (!sizePattern.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (hasSizeButtons) return true;
      const allLeaves = Array.from(document.querySelectorAll('*'));
      return allLeaves.some((el) => {
        if ((el as Element).children.length > 0) return false;
        const text = el.textContent?.trim() ?? '';
        if (!/\bSIZE\b/i.test(text)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, this.sizePatternSource);
  }

  async getSizeGenderToggleLabels(): Promise<string[]> {
    return this.page.evaluate(({ sizePatSrc, genderPatSrc }) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const genderPattern = new RegExp(genderPatSrc, 'i');

      // Anchor search to the size section: find a visible size-like button, then
      // walk up the DOM to find a common ancestor that also contains gender toggles.
      // This prevents matching header nav links named "WOMENS"/"MENS" which would
      // navigate away from the PDP when clicked.
      const allButtons = Array.from(document.querySelectorAll('button'));
      const sizeButtons = allButtons.filter((btn) => {
        const text = btn.textContent?.trim() ?? '';
        if (!sizePattern.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (sizeButtons.length === 0) return [];

      let container: Element | null = sizeButtons[0].parentElement;
      while (container && container !== document.body) {
        const genderBtns = Array.from(container.querySelectorAll('button')).filter((btn) => {
          const text = btn.textContent?.trim() ?? '';
          if (!text || !genderPattern.test(text) || sizePattern.test(text)) return false;
          const r = btn.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (genderBtns.length > 0) {
          return [...new Set(genderBtns.map((btn) => btn.textContent?.trim() ?? ''))];
        }
        container = container.parentElement;
      }
      return [];
    }, { sizePatSrc: this.sizePatternSource, genderPatSrc: this.genderPatternSource });
  }

  async clickSizeGenderToggle(label: string): Promise<void> {
    await this.dismissAcquisitionPopup();
    // DOM-proximity click: locate target button within the same ancestor that contains
    // size buttons. Avoids clicking header nav elements also named "WOMENS"/"MENS".
    const clicked = await this.page.evaluate(
      ({ lbl, sizePatSrc }) => {
        const sizePattern = new RegExp(sizePatSrc, 'i');
        const targetPattern = new RegExp(
          `\\b${lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        );
        const allButtons = Array.from(document.querySelectorAll('button'));
        const sizeButtons = allButtons.filter((btn) => {
          const text = btn.textContent?.trim() ?? '';
          if (!sizePattern.test(text)) return false;
          const r = btn.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (sizeButtons.length === 0) return false;
        let container: Element | null = sizeButtons[0].parentElement;
        while (container && container !== document.body) {
          const match = Array.from(container.querySelectorAll('button')).find((btn) => {
            const text = btn.textContent?.trim() ?? '';
            if (!targetPattern.test(text)) return false;
            const r = btn.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (match) {
            (match as HTMLButtonElement).click();
            return true;
          }
          container = container.parentElement;
        }
        return false;
      },
      { lbl: label, sizePatSrc: this.sizePatternSource },
    );
    if (!clicked) {
      throw new Error(`clickSizeGenderToggle: button "${label}" not found near size selector`);
    }
    // Poll for the size grid to update after toggle; best-effort — some storefronts only
    // render sizes after colour selection, so a timeout here is expected and acceptable.
    await this.waits
      .waitForCustomCondition(
        async () => (await this.getVisibleSizeLabels()).length > 0,
        { timeout: TIMEOUTS.ELEMENT_CLICKABLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
  }

  async getAvailableSizes(): Promise<string[]> {
    return this.page.evaluate((sizePatSrc) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const results: string[] = [];
      for (const btn of buttons) {
        const btnEl = btn as HTMLButtonElement;
        if (btnEl.disabled) continue;
        if (btnEl.getAttribute('aria-hidden') === 'true') continue;
        const text = btnEl.textContent?.trim() ?? '';
        if (!text || !sizePattern.test(text)) continue;
        const r = btnEl.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        results.push(text);
      }
      return results;
    }, this.sizePatternSource);
  }

  async getVisibleSizeLabels(): Promise<string[]> {
    return this.page.evaluate((sizePatSrc) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const results: string[] = [];
      for (const btn of buttons) {
        if (btn.getAttribute('aria-hidden') === 'true') continue;
        const text = btn.textContent?.trim() ?? '';
        if (!text || !sizePattern.test(text)) continue;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        results.push(text);
      }
      return results;
    }, this.sizePatternSource);
  }

  async getSizeToggleActiveLabel(): Promise<string> {
    return this.page.evaluate(({ sizePatSrc, genderPatSrc }) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const genderPattern = new RegExp(genderPatSrc, 'i');
      const allButtons = Array.from(document.querySelectorAll('button'));
      const sizeButtons = allButtons.filter((btn) => {
        const text = btn.textContent?.trim() ?? '';
        if (!sizePattern.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (sizeButtons.length === 0) return '';
      // Walk up from size buttons to find the gender toggle in the same container
      let container: Element | null = sizeButtons[0].parentElement;
      while (container && container !== document.body) {
        const activeBtn = Array.from(container.querySelectorAll('button')).find((btn) => {
          const text = btn.textContent?.trim() ?? '';
          if (!text || !genderPattern.test(text) || sizePattern.test(text)) return false;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return (
            btn.getAttribute('aria-selected') === 'true' ||
            btn.getAttribute('aria-pressed') === 'true' ||
            btn.getAttribute('aria-current') === 'true' ||
            btn.classList
              .toString()
              .toLowerCase()
              .split(/\s+/)
              .some((c) => c.includes('active') || c.includes('selected') || c.includes('current'))
          );
        });
        if (activeBtn) return activeBtn.textContent?.trim() ?? '';
        container = container.parentElement;
      }
      return '';
    }, { sizePatSrc: this.sizePatternSource, genderPatSrc: this.genderPatternSource });
  }
}
