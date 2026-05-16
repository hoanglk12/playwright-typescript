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
    return this.page.evaluate((pat) => {
      const re = new RegExp(pat);
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        const text = el.textContent?.trim() ?? '';
        if ((el as Element).children.length === 0 && re.test(text)) return text;
      }
      return '';
    }, pattern);
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
      if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await closeBtn.click({ force: true });
      } else {
        await this.page.keyboard.press('Escape');
      }
      await this.waits.sleep(400);
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
}
