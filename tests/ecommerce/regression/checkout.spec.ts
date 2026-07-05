import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';
import {
  getPreferredNavLabel,
  navigateToPlp,
  shouldPreferMens,
  ensureCartOverlayOpen,
  findProductWithAvailableSizes,
  selectFirstPurchasableSize,
} from '../smoke/smoke-helpers';

test.describe('Ecommerce Checkout Regression @regression @ecommerce', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CHKOUT-001-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Checkout page loads after items added to cart`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Checkout page loads after items added to cart`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      logger.step('Steps 1-5 - Navigate to PLP');
      await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

      logger.step('Step 6 - Scan PLP for a product with available sizes');
      const availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      logger.step('Step 7 - Capture initial mini cart count before ATC');
      const initialCartCount = await ecommercePDPPage.getMiniCartCount();
      logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));

      logger.step('Step 8 - Select a size that enables Add to Cart (try up to 3)');
      const targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
      if (targetSize === null) {
        test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      logger.step(`Step 9 - Click Add to Cart with size "${targetSize}" selected`);
      await ecommercePDPPage.addToCart();

      logger.step('Step 10 - Poll for mini cart count to increment after ATC');
      const postAddCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);

      logger.step('Step 11 - Assert cart count incremented by 1 (precondition for checkout check)');
      expect(
        postAddCount,
        `${site.name}: Cart count must increment by 1 after ATC before checkout check is meaningful (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${postAddCount})`,
      ).toBe(initialCartCount + 1);

      logger.step('Step 12 - Open the mini cart overlay');
      await ensureCartOverlayOpen(ecommerceCartOverlayPage);

      logger.step('Step 13 - Click CHECKOUT CTA in the mini cart overlay');
      await ecommerceCheckoutPage.clickCheckoutCtaFromOverlay();

      logger.step('Step 14 - Wait for checkout to load');
      await ecommerceCheckoutPage.waitForCheckoutLoad();

      logger.step('Step 15 - Assert checkout page has loaded');
      const onCheckoutPage = await ecommerceCheckoutPage.isOnCheckoutPage();
      logger.verify('Checkout page loaded', 'true', String(onCheckoutPage));
      expect(
        onCheckoutPage,
        `${site.name}: Checkout page (or guest-checkout auth modal) should be reachable after adding an item to cart`,
      ).toBeTruthy();
    });
  }
});
