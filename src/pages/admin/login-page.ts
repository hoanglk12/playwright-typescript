import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import { AdminTestData } from '../../data/admin-data';
import { TIMEOUTS } from '../../constants/timeouts';

export class LoginPage extends BasePage {
  private readonly userIdInput: Locator;
  private readonly passwordInput: Locator;
  /** Use getByRole to avoid coupling to an auto-generated ASP.NET control ID */
  private readonly loginButton: Locator;
  private readonly homeIcon: Locator;
  /** single source of truth — avoids duplicating the string in both POM and test data */
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
    await this.goto(env.adminUrl);
    await this.waitForPageLoad(); // networkidle — ensures all JS has settled
  }

  async enterUserID(userID: string): Promise<void> {
    await this.userIdInput.fill(userID);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
    await this.waitForPageLoad();
  }

  async isHomeIconDisplayed(): Promise<boolean> {
    try {
      await this.homeIcon.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
      return await this.homeIcon.isVisible();
    } catch {
      return false;
    }
  }

async getErrorMessageFromPopup(): Promise<string | null> {
  try {
    await this.errorPopup.waitFor({ state: 'visible', timeout: TIMEOUTS.DIALOG_DISMISS });
    const popupText = await this.errorPopup.textContent();
    return popupText?.trim() || null;
  } catch (error) {
    return null;
  }
}

}

