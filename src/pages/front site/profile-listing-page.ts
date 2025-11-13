import { Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import * as ProfileListingData  from '../../data/profile-listing-data';

/**
 * Profile Listing Page Object
 */
export class ProfileListingPage extends BasePage {


  private readonly searchTextBox = 'div[role="combobox"] > input';
  private readonly sortByDropdown = 'div.items-listing__title ~ select';
  private readonly sortButtonSelector = 'role=button[name="Ascending"]';

  

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to FF home page
   */
  async navigateToProfileListingPage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(ProfileListingData.ProfileListingTestDataGenerator.profileListingUrl);
    //await this.waitForFullPageLoad();
  }

  /**
   * Click hamburger menu
   */
  async selectSortByDropDownWithSurname(): Promise<void> {
    await this.selectDropdownByText(this.sortByDropdown, ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME);
  }

 
  async searchWithKeyword(keyword: string): Promise<void> {
    await this.enterText(this.searchTextBox, keyword);
  }

  async getTooltipTextFromSortButton(): Promise<string>{
    // Firefox-specific handling due to hover timeout issues
    const browserName = this.page.context().browser()?.browserType().name();
    
    if (browserName === 'firefox') {
      // For Firefox, get the title attribute directly instead of hovering
      await this.waitForElement(this.sortButtonSelector);
      const title = await this.page.getAttribute(this.sortButtonSelector, 'title');
      return title || '';
    } else {
      // Standard hover approach for other browsers
      return await this.hoverAndGetTooltipAdvanced(this.sortButtonSelector);
    }
  }

}
