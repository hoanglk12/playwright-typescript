import { Page } from '@playwright/test';
import { HomePage } from './home-page';
import { FormDragAndDropPage } from './form-drag-and-drop';
import { ProfileListingPage } from './profile-listing-page';
import { InsightsPage } from './insights-page';

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
/**
   * Get Profile Listing Page instance
   */
  static getProfileListingPage(page: Page): ProfileListingPage {
    return new ProfileListingPage(page);
  }

  /**
   * Get Insights Page instance
   */
  static getInsightsPage(page: Page): InsightsPage {
    return new InsightsPage(page);
  }
}
