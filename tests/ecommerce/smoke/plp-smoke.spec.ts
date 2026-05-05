import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe.serial('Ecommerce PLP Smoke @ecommerce @smoke @plp', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PLP-001-${String(index + 1).padStart(3, '0')}`;
    // Prefer women's nav link; fall back to sale for sites without one (e.g. Platypus NZ)
    const navLabel = site.womensNavLabel ?? site.saleNavLabel;

    test(`${tcId} - ${site.name} PLP loads with product grid visible`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} PLP`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for SPA nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step(`Step 3 - Click "${navLabel}" nav link to enter PLP`);
      await ecommerceNavPage.clickNavLink(navLabel);

      logger.step('Step 4 - Wait for PLP URL to resolve');
      await ecommercePLPPage.waitForPlpUrl();

      logger.step('Step 5 - Wait for product grid to render');
      await ecommercePLPPage.waitForProductGrid();

      logger.step('Step 6 - Assert product count is greater than zero');
      const count = await ecommercePLPPage.getProductCount();
      logger.verify(`${site.name} PLP product count > 0`, '>0', String(count));
      expect(count, `Expected at least 1 product card on the PLP for ${site.name}`).toBeGreaterThan(0);
    });

    const filterTcId = `E2E-PLP-004-${String(index + 1).padStart(3, '0')}`;
    const filterNavLabel = site.womensNavLabel ?? site.mensNavLabel ?? site.kidsNavLabel ?? site.saleNavLabel;

    test(`${filterTcId} - ${site.name} filter by category reduces product count`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${filterTcId} - ${site.name} PLP Category Filter`);

      if (!filterNavLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for SPA nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step(`Step 3 - Click "${filterNavLabel}" nav link to enter PLP`);
      await ecommerceNavPage.clickNavLink(filterNavLabel);

      logger.step('Step 4 - Wait for PLP URL to resolve');
      await ecommercePLPPage.waitForPlpUrl();

      logger.step('Step 5 - Wait for product grid to render');
      await ecommercePLPPage.waitForProductGrid();

      logger.step('Step 6 - Capture initial product count');
      const initialCount = await ecommercePLPPage.getTotalProductCount();
      logger.verify('Initial total product count > 0', '>0', String(initialCount));
      expect(initialCount, 'Expected at least 1 product before filtering').toBeGreaterThan(0);

      logger.step(`Step 7 - Apply category filter "${site.categoryFilterLabel}"`);
      await ecommercePLPPage.applyCategoryFilter(site.categoryFilterLabel);

      logger.step('Step 8 - Wait for filter to take effect');
      await ecommercePLPPage.waitForCategoryFilterApplied(site.categoryFilterLabel, initialCount);

      logger.step('Step 9 - Capture filtered total product count');
      const filteredCount = await ecommercePLPPage.getTotalProductCount();

      logger.step('Step 10 - Assert filtered total count is strictly less than initial count');
      logger.verify(
        `Filtered total < Initial total`,
        `${filteredCount} < ${initialCount}`,
        String(filteredCount < initialCount),
      );
      expect(
        filteredCount,
        `Category filter "${site.categoryFilterLabel}" on ${site.name} should reduce total product count`,
      ).toBeLessThan(initialCount);
    });
  }
});
