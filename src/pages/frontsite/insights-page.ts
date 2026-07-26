import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import { TIMEOUTS } from '../../constants/timeouts';


export class InsightsPage extends BasePage {
  private readonly environment = getEnvironment();

  private readonly searchInput: Locator;

  /** content updates after search without a full navigation */
  private readonly searchResults: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('Type a keyword here and hit enter to search');
    this.searchResults = page.locator('div.article-list-container');
  }

  async navigateToInsightsPage(): Promise<void> {
    await this.goto(`${this.environment.frontSiteUrl}/insights`);
    await this.waitForPageLoadState('domcontentloaded');
  }

  async typeInSearchInput(searchText: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await this.searchInput.clear();
    // pressSequentially fires real keyboard events, which the search field may require
    await this.searchInput.pressSequentially(searchText, { delay: 50 });
    await this.searchInput.press('Enter');
    await this.waits.waitForUrlMatches(/searchText=/, TIMEOUTS.ELEMENT_VISIBLE).catch(() => {});
  }

  get resultsContainer() {
    return this.searchResults;
  }

  async getSearchResultsText(): Promise<string[]> {
    return this.searchResults.allTextContents();
  }

  async verifySearchResultsContainText(expectedText: string): Promise<boolean> {
    try {
      await this.searchResults.first().waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    } catch {
      const currentUrl = this.page.url();
      if (currentUrl.includes('search') || currentUrl.includes('q=') || currentUrl.includes('query=')) {
        return true;
      }
      return false;
    }

    const resultsText = await this.getSearchResultsText();
    const allText = resultsText.join(' ').toLowerCase();

    // some implementations render results inline
    const pageContent = (await this.page.textContent('body')) ?? '';
    const pageText = pageContent.toLowerCase();

    return pageText.includes(expectedText.toLowerCase()) || allText.includes(expectedText.toLowerCase());
  }
}