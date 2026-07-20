import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';
import { getPreferredNavLabel, navigateToPlp } from './smoke-helpers';

test.describe('Ecommerce PLP Smoke @ecommerce @smoke @plp', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PLP-001-${String(index + 1).padStart(3, '0')}`;
    const navLabel = getPreferredNavLabel(site);

    test(`${tcId} - ${site.name} PLP loads with product grid visible`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} PLP`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      await logger.step('Step 6 - Assert product count is greater than zero', async () => {
        const count = await ecommercePLPPage.getProductCount();
        logger.verify(`${site.name} PLP product count > 0`, '>0', String(count));
        expect(count, `Expected at least 1 product card on the PLP for ${site.name}`).toBeGreaterThan(0);
      });
    });

    const filterTcId = `E2E-PLP-004-${String(index + 1).padStart(3, '0')}`;
    const filterNavLabel = getPreferredNavLabel(site);

    test(`${filterTcId} - ${site.name} filter by category reduces product count`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${filterTcId} - ${site.name} PLP Category Filter`);

      if (!filterNavLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      let initialCount = 0;
      let filteredCount = 0;

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, filterNavLabel);
      });

      await logger.step('Step 6 - Capture initial product count', async () => {
        initialCount = await ecommercePLPPage.getTotalProductCount();
        logger.verify('Initial total product count > 0', '>0', String(initialCount));
        expect(initialCount, 'Expected at least 1 product before filtering').toBeGreaterThan(0);
      });

      await logger.step(`Step 7 - Apply category filter "${site.categoryFilterLabel}"`, async () => {
        await ecommercePLPPage.applyCategoryFilter(site.categoryFilterLabel);
      });

      await logger.step('Step 8 - Wait for filter to take effect', async () => {
        await ecommercePLPPage.waitForCategoryFilterApplied(site.categoryFilterLabel, initialCount);
      });

      await logger.step('Step 9 - Capture filtered total product count', async () => {
        filteredCount = await ecommercePLPPage.getTotalProductCount();
      });

      await logger.step('Step 10 - Assert filtered total count is strictly less than initial count', async () => {
        softAssert.toBeLessThan(
          filteredCount,
          initialCount,
          `Category filter "${site.categoryFilterLabel}" on ${site.name} reduces product count`,
        );
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const sizeTcId = `E2E-PLP-006-${String(index + 1).padStart(3, '0')}`;
    const sizeNavLabel = getPreferredNavLabel(site);

    test(`${sizeTcId} - ${site.name} filter by size reduces product count`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      softAssert,
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

      let initialCount = 0;
      let filteredCount = 0;

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, sizeNavLabel);
      });

      await logger.step('Step 6 - Capture initial product count', async () => {
        initialCount = await ecommercePLPPage.getTotalProductCount();
        logger.verify('Initial total product count > 0', '>0', String(initialCount));
        expect(initialCount, 'Expected at least 1 product before filtering').toBeGreaterThan(0);
      });

      await logger.step(`Step 7 - Apply size filter "${sizeLabel}"`, async () => {
        await ecommercePLPPage.applySizeFilter(sizeLabel);
      });

      await logger.step('Step 8 - Wait for size filter to take effect', async () => {
        await ecommercePLPPage.waitForSizeFilterApplied(sizeLabel, initialCount);
      });

      await logger.step('Step 9 - Capture filtered total product count', async () => {
        filteredCount = await ecommercePLPPage.getTotalProductCount();
      });

      await logger.step('Step 10 - Assert filtered total count < initial count', async () => {
        softAssert.toBeLessThan(
          filteredCount,
          initialCount,
          `Size filter "${sizeLabel}" on ${site.name} reduces product count`,
        );
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const quickAddTcId = `E2E-PLP-011-${String(index + 1).padStart(3, '0')}`;
    const quickAddNavLabel = getPreferredNavLabel(site);

    test(`${quickAddTcId} - ${site.name} Quick Add button opens size selector or adds item`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${quickAddTcId} - ${site.name} Quick Add`);

      if (!quickAddNavLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, quickAddNavLabel);
      });

      await logger.step('Step 6 - Hover over first product card and click Quick Add button', async () => {
        await ecommercePLPPage.quickAdd(0);
      });

      await logger.step('Step 7 - Assert size selector overlay is visible', async () => {
        const sizeSelectorVisible = await ecommercePLPPage.isSizeSelectorVisible();
        logger.verify('Size selector is visible after Quick Add click', 'true', String(sizeSelectorVisible));
        expect(
          sizeSelectorVisible,
          `Quick Add on ${site.name} should open a size selector overlay`,
        ).toBe(true);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const pdpTcId = `E2E-PLP-012-${String(index + 1).padStart(3, '0')}`;
    const pdpNavLabel = getPreferredNavLabel(site);

    test(`${pdpTcId} - ${site.name} clicking product card image navigates to PDP`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      page,
    }) => {
      const logger = createTestLogger(`${pdpTcId} - ${site.name} Product Card → PDP`);

      if (!pdpNavLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, pdpNavLabel);
      });

      await logger.step('Step 6 - Click first product card image/link', async () => {
        await ecommercePLPPage.clickProductCard(0);
      });

      await logger.step('Step 7 - Wait for PDP URL to resolve', async () => {
        await ecommercePLPPage.waitForPdpUrl();
      });

      await logger.step('Step 8 - Assert URL matches PDP pattern', async () => {
        const currentUrl = page.url();
        logger.verify(`${site.name} PDP URL matches pattern`, 'PDP URL pattern', currentUrl);
        expect(currentUrl, `Expected PDP URL on ${site.name} but got: ${currentUrl}`).toMatch(
          /(\/product\/|\/p\/|\/pdp\/|\.html)/i,
        );
      });
    });
  }
});
