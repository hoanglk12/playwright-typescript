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
});
