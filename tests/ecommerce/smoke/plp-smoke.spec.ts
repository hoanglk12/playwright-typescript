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

  for (const [index, site] of storefronts.entries()) {
    const sizeTcId = `E2E-PLP-006-${String(index + 1).padStart(3, '0')}`;
    const sizeNavLabel = site.womensNavLabel ?? site.mensNavLabel ?? site.kidsNavLabel ?? site.saleNavLabel;

    test(`${sizeTcId} - ${site.name} filter by size reduces product count`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${sizeTcId} - ${site.name} PLP Size Filter`);

      if (!sizeNavLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      const sizeLabel = site.sizeFilterLabel;
      if (!sizeLabel) {
        test.skip(true, `${site.name} has no sizeFilterLabel configured`);
        return;
      }

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for SPA nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step(`Step 3 - Click "${sizeNavLabel}" nav link to enter PLP`);
      await ecommerceNavPage.clickNavLink(sizeNavLabel);

      logger.step('Step 4 - Wait for PLP URL to resolve');
      await ecommercePLPPage.waitForPlpUrl();

      logger.step('Step 5 - Wait for product grid to render');
      await ecommercePLPPage.waitForProductGrid();

      logger.step('Step 6 - Capture initial product count');
      const initialCount = await ecommercePLPPage.getTotalProductCount();
      logger.verify('Initial total product count > 0', '>0', String(initialCount));
      expect(initialCount, 'Expected at least 1 product before filtering').toBeGreaterThan(0);

      logger.step(`Step 7 - Apply size filter "${sizeLabel}"`);
      await ecommercePLPPage.applySizeFilter(sizeLabel);

      logger.step('Step 8 - Wait for size filter to take effect');
      await ecommercePLPPage.waitForSizeFilterApplied(sizeLabel, initialCount);

      logger.step('Step 9 - Capture filtered total product count');
      const filteredCount = await ecommercePLPPage.getTotalProductCount();

      logger.step('Step 10 - Assert filtered total count < initial count');
      logger.verify('Filtered total < Initial total', `< ${initialCount}`, String(filteredCount));
      expect(
        filteredCount,
        `Size filter "${sizeLabel}" on ${site.name} should reduce total product count`,
      ).toBeLessThan(initialCount);
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const quickAddTcId = `E2E-PLP-011-${String(index + 1).padStart(3, '0')}`;
    const quickAddNavLabel = site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel;

    test(`${quickAddTcId} - ${site.name} Quick Add button opens size selector or adds item`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${quickAddTcId} - ${site.name} Quick Add`);

      if (!quickAddNavLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for SPA nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step(`Step 3 - Click "${quickAddNavLabel}" nav link to enter PLP`);
      await ecommerceNavPage.clickNavLink(quickAddNavLabel);

      logger.step('Step 4 - Wait for PLP URL to resolve');
      await ecommercePLPPage.waitForPlpUrl();

      logger.step('Step 5 - Wait for product grid to render');
      await ecommercePLPPage.waitForProductGrid();

      logger.step('Step 6 - Hover over first product card and click Quick Add button');
      await ecommercePLPPage.quickAdd(0);

      logger.step('Step 7 - Assert size selector overlay is visible');
      const sizeSelectorVisible = await ecommercePLPPage.isSizeSelectorVisible();
      logger.verify('Size selector is visible after Quick Add click', 'true', String(sizeSelectorVisible));
      expect(
        sizeSelectorVisible,
        `Quick Add on ${site.name} should open a size selector overlay`,
      ).toBe(true);
    });
  }
});
