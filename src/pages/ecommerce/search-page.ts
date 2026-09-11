import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceSearchPage extends BasePage {
  private readonly mainContainer = 'main';
  private readonly searchInput = 'input[type="text"]';
  private readonly iconSearchInput = 'div.search input[type="text"]';
  private readonly iconSearchButton = 'div.search svg.icon';
  private readonly productCardSelector = '[data-product-id]';

  constructor(page: Page) {
    super(page);
  }

  async navigateToHome(siteUrl: string): Promise<void> {
    await this.gotoWithOptions(siteUrl, { waitUntil: 'commit' });
    await this.waits.waitForElement(this.mainContainer, TIMEOUTS.ELEMENT_VISIBLE);
  }

  async search(term: string, urlPattern: RegExp = /search/i): Promise<void> {
    await this.waits.waitForElement(this.searchInput, TIMEOUTS.ELEMENT_VISIBLE);
    await this.elements.enterText(this.searchInput, term);
    await this.elements.pressKey('Enter');
    await this.waits.waitForUrlMatches(urlPattern, TIMEOUTS.PAGE_LOAD_SLOW);
    await this.waits.waitForElement(this.mainContainer, TIMEOUTS.ELEMENT_VISIBLE);
  }

  async searchByIcon(term: string, urlPattern: RegExp = /search/i): Promise<void> {
    await this.waits.waitForElement(this.iconSearchInput, TIMEOUTS.ELEMENT_VISIBLE);
    await this.elements.enterText(this.iconSearchInput, term);
    await this.waits.waitForElement(this.iconSearchButton, TIMEOUTS.ELEMENT_VISIBLE);
    await this.elements.clickElement(this.iconSearchButton);
    await this.waits.waitForUrlMatches(urlPattern, TIMEOUTS.PAGE_LOAD_SLOW);
    await this.waits.waitForElement(this.mainContainer, TIMEOUTS.ELEMENT_VISIBLE);
  }

  async getSearchPlaceholder(): Promise<string | null> {
    await this.waits.waitForElement(this.iconSearchInput, TIMEOUTS.ELEMENT_VISIBLE);
    return this.elements.getAttribute(this.iconSearchInput, 'placeholder');
  }

  async submitEmptySearch(): Promise<void> {
    await this.waits.waitForElement(this.iconSearchInput, TIMEOUTS.ELEMENT_VISIBLE);
    await this.elements.enterText(this.iconSearchInput, '');
    await this.elements.pressKey('Enter');
    // An empty term is a client-side no-op — no navigation fires, so this wait is
    // expected to time out; it just gives any unexpected navigation a chance to
    // complete before the caller reads the URL.
    await this.waits.waitForUrlMatches(/search|catalogsearch/i, TIMEOUTS.TIMEOUT_SHORT).catch(() => {});
  }

  async waitForSearchResults(): Promise<void> {
    await this.waits.waitForCustomCondition(
      async () => (await this.dom.count(this.productCardSelector)) > 0,
      { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST }
    );
  }

  async getResultCount(): Promise<number> {
    return this.dom.count(this.productCardSelector);
  }
}
