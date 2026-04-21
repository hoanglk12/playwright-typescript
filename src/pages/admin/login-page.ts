import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import { AdminTestData } from '../../data/admin-data';

/**
 * BankGuru Home Page
 * Handles the main login page functionality
 */
export class LoginPage extends BasePage {
  private readonly userIdInput: Locator;
  private readonly passwordInput: Locator;
  /** Use getByRole to avoid coupling to an auto-generated ASP.NET control ID */
  private readonly loginButton: Locator;
  private readonly homeIcon: Locator;
  /**
   * Locate error popup by the canonical message from AdminTestData (single source
   * of truth — avoids duplicating the string in both POM and test data).
   */
  readonly errorPopup: Locator;

  constructor(page: Page) {
    super(page);
    // getByLabel matches the <label for="Login1_UserName"> rendered by ASP.NET Login control
    this.userIdInput = page.getByLabel('User Name');
    this.passwordInput = page.getByLabel('Password');
    // Semantic role locator — the ASP.NET Login control renders as <button>Sign in</button>
    this.loginButton = page.getByRole('button', { name: 'Sign in' });
    this.homeIcon = page.locator('#js-nav-breadcrumb i');
    this.errorPopup = page.getByText(AdminTestData.expectedMessages.errorLogin);
  }
  /**
   * Navigate to LoginPage login page and wait for it to be fully interactive.
   * networkidle wait prevents click failures on slower browsers (e.g. Firefox)
   * where the login button can still appear unresponsive after domcontentloaded.
   */
  async navigateToCMSLoginPage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(env.adminUrl);
    await this.waitForPageLoad(); // networkidle — ensures all JS has settled
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
   * Click Login Button.
   * An explicit timeout override (30 s) is used because Firefox under parallel
   * load can stall the pointer-action dispatch even on a stable element, which
   * exhausts the default 20 s actionTimeout.
   */
  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
    await this.waitForPageLoad();
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

