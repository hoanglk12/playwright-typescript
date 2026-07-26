import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import { TIMEOUTS } from '../../constants/timeouts';

export class HomePage extends BasePage {
  private readonly hamburgerMenuBtn: Locator;
  // CSS selectors retained only for computed-style queries (no direct semantic alternative)
  private readonly logo = '.logo svg.logo__svg';
  private readonly sideNavLink = '.side-navigation__link';

  private readonly socialImageIcon = '.footer__social-icon img[class="js-lazy loading"]';

  constructor(page: Page) {
    super(page);
    this.hamburgerMenuBtn = page.getByRole('button', { name: 'Menu' });
  }

  async navigateToHomePage(): Promise<void> {
    const env = getEnvironment();
    await this.goto(env.frontSiteUrl);
    await this.waitForPageLoad();
  }

  async clickHamburgerMenu(): Promise<void> {
    await this.hamburgerMenuBtn.click();
    // Wait for side navigation links to appear after menu animation
    await this.elements.locator(this.sideNavLink).first().waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  async hoverNavigationLinks(): Promise<void> {
    const links = this.elements.locator(this.sideNavLink);
    const count = await links.count();
    if (count > 0) {
      await links.first().hover();
    }
  }

  async isLogoDisplayed(): Promise<boolean> {
    return await this.isElementDisplayed(this.logo);
  }

  get firstNavLink() {
    return this.elements.locator(this.sideNavLink).first();
  }

  async getAllHighlightedTextBackgroundColor(): Promise<string[]> {
    return await this.getAllElementsBackgroundColorHex(this.sideNavLink);
  }

  async getImageDimensionsObject(): Promise<{ width: number; height: number }> {
    return await this.getElementDimensionsObject(this.socialImageIcon);
  }
}
