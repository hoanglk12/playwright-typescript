import { Page } from '@playwright/test';
import { HomePage } from './home-page';
import { FormDragAndDropPage } from './form-drag-and-drop';

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
   * Get Home Page instance
   */
  static getHomePage(page: Page): HomePage {
    return new HomePage(page);
  }

  /**
   * Get Form Drag And Drop instance
   */
  static getFormDragAndDropPage(page: Page): FormDragAndDropPage {
    return new FormDragAndDropPage(page);
  }

}
