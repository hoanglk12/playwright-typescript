import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe('Ecommerce Search Smoke @ecommerce @smoke @search', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-001-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} search returns results for known product`, async ({ ecommerceSearchPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} search`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceSearchPage.navigateToHome(site.url);
      });

      await logger.step('Step 2 - Type search term and submit', async () => {
        await ecommerceSearchPage.search(site.searchTerm, site.searchResultUrlPattern);
      });

      await logger.step('Step 3 - Wait for product results to render', async () => {
        await ecommerceSearchPage.waitForSearchResults();
      });

      await logger.step('Step 4 - Assert at least one result is returned', async () => {
        const count = await ecommerceSearchPage.getResultCount();
        logger.verify(`${site.name} search for "${site.searchTerm}" returns results`, true, count > 0);
        expect(count, `Expected search results for "${site.searchTerm}" on ${site.name}`).toBeGreaterThan(0);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-006-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} clicking search icon submits search`, async ({ ecommerceSearchPage, softAssert }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} icon-click search submit`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceSearchPage.navigateToHome(site.url);
      });

      const expectedUrlPattern = site.searchResultUrlPattern ?? /search/i;

      await logger.step('Step 2 - Type search term and click the search icon', async () => {
        await ecommerceSearchPage.searchByIcon(site.searchTerm, site.searchResultUrlPattern);
      });

      await logger.step('Step 3 - Assert URL navigated to search results', async () => {
        const currentUrl = await ecommerceSearchPage.getCurrentUrl();
        softAssert.toMatch(currentUrl, expectedUrlPattern, `${site.name} URL navigated to search results`);
      });

      await logger.step('Step 4 - Wait for product results to render', async () => {
        await ecommerceSearchPage.waitForSearchResults();
      });

      await logger.step('Step 5 - Assert at least one result is returned', async () => {
        const count = await ecommerceSearchPage.getResultCount();
        softAssert.toBeGreaterThan(count, 0, `${site.name} icon-click search returns results`);
      });
    });
  }
});
