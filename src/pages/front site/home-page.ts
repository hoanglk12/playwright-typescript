import { Page, } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';

/**
 * BankGuru Home Page Object
 */
export class HomePage extends BasePage {
  // BankGuru specific locators
  private readonly hereLink = 'a[href*="manager"]';
  private readonly loginLink = 'a[href*="login"]';
  
  // NopCommerce locators (keep for compatibility)
  private readonly registerLink = 'a[href="/register"]';
  private readonly searchBox = '#small-searchterms';
  private readonly searchButton = 'button[type="submit"]';
  private readonly featuredProducts = '.product-item';
  private readonly categoryLinks = '.top-menu a';
  private readonly shoppingCartLink = '.header-links .cart-label';
  private readonly wishlistLink = '.header-links .wishlist-label';
  private readonly logo = '.header-logo img';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to BankGuru/NopCommerce home page
   */
  async navigateToHomePage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(env.frontSiteUrl);
    await this.waitForPageLoad();
  }

  /**
   * Click "Here" link for BankGuru login (Manager access)
   */
  async clickHereLink(): Promise<void> {
    await this.clickElement(this.hereLink);
  }

  /**
   * Click Register link
   */
  async clickRegisterLink(): Promise<void> {
    await this.clickElement(this.registerLink);
  }

  /**
   * Click Login link
   */
  async clickLoginLink(): Promise<void> {
    await this.clickElement(this.loginLink);
  }

  /**
   * Search for products
   */
  async searchForProduct(searchTerm: string): Promise<void> {
    await this.enterText(this.searchBox, searchTerm);
    await this.clickElement(this.searchButton);
  }

  /**
   * Get featured products count
   */
  async getFeaturedProductsCount(): Promise<number> {
    await this.waitForElement(this.featuredProducts);
    return await this.page.locator(this.featuredProducts).count();
  }

  /**
   * Click on a category
   */
  async clickCategory(categoryName: string): Promise<void> {
    await this.clickElement(`${this.categoryLinks}:has-text("${categoryName}")`);
  }

  /**
   * Check if home page is displayed
   */
  async isHomePageDisplayed(): Promise<boolean> {
    return await this.isElementDisplayed(this.logo) &&
           await this.isElementDisplayed(this.searchBox);
  }

  /**
   * Get current product names on homepage
   */
  async getProductNames(): Promise<string[]> {
    await this.waitForElement(this.featuredProducts);
    const products = await this.page.locator(`${this.featuredProducts} .product-title a`).all();
    const names: string[] = [];
    
    for (const product of products) {
      const name = await product.textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }

  /**
   * Click on shopping cart
   */
  async clickShoppingCart(): Promise<void> {
    await this.clickElement(this.shoppingCartLink);
  }

  /**
   * Click on wishlist
   */
  async clickWishlist(): Promise<void> {
    await this.clickElement(this.wishlistLink);
  }
}
