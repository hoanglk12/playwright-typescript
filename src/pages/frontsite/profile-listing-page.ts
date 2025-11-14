import { Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import * as ProfileListingData  from '../../data/profile-listing-data';

/**
 * Profile Listing Page Object
 */
export class ProfileListingPage extends BasePage {


  private readonly searchTextBox = 'div[role="combobox"] > input';
  private readonly sortByDropdown = 'select[class*="custom-input custom-input"]';
  // private readonly sortByDropdownSelectedOption = 'select > option:checked';

  

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

  /**
   * Get the label/text of the currently selected option in Sort By dropdown
   */
  async getSelectedSortByLabel(): Promise<string> {
    // <option> elements may be hidden; read the selected option via the select element
    const text = await this.page.locator(this.sortByDropdown).evaluate((el: HTMLSelectElement) => {
      const opt = el.selectedOptions && el.selectedOptions[0];
      return opt ? (opt.textContent || '').trim() : '';
    });
    return (text || '').trim();
  }

 
  async searchWithKeyword(keyword: string): Promise<void> {
    await this.enterText(this.searchTextBox, keyword);
  }

  /**
   * Get the number of profiles displayed
   */
  async getProfileCount(): Promise<number> {
    return await this.page.locator('main a[href*="/people/"]').count();
  }

  /**
   * Verify that profiles are sorted in ascending order by surname
   */
  async verifyProfilesSortedBySurnameAscending(): Promise<boolean> {
    // Get all profile name elements from the people listing (scope to main area)
    const profileNameElements = await this.page.locator('main a[href*="/people/"]').allTextContents();

    // Filter out non-name anchors (emails, phones, empty strings) and trim
    const names = profileNameElements
      .map(n => (n || '').trim())
      .filter(n => n && !n.includes('@') && !n.toLowerCase().startsWith('tel:') && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(n));

    if (names.length < 2) {
      return true; // If there's 1 or no profiles, consider it sorted
    }

    // Deduplicate adjacent duplicates (some cards contain duplicated anchor texts)
    const deduped: string[] = [];
    for (let i = 0; i < names.length; i++) {
      if (i === 0 || names[i] !== names[i - 1]) deduped.push(names[i]);
    }

    // Extract surnames robustly: take the last word-like token (letters, hyphens, apostrophes)
    const surnameRegex = /([A-Za-zÀ-ÖØ-öø-ÿ'’-]+)\s*$/.exec as any;
    const surnames = deduped.map(name => {
      // Remove trailing parentheticals or commas
      const cleaned = name.replace(/\s*[,\(\[].*$/, '').trim();
      const match = cleaned.match(/([A-Za-zÀ-ÖØ-öø-ÿ'’-]+)\s*$/);
      const s = match && match[1] ? match[1].toLowerCase() : cleaned.split(' ').pop()!.toLowerCase();
      return s;
    });

    // Check if surnames are in ascending lexicographic order
    for (let i = 1; i < surnames.length; i++) {
      if (surnames[i] < surnames[i - 1]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all profile full names shown on the listing
   */
  async getProfileFullNames(): Promise<string[]> {
    return await this.page.locator('a[href*="/people/"]').allTextContents();
  }

}
