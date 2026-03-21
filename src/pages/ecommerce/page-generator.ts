import { Page } from '@playwright/test';
import { EcommerceHomePage } from './home-page';

/**
 * Page Generator Manager for Ecommerce pages
 */
export class PageGenerator {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Get Ecommerce Home Page instance
   */
  static getEcommerceHomePage(page: Page): EcommerceHomePage {
    return new EcommerceHomePage(page);
  }
}