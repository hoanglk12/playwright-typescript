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
  private readonly profileAnchorSelector = 'main a[href*="/people/"]';
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
    // await this.waitForDOMContentLoaded();
  }

  /**
   * Click hamburger menu
   */
  async selectSortByDropDownWithSurname(): Promise<void> {
    await this.selectDropdownByText(this.sortByDropdown, ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME);
    // Ensure ascending is selected (some pages expose an explicit Ascending button)
    try {
      const ascBtn = this.page.locator('main').locator('button:has-text("Ascending")').first();
      if (await ascBtn.count() > 0) {
        await ascBtn.click();
      }
    } catch (e) {
      // ignore if the Ascending control isn't present
    }
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
    // Wait for at least one profile anchor to be attached (CI can be slower)
    try {
      await this.waitForProfilesToBePresent(1, 30000);
    } catch (e) {
      // swallow and return whatever is present (will be asserted by the test)
    }
    return await this.page.locator(this.profileAnchorSelector).count();
  }

  /**
   * Verify that profiles are sorted in ascending order by surname
   */
  async verifyProfilesSortedBySurnameAscending(): Promise<boolean> {
    // Ensure profile anchors are present before reading names
    await this.waitForProfilesToBePresent(1, 30000);
    // Get all profile name elements from the people listing (scope to main area)
    const profileNameElements = await this.page.locator(this.profileAnchorSelector).allTextContents();

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
      const parts = cleaned.split(/\s+/);
      let key: string;
      if (parts.length <= 2) {
        // single or two-token name: use last token as surname
        key = parts[parts.length - 1];
      } else {
        // multi-word surname: assume everything after the first token is the surname/key
        key = parts.slice(1).join(' ');
      }
      return (key || '').toLowerCase();
    });

    // Check if surnames are in ascending lexicographic order (use localeCompare for robustness)
    for (let i = 1; i < surnames.length; i++) {
      const cmp = surnames[i].localeCompare(surnames[i - 1], undefined, { sensitivity: 'base' });
      if (cmp < 0) {
        // Debug output to help CI logs diagnose ordering issues
        // eslint-disable-next-line no-console
        console.error('Profiles not sorted. First 20 names:', deduped.slice(0, 20));
        // eslint-disable-next-line no-console
        console.error('Extracted surnames:', surnames.slice(0, 20));
        return false;
      }
    }

    return true;
  }

  /**
   * Wait until there are at least `minCount` profile anchors present in the main listing.
   */
  async waitForProfilesToBePresent(minCount = 1, timeout = 30000): Promise<void> {
    const sel = this.profileAnchorSelector;
    await this.page.waitForFunction(
      (args: (string | number)[]) => {
        const s = args[0] as string;
        const min = args[1] as number;
        try {
          return document.querySelectorAll(s).length >= min;
        } catch (e) {
          return false;
        }
      },
      [sel, minCount],
      { timeout }
    );
  }

  /**
   * Get all profile full names shown on the listing
   */
  async getProfileFullNames(): Promise<string[]> {
    return await this.page.locator('a[href*="/people/"]').allTextContents();
  }

}
