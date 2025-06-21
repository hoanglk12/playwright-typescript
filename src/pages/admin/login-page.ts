import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';

/**
 * BankGuru Home Page
 * Handles the main login page functionality
 */
export class LoginPage extends BasePage {
  private readonly userIdInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly homeIcon: Locator;


  constructor(page: Page) {
    super(page);
    this.userIdInput = page.locator('#Login1_UserName');
    this.passwordInput = page.locator('#Login1_Password');
    this.loginButton = page.locator('#Login1_LoginButton');
    this.homeIcon = page.locator('#js-nav-breadcrumb i');
  }
  /**
   * Navigate to LoginPage login page
   */  
  async navigateToHomePage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(env.adminUrl);
    await this.waitForPageLoad();
  }

  /**
   * Enter User ID
   */
  async enterUserID(userID: string): Promise<void> {
    await this.userIdInput.fill(userID);
  }

  /**
   * Enter Password
   */
  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Click Login Button
   */
  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
  }

  
  /**
   * Check if home icon is displayed
   */
  async isHomeIconDisplayed(): Promise<boolean> {
    try {
      await this.homeIcon.waitFor({ state: 'visible', timeout: 10000 });
      return await this.homeIcon.isVisible();
    } catch {
      return false;
    }
  }

  
}

