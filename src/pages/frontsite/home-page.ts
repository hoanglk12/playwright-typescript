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

  /**
   * Search for products
   */
  // async searchForProduct(searchTerm: string): Promise<void> {
  //   await this.enterText(this.searchBox, searchTerm);
  //   await this.clickElement(this.searchButton);
  // }

  /**
   * Get featured products count
   */
  // async getFeaturedProductsCount(): Promise<number> {
  //   await this.waitForElement(this.featuredProducts);
  //   return await this.page.locator(this.featuredProducts).count();
  // }

  /**
   * Click on a category
   */
  // async clickCategory(categoryName: string): Promise<void> {
  //   await this.clickElement(`${this.categoryLinks}:has-text("${categoryName}")`);
  // }

  /**
   * Check if home page is displayed
   */
  // async isHomePageDisplayed(): Promise<boolean> {
  //   return await this.isElementDisplayed(this.logo) &&
  //          await this.isElementDisplayed(this.searchBox);
  // }

  /**
   * Get current product names on homepage
   */
  // async getProductNames(): Promise<string[]> {
  //   await this.waitForElement(this.featuredProducts);
  //   const products = await this.page.locator(`${this.featuredProducts} .product-title a`).all();
  //   const names: string[] = [];
    
  //   for (const product of products) {
  //     const name = await product.textContent();
  //     if (name) names.push(name.trim());
  //   }
    
  //   return names;
  // }


}
