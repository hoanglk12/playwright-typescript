import { Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import * as ProfileListingData  from '../../data/profile-listing-data';

/**
 * Profile Listing Page Object
 */
export class ProfileListingPage extends BasePage {


  private readonly searchTextBox = 'div[role="combobox"] > input';
  private readonly sortByDropdown = 'select';

  

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

  /**
   * Get the number of profiles displayed
   */
  async getProfileCount(): Promise<number> {
    return await this.page.locator('a[href*="/people/"]').count();
  }

  /**
   * Verify that profiles are sorted in ascending order by surname
   */
  async verifyProfilesSortedBySurnameAscending(): Promise<boolean> {
    // Get all profile name elements from the people listing
    const profileNameElements = await this.page.locator('a[href*="/people/"]').allTextContents();
    
    if (profileNameElements.length < 2) {
      return true; // If there's 1 or no profiles, consider it sorted
    }

    // Extract surnames (assuming format "First Last" or just "Last")
    const surnames = profileNameElements.map(name => {
      const parts = name.trim().split(' ');
      return parts[parts.length - 1].toLowerCase(); // Get last name
    });

    // Check if surnames are in ascending order
    for (let i = 1; i < surnames.length; i++) {
      if (surnames[i] < surnames[i - 1]) {
        return false;
      }
    }
    
    return true;
  }

}
