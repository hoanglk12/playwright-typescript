import { Locator, Page } from '@playwright/test';
import { BasePage } from '../base-page';
import * as ProfileListingData from '../../data/profile-listing-data';
import { TIMEOUTS } from '../../constants/timeouts';

export class ProfileListingPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  // ── Semantic Locators ──

  private sortByDropdown(): Locator {
    return this.page
      .locator('select')
      .filter({ hasText: /seniority|surname/i })
      .first();
  }

  private profileLinks(): Locator {
    return this.page
      .getByRole('link')
      .and(this.elements.locator('[href*="/people/"]'));
  }

  private searchInput(): Locator {
    return this.page
      .getByRole('searchbox')
      .or(this.page.getByLabel(/search/i))
      .or(this.page.getByRole('combobox').locator('input'))
      .first();
  }

  async navigateToProfileListingPage(): Promise<void> {
    await this.goto(ProfileListingData.ProfileListingTestDataGenerator.profileListingUrl);
    await this.waitForPageLoadState('domcontentloaded');
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: TIMEOUTS.TIMEOUT_LONG });
  }

  async selectSortByDropDownWithSurname(): Promise<void> {
    const dropdown = this.sortByDropdown();
    await dropdown.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await dropdown.selectOption({ label: ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME });

    // Ensure ascending order is selected
    const ascControl = this.page
      .getByRole('main')
      .getByText(ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME_ASC, { exact: true })
      .first();
    if (await ascControl.count() > 0) {
      await ascControl.click();
      await this.waitForAjaxRequestsComplete();
    }

    await this.waitForAjaxRequestsComplete();
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD_FAST });
  }

  async getSelectedSortByLabel(): Promise<string> {
    const dropdown = this.sortByDropdown();
    await dropdown.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    const text = await dropdown.evaluate((el: HTMLSelectElement) => {
      const selected = el.selectedOptions[0];
      return selected ? (selected.textContent ?? '').trim() : '';
    });
    return text.trim();
  }

  async searchWithKeyword(keyword: string): Promise<void> {
    const input = this.searchInput();
    await input.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await input.fill(keyword);
    await this.page.keyboard.press('Enter');
    await this.waitForAjaxRequestsComplete();
  }

  async getProfileCount(): Promise<number> {
    try {
      await this.profileLinks().first().waitFor({ state: 'visible', timeout: TIMEOUTS.TIMEOUT_LONG });
    } catch {
      // swallow — the count of 0 will be asserted by the test
    }
    return await this.profileLinks().count();
  }

  async verifyProfilesSortedBySurnameAscending(): Promise<boolean> {
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: TIMEOUTS.TIMEOUT_LONG });
    const allNames = await this.profileLinks().allTextContents();

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

    const deduped: string[] = [];
    for (let i = 0; i < names.length; i++) {
      if (i === 0 || names[i] !== names[i - 1]) deduped.push(names[i]);
    }

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

    for (let i = 1; i < surnames.length; i++) {
      const cmp = surnames[i].localeCompare(surnames[i - 1], undefined, { sensitivity: 'base' });
      if (cmp < 0) {
        return false;
      }
    }

    return true;
  }

  async getProfileFullNames(): Promise<string[]> {
    await this.profileLinks().first().waitFor({ state: 'visible', timeout: TIMEOUTS.TIMEOUT_LONG });
    return await this.profileLinks().allTextContents();
  }

}
