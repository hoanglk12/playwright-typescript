import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';

/**
 * Home Page Object
 */
export class HomePage extends BasePage {
  // Header locators — semantic Locator for interactive elements
  private readonly hamburgerMenuBtn: Locator;
  // CSS selectors retained only for computed-style queries (no direct semantic alternative)
  private readonly logo = '.logo svg.logo__svg';
  private readonly sideNavLink = '.side-navigation__link';

  // Footer locators
  private readonly socialImageIcon = '.footer__social-icon img[class="js-lazy loading"]';

  constructor(page: Page) {
    super(page);
    // Use getByRole + accessible name — avoids brittle attribute selectors
    this.hamburgerMenuBtn = page.getByRole('button', { name: 'Menu' });
  }

  /**
   * Navigate to FF home page and wait for the page to be fully interactive.
   * Uses resilient load milestones so CI background traffic does not block tests.
   */
  async navigateToHomePage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(env.frontSiteUrl);
    await this.waitForPageLoad();
  }

  /**
   * Click hamburger menu and wait for the side-navigation to be ready
   */
  async clickHamburgerMenu(): Promise<void> {
    await this.hamburgerMenuBtn.click();
    // Wait for side navigation links to appear after menu animation
    await this.page.locator(this.sideNavLink).first().waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Hover over each side-navigation link.
   * Encapsulates the raw CSS selector inside the POM so tests remain selector-free.
   */
  async hoverNavigationLinks(): Promise<void> {
    const links = this.page.locator(this.sideNavLink);
    const count = await links.count();
    if (count > 0) {
      await links.first().hover();
    }
  }

  /**
   * Verify logo is displayed
   */
  async isLogoDisplayed(): Promise<boolean> {
    return await this.isElementDisplayed(this.logo);
  }

  /** Locator for the first side-navigation link — use with toHaveCSS() assertion */
  get firstNavLink() {
    return this.page.locator(this.sideNavLink).first();
  }

  /**
   * Return computed background-color (hex) for all side-navigation links
   */
  async getAllHighlightedTextBackgroundColor(): Promise<string[]> {
    return await this.getAllElementsBackgroundColorHex(this.sideNavLink);
  }

  /**
   * Return width and height of the social image icon
   */
  async getImageDimensionsObject(): Promise<{ width: number; height: number }> {
    return await this.getElementDimensionsObject(this.socialImageIcon);
  }
}
