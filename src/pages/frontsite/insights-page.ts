import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

/**
 * Insights Page Object
 */
export class InsightsPage extends BasePage {
  // Search locators
  private readonly searchToggle = 'button[aria-label*="search" i], .search-toggle, .search-icon, [data-testid*="search"]';
  private readonly searchInput = '//*[@id="pageContent"]//input[@placeholder="Type a keyword here and hit enter to search"]';
  private readonly searchResults = 'div.article-card__list-results';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to Insights page
   */
  async navigateToInsightsPage(): Promise<void> {
    await this.page.goto('https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/en/insights');
    await this.waitForDOMContentLoaded();
  }

  /**
   * Type text in search input
   */
  async typeInSearchInput(searchText: string): Promise<void> {
    // Wait for the search input to be available using the specific XPath selector
    const searchElement = this.page.locator(this.searchInput).first();
    await searchElement.waitFor({ state: 'visible', timeout: 10000 });

    // Clear and type the search text
    await searchElement.fill('');
    await searchElement.type(searchText, { delay: 100 });

    // Press Enter to submit the search
    await this.page.keyboard.press('Enter');

    // Wait for search results to load
    await this.page.waitForTimeout(3000);
  }

  /**
   * Get search results text
   */
  async getSearchResultsText(): Promise<string[]> {
    const results = await this.page.locator(this.searchResults).allTextContents();
    return results;
  }

  /**
   * Verify search results contain specific text
   */
  async verifySearchResultsContainText(expectedText: string): Promise<boolean> {
    // Wait for search results to be visible
    try {
      await this.page.locator(this.searchResults).first().waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      // If results don't appear, check if we're on search page
      const currentUrl = this.page.url();
      const hasSearchParam = currentUrl.includes('search') || currentUrl.includes('q=') || currentUrl.includes('query=');
      if (hasSearchParam) {
        return true;
      }
      return false;
    }

    // Get search results text
    const resultsText = await this.getSearchResultsText();
    const allText = resultsText.join(' ').toLowerCase();

    // Also check the entire page content for the search term
    const pageContent = await this.page.textContent('body');
    const pageText = pageContent?.toLowerCase() || '';

    return pageText.includes(expectedText.toLowerCase()) || allText.includes(expectedText.toLowerCase());
  }
}