import { test, expect, softExpect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';
import { navigateToPlp, findProductWithAvailableSizes, getPreferredNavLabel, shouldPreferMens } from './smoke-helpers';

test.describe('Ecommerce Error Handling Smoke @ecommerce @smoke @error-handling', () => {
  // These SPA staging sites need extra time to hydrate, especially in Firefox
  test.slow();

  for (const site of storefronts) {
    test(`E2E-ERR-001 - ${site.name} 404 page shows brand error UI with Back to Home`, async ({
      ecommerceErrorPage,
    }) => {
      const logger = createTestLogger(`E2E-ERR-001 - ${site.name} 404 page`);

      logger.step('Step 1 - Navigate to a non-existent URL');
      await ecommerceErrorPage.navigateToNotFound(site.url);

      logger.step('Step 2 - Assert Back to Home button visible');
      await ecommerceErrorPage.assertBackToHomeVisible();

      logger.step('Step 3 - Assert brand error UI visible');
      await ecommerceErrorPage.assertBrandErrorUiVisible(site.brandName, site.name);
    });
  }

  for (const site of storefronts) {
    test(`E2E-ERR-003 - ${site.name} - Add to Cart without size shows validation`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`E2E-ERR-003 - ${site.name} - Add to Cart without size shows validation`);

      logger.step('Step 1 - Determine preferred nav label');
      const preferMens = shouldPreferMens(site);
      const navLabel = getPreferredNavLabel(site, preferMens);
      if (!navLabel) {
        test.skip(true, `${site.name}: no nav label configured`);
        return;
      }

      logger.step('Step 2 - Navigate to PLP');
      await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

      logger.step('Step 3 - Find product with available sizes and land on PDP');
      const availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found on PLP`);
        return;
      }

      logger.step('Step 4 - Dismiss overlay if present');
      await ecommercePDPPage.ensureNoOverlay();

      logger.step('Step 5 - Read initial cart count');
      const initialCartCount = await ecommercePDPPage.getMiniCartCount();

      logger.step('Step 6 - Click Add to Cart without selecting a size');
      await ecommercePDPPage.addToCart();

      logger.step('Step 7 - Assert size validation message appears');
      expect(
        await ecommercePDPPage.hasSizeValidationMessage(),
        'Expected size validation message after ATC without size selection',
      ).toBe(true);

      logger.step('Step 8 - Assert cart count did not increase (secondary signal)');
      softExpect(await ecommercePDPPage.getMiniCartCount()).toBe(initialCartCount);
    });
  }
});
