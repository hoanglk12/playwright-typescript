import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommercePDPPage extends BasePage {
  private readonly productNameHeading = this.page.getByRole('heading', { level: 1 });
  // Storefronts use styled-components with hashed class names — CSS class selectors are
  // unreliable across builds. Match by price text pattern ($X.XX or $X,XXX.XX) on leaf nodes.
  private readonly priceTextPattern = '^\\$[\\d,]+(\\.[\\d]{2})?$';
  private readonly galleryImageSelector =
    '[class*="gallery"] img, .product-gallery img, .swiper-slide img, img[class*="product"]';
  private readonly PDP_URL_PATTERN = /(\/product\/|\/p\/|\/pdp\/|\.html)/i;

  constructor(page: Page) {
    super(page);
  }

  async waitForPdpLoad(): Promise<void> {
    await this.waits.waitForUrlMatches(this.PDP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
    await this.productNameHeading.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
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
}
