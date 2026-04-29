import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe.serial('Ecommerce Search Smoke @ecommerce @smoke @search', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-001-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} search returns results for known product`, async ({ ecommerceSearchPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} search`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceSearchPage.navigateToHome(site.url);

      logger.step('Step 2 - Type search term and submit');
      await ecommerceSearchPage.search(site.searchTerm, site.searchResultUrlPattern);

      logger.step('Step 3 - Wait for product results to render');
      await ecommerceSearchPage.waitForSearchResults();

      logger.step('Step 4 - Assert at least one result is returned');
      const count = await ecommerceSearchPage.getResultCount();
      logger.verify(`${site.name} search for "${site.searchTerm}" returns results`, true, count > 0);
      expect(count, `Expected search results for "${site.searchTerm}" on ${site.name}`).toBeGreaterThan(0);
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-006-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} clicking search icon submits search`, async ({ ecommerceSearchPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} icon-click search submit`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceSearchPage.navigateToHome(site.url);

      const expectedUrlPattern = site.searchResultUrlPattern ?? /search/i;

      logger.step('Step 2 - Type search term and click the search icon');
      await ecommerceSearchPage.searchByIcon(site.searchTerm, site.searchResultUrlPattern);

      logger.step('Step 3 - Assert URL navigated to search results');
      const currentUrl = await ecommerceSearchPage.getCurrentUrl();
      logger.verify(`${site.name} URL matches ${expectedUrlPattern} after icon click`, `matches ${expectedUrlPattern}`, currentUrl);
      expect(currentUrl, `Expected ${site.name} to navigate to a search results URL`).toMatch(expectedUrlPattern);

      logger.step('Step 4 - Wait for product results to render');
      await ecommerceSearchPage.waitForSearchResults();

      logger.step('Step 5 - Assert at least one result is returned');
      const count = await ecommerceSearchPage.getResultCount();
      logger.verify(`${site.name} icon-click search for "${site.searchTerm}" returns results`, true, count > 0);
      expect(count, `Expected icon-click search results for "${site.searchTerm}" on ${site.name}`).toBeGreaterThan(0);
    });
  }
});
