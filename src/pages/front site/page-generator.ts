import { Page } from '@playwright/test';
import { HomePage } from './home-page';

/**
 * Page Generator Manager for BankGuru pages
 * Similar to PageGeneratorManager in the Maven framework
 */
export class PageGenerator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }


  /**
   * Get Login Page instance
   */
  static getHomePage(page: Page): HomePage {
    return new HomePage(page);
  }

}
