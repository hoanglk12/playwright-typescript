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
  private readonly errorPopup: Locator;

  constructor(page: Page) {
    super(page);
    this.userIdInput = page.locator('#Login1_UserName');
    this.passwordInput = page.locator('#Login1_Password');
    this.loginButton = page.locator('#Login1_LoginButton');
    this.homeIcon = page.locator('#js-nav-breadcrumb i');
    this.errorPopup = page.getByText('Your sign-in attempt was not successful. Please try again.'); 
  }
  /**
   * Navigate to LoginPage login page
   */  
  async navigateToCMSLoginPage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(env.adminUrl);
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

   /**
   * Retrieve the error message  from popup 
   */
 /**
 * Retrieve the error message from popup 
 */
async getErrorMessageFromPopup(): Promise<string | null> {
  try {
    
    
    // Wait for popup to appear
    await this.errorPopup.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get the text content of the popup
    const popupText = await this.errorPopup.textContent();
    
    // Return the error message text, trimmed of whitespace
    return popupText?.trim() || null;
  } catch (error) {
    // Return null if popup is not found or timeout occurs
    return null;
  }
}

}

