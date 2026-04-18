import { Locator, Page } from '@playwright/test';
import { BasePage } from '../base-page';
import * as ProfileListingData from '../../data/profile-listing-data';

/**
 * Profile Listing Page Object
 * Follows Page Object Model (POM) pattern.
 * Locators use semantic selectors per playwright-expert skill:
 * getByRole / getByLabel / getByText are preferred over XPath or CSS.
 */
export class ProfileListingPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  // ── Semantic Locators (playwright-expert: prefer getByRole/getByLabel/getByText) ──

  /** Sort By <select> — matched by visible option text containing known sort values */
  private sortByDropdown(): Locator {
    return this.page
      .locator('select')
      .filter({ hasText: /seniority|surname/i })
      .first();
  }

  /** Profile card links — getByRole('link') intersected with href attribute (playwright-expert: .and() preferred over CSS-only) */
  private profileLinks(): Locator {
    return this.page
      .getByRole('link')
      .and(this.page.locator('[href*="/people/"]'));
  }

  /** Search input — matched by role or label */
  private searchInput(): Locator {
    return this.page
      .getByRole('searchbox')
      .or(this.page.getByLabel(/search/i))
      .or(this.page.getByRole('combobox').locator('input'))
      .first();
  }

  /**
   * Navigate to Profile Listing page and wait for profiles to be visible.
   * Uses Playwright auto-waiting instead of waitForTimeout.
   */
  async navigateToProfileListingPage(): Promise<void> {
    await this.page.goto(ProfileListingData.ProfileListingTestDataGenerator.profileListingUrl);
    await this.waitForPageLoadState('domcontentloaded');
    // Auto-wait: block until at least one profile link is visible (no hard wait)
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Select Sort By dropdown with Surname option.
   * Uses semantic locator + Playwright auto-wait after sort change.
   */
  async selectSortByDropDownWithSurname(): Promise<void> {
    const dropdown = this.sortByDropdown();
    await dropdown.waitFor({ state: 'visible', timeout: 10000 });
    await dropdown.selectOption({ label: ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME });

    // Ensure ascending order is selected — use getByText (playwright-expert: semantic, matches any element type)
    const ascControl = this.page
      .getByRole('main')
      .getByText(ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME_ASC, { exact: true })
      .first();
    if (await ascControl.count() > 0) {
      await ascControl.click();
      await this.waitForAjaxRequestsComplete();
    }

    // Auto-wait for AJAX + first profile link to re-appear after sort change
    await this.waitForAjaxRequestsComplete();
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Get the currently selected Sort By option label.
   * evaluate() uses HTMLSelectElement — proper Web API type, no 'any'.
   */
  async getSelectedSortByLabel(): Promise<string> {
    const dropdown = this.sortByDropdown();
    await dropdown.waitFor({ state: 'visible', timeout: 10000 });
    const text = await dropdown.evaluate((el: HTMLSelectElement) => {
      const selected = el.selectedOptions[0];
      return selected ? (selected.textContent ?? '').trim() : '';
    });
    return text.trim();
  }

  /**
   * Type a keyword into the search input.
   * Uses semantic locator (getByRole/getByLabel) per playwright-expert skill.
   */
  async searchWithKeyword(keyword: string): Promise<void> {
    const input = this.searchInput();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill(keyword);
    await this.page.keyboard.press('Enter');
    await this.waitForAjaxRequestsComplete();
  }

  /**
   * Get the count of profile cards displayed.
   * Uses Playwright auto-waiting via .waitFor() instead of raw waitForFunction.
   */
  async getProfileCount(): Promise<number> {
    try {
      await this.profileLinks().first().waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      // swallow — the count of 0 will be asserted by the test
    }
    return await this.profileLinks().count();
  }

  /**
   * Verify profiles are sorted ascending by surname.
   * Uses semantic profileLinks() locator + Playwright auto-wait.
   */
  async verifyProfilesSortedBySurnameAscending(): Promise<boolean> {
    // Auto-wait for profile links to be visible before reading names
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: 30000 });
    const allNames = await this.profileLinks().allTextContents();

    // Filter out empty strings, emails, phone links
    const names = allNames
      .map((n) => n.trim())
      .filter(
        (n) =>
          n.length > 0 &&
          !n.includes('@') &&
          !n.toLowerCase().startsWith('tel:') &&
          /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(n)
      );

    if (names.length < 2) return true;

    // Deduplicate adjacent duplicates
    const deduped: string[] = [];
    for (let i = 0; i < names.length; i++) {
      if (i === 0 || names[i] !== names[i - 1]) deduped.push(names[i]);
    }

    // Extract surname: last token for 1-2 token names; everything after first token for 3+ token names
    const extractSurname = (fullName: string): string => {
      const cleaned = fullName.replace(/\s*[,([].*$/, '').trim();
      const parts = cleaned.split(/\s+/);
      if (parts.length <= 2) {
        return parts[parts.length - 1].toLowerCase();
      }
      // 3+ tokens: compound surname — use everything after the first (given) name
      return parts.slice(1).join(' ').toLowerCase();
    };

    const surnames = deduped.map(extractSurname);

    // Verify ascending lexicographic order
    for (let i = 1; i < surnames.length; i++) {
      const cmp = surnames[i].localeCompare(surnames[i - 1], undefined, { sensitivity: 'base' });
      if (cmp < 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all profile full names shown on the listing.
   * Uses semantic profileLinks() locator.
   */
  async getProfileFullNames(): Promise<string[]> {
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: 30000 });
    return await this.profileLinks().allTextContents();
  }

}
