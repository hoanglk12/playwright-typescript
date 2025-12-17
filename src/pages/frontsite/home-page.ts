import { Page, } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';

/**
 * Home Page Object
 */
export class HomePage extends BasePage {
  // Header locators

  private readonly hamburgerMenu = 'button[aria-label="Menu"]';
  private readonly logo = '.logo svg.logo__svg';
  private readonly highlightedText = '.side-navigation__link';
  
  // Footer locators
  private readonly socialImageIcon = '.footer__social-icon img[class="js-lazy loading"]';

  

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to FF home page
   */
  async navigateToHomePage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(env.frontSiteUrl);
    // await this.waitForPageReady();
  }

  /**
   * Click hamburger menu
   */
  async clickHamburgerMenu(): Promise<void> {
    await this.clickElement(this.hamburgerMenu);
    // Wait for side navigation to appear (menu opening animation takes ~1 second)
    await this.page.waitForSelector(this.highlightedText, { timeout: 5000 });
  }

  /**
   * Verify logo is displayed
   */
  async isLogoDisplayed(): Promise<boolean> {
    return await this.isElementDisplayed(this.logo);
  }

  /**
   * Return hex color of highlighted text
   */
  async getAllHighlightedTextBackgroundColor(): Promise<string[]> {
    return await this.getAllElementsBackgroundColorHex(this.highlightedText);
  }

    /**
   * Return width and height of the social image icon
   */
 async getImageDimensionsObject(): Promise<{width: number, height: number}> {
  return await this.getElementDimensionsObject(this.socialImageIcon);
}

}
