import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe('Ecommerce Search Regression @ecommerce @regression @search', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-002-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} search placeholder text is correct`, async ({ ecommerceSearchPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} search placeholder`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceSearchPage.navigateToHome(site.url);
      });

      await logger.step('Step 2 - Assert search placeholder matches expected text', async () => {
        const placeholder = await ecommerceSearchPage.getSearchPlaceholder();
        logger.verify(`${site.name} search placeholder`, site.searchPlaceholder, placeholder);
        expect(placeholder, `${site.name} search input placeholder`).toBe(site.searchPlaceholder);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-003-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} empty search term does not navigate`, async ({ ecommerceSearchPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} empty search`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceSearchPage.navigateToHome(site.url);
      });

      const urlBefore = await ecommerceSearchPage.getCurrentUrl();

      await logger.step('Step 2 - Submit empty search term', async () => {
        await ecommerceSearchPage.submitEmptySearch();
      });

      await logger.step('Step 3 - Assert URL is unchanged', async () => {
        const urlAfter = await ecommerceSearchPage.getCurrentUrl();
        logger.verify(`${site.name} URL unchanged after empty search submit`, urlBefore, urlAfter);
        expect(urlAfter, `${site.name} URL unchanged after empty search submit`).toBe(urlBefore);
      });
    });
  }

  // Runs on every storefront with no capability gate: autocomplete was confirmed present
  // on all 8, so a site returning zero suggestions is a real regression.
  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-SRCH-005-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} autocomplete suggestions appear while typing`, async ({ ecommerceSearchPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} autocomplete suggestions`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceSearchPage.navigateToHome(site.url);
      });

      await logger.step('Step 2 - Assert no suggestions before typing', async () => {
        const countBefore = await ecommerceSearchPage.getProductSuggestionCount();
        logger.verify(`${site.name} product suggestion count before typing`, 0, countBefore);
        expect(countBefore, `${site.name} product suggestion count before typing`).toBe(0);
      });

      await logger.step('Step 3 - Type search term into header search input', async () => {
        await ecommerceSearchPage.typeSearchTerm(site.searchTerm);
      });

      await logger.step('Step 4 - Assert autocomplete suggestions appear', async () => {
        await ecommerceSearchPage.waitForAutocompleteSuggestions();
        const countAfter = await ecommerceSearchPage.getProductSuggestionCount();
        logger.verify(`${site.name} product suggestion count after typing is greater than 0`, true, countAfter > 0);
        expect(countAfter, `${site.name} product suggestion count after typing`).toBeGreaterThan(0);
      });
    });
  }
});
