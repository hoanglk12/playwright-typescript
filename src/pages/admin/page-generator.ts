import { Page } from '@playwright/test';
import { LoginPage } from './login-page';

/**
 * Page Generator Manager for Admin pages
 * Similar to PageGeneratorManager in the Maven framework
 */
export class PageGenerator {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Get Login Page instance
   */
  static getLoginPage(page: Page): LoginPage {
    return new LoginPage(page);
  }

}