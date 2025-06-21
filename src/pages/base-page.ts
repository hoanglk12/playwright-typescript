import { Page } from '@playwright/test';

/**
 * Base Page class for all page objects
 * Contains common functionality similar to BasePage in the Maven framework
 */
export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Wait for element to be clickable
   */
  async waitForElementClickable(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'attached', timeout });
  }

  /**
   * Check if element is displayed
   */
  async isElementDisplayed(selector: string): Promise<boolean> {
    try {
      return await this.page.isVisible(selector);
    } catch {
      return false;
    }
  }

  /**
   * Click on element
   */
  async clickElement(selector: string): Promise<void> {
    await this.waitForElementClickable(selector);
    await this.page.click(selector);
  }

  /**
   * Enter text into input field
   */
  async enterText(selector: string, text: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.fill(selector, text);
  }

  /**
   * Get text from element
   */
  async getText(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.textContent(selector) || '';
  }

  /**
   * Get attribute value from element
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    await this.waitForElement(selector);
    return await this.page.getAttribute(selector, attribute);
  }

  /**
   * Select option from dropdown by value
   */
  async selectDropdownByValue(selector: string, value: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.selectOption(selector, { value });
  }

  /**
   * Select option from dropdown by text
   */
  async selectDropdownByText(selector: string, text: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.selectOption(selector, { label: text });
  }

  /**
   * Check if checkbox/radio button is checked
   */
  async isChecked(selector: string): Promise<boolean> {
    await this.waitForElement(selector);
    return await this.page.isChecked(selector);
  }

  /**
   * Check checkbox/radio button
   */
  async check(selector: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.check(selector);
  }

  /**
   * Uncheck checkbox
   */
  async uncheck(selector: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.uncheck(selector);
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  /**
   * Refresh the page
   */
  async refreshPage(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Generate random email
   */
  generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test_${timestamp}_${random}@automation.com`;
  }

  /**
   * Generate random number
   */
  generateRandomNumber(min: number = 1000, max: number = 9999): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
