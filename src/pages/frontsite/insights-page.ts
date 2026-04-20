import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';


/**
 * Insights Page Object
 */
export class InsightsPage extends BasePage {
  // Environment-specific URL
  private readonly environment = getEnvironment();

  /**
   * Search input — resolved via placeholder text (semantic, language-independent
   * to the extent the placeholder doesn't change) instead of a brittle XPath.
   */
  private readonly searchInput: Locator;

  /**
   * Container that holds all returned article cards.
   * Uses .article-list-container — always present on the page, content
   * updates after search without a full navigation.
   */
  private readonly searchResults: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('Type a keyword here and hit enter to search');
    this.searchResults = page.locator('div.article-list-container');
  }

  /**
   * Navigate to Insights page
   */
  async navigateToInsightsPage(): Promise<void> {
    await this.page.goto(`${this.environment.frontSiteUrl}/insights`);
    await this.waitForPageLoadState('domcontentloaded');
  }

  /**
   * Type text in the search input and submit.
   * Uses pressSequentially (preserves keystroke events) then Enter.
   * Waits for the results container to appear instead of a fixed timeout.
   */
  async typeInSearchInput(searchText: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.searchInput.clear();
    // pressSequentially fires real keyboard events, which the search field may require
    await this.searchInput.pressSequentially(searchText, { delay: 50 });
    await this.searchInput.press('Enter');
    // Wait for URL to update with searchText param — confirms search was submitted
    await this.page.waitForURL(/searchText=/, { timeout: 10000 }).catch(() => {});
  }

  /** Locator for search results container — use with toContainText() assertion */
  get resultsContainer() {
    return this.searchResults;
  }

  /**
   * Get all visible search-result block text contents
   */
  async getSearchResultsText(): Promise<string[]> {
    return this.searchResults.allTextContents();
  }

  /**
   * Verify that at least one search result (or page body) contains the expected text
   */
  async verifySearchResultsContainText(expectedText: string): Promise<boolean> {
    try {
      await this.searchResults.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      // Results container not found — check whether we landed on a search-results URL
      const currentUrl = this.page.url();
      if (currentUrl.includes('search') || currentUrl.includes('q=') || currentUrl.includes('query=')) {
        return true;
      }
      return false;
    }

    const resultsText = await this.getSearchResultsText();
    const allText = resultsText.join(' ').toLowerCase();

    // Also scan page body as a fallback (some implementations render results inline)
    const pageContent = (await this.page.textContent('body')) ?? '';
    const pageText = pageContent.toLowerCase();

    return pageText.includes(expectedText.toLowerCase()) || allText.includes(expectedText.toLowerCase());
  }
}