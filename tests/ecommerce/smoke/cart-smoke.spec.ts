import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';
import { getPreferredNavLabel, navigateToPlp } from './smoke-helpers';

test.describe('Ecommerce Cart Smoke @ecommerce @smoke @cart', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-001-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Mini cart shows 0 items on fresh session`, async ({
      ecommerceNavPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart empty`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for SPA nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Get mini cart count');
      const count = await ecommercePDPPage.getMiniCartCount();
      logger.verify('Mini cart count on fresh session', '0', String(count));

      logger.step('Step 4 - Assert mini cart count is 0');
      expect(count).toBe(0);
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-002-${String(index + 1).padStart(3, '0')}`;
    const preferMens = site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Mini cart shows item count after Add to Cart`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart shows item count after ATC`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      logger.step('Steps 1-5 - Navigate to PLP');
      await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

      // Scan up to 5 products on the initial PLP for one with available (non-sold-out) sizes.
      // Quick check per product (no extended wait in loop); sold-out and non-footwear products are
      // both handled by the immediate getAvailableSizes() returning []. The final
      // waitForSizeButtonsToRender() on the last product covers timing edge cases where sizes render
      // asynchronously after the heading appears (observed on Skechers AU under batch load).
      logger.step('Step 6 - Scan initial PLP for a product with available sizes (up to 5)');
      const MAX_PRODUCTS_PER_NAV = 5;
      let availableSizes: string[] = [];

      for (let i = 0; i < MAX_PRODUCTS_PER_NAV; i++) {
        if (i > 0) {
          await ecommercePDPPage.goBack();
          await ecommercePLPPage.waitForPlpUrl();
          await ecommercePLPPage.waitForProductGrid();
        }
        await ecommercePLPPage.clickProductCard(i);
        await ecommercePDPPage.waitForPdpLoad();
        await ecommercePDPPage.ensureNoOverlay();
        availableSizes = await ecommercePDPPage.getAvailableSizes();
        if (availableSizes.length > 0) break;
      }

      // If scan returned empty, give the current PDP a full wait — covers both timing lag
      // (sizes render after heading) and sold-out products on last attempted product.
      if (availableSizes.length === 0) {
        await ecommercePDPPage.waitForSizeButtonsToRender();
        availableSizes = await ecommercePDPPage.getAvailableSizes();
      }

      if (availableSizes.length === 0) {
        test.skip(
          true,
          `${site.name}: no product with enabled sizes found in first ${MAX_PRODUCTS_PER_NAV} ${navLabel} PLP products`,
        );
        return;
      }

      logger.step('Step 11 - Capture initial mini cart count before ATC');
      const initialCartCount = await ecommercePDPPage.getMiniCartCount();
      logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // Try up to 3 sizes and stop at the first that actually enables Add to Cart.
      logger.step('Step 12 - Select a size that enables Add to Cart (try up to 3)');
      let targetSize: string | null = null;
      let atcEnabled = false;
      for (const size of availableSizes.slice(0, 3)) {
        await ecommercePDPPage.selectSize(size);
        atcEnabled = await ecommercePDPPage.isAddToCartEnabled();
        if (atcEnabled) {
          targetSize = size;
          break;
        }
      }
      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`,
        );
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      logger.step(`Step 13 - Click Add to Cart with size "${targetSize}" selected`);
      await ecommercePDPPage.addToCart();

      logger.step('Step 14 - Poll for mini cart count to increment');
      const finalCartCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);

      logger.step('Step 15 - Assert mini cart count incremented by exactly 1');
      softAssert.toBe(
        finalCartCount,
        initialCartCount + 1,
        `${site.name}: Mini cart count should increment by 1 after Add to Cart (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${finalCartCount})`,
      );
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-003-${String(index + 1).padStart(3, '0')}`;
    const preferMens =
      site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Mini cart overlay opens on cart icon click`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart overlay opens`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      logger.step('Steps 1-5 - Navigate to PLP');
      await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

      // Scan up to 5 products on the initial PLP for one with available (non-sold-out) sizes.
      // Quick check per product (no extended wait in loop); sold-out and non-footwear products
      // are both handled by the immediate getAvailableSizes() returning []. The final
      // waitForSizeButtonsToRender() on the last product covers timing edge cases where sizes
      // render asynchronously after the heading appears.
      logger.step('Step 6 - Scan initial PLP for a product with available sizes (up to 5)');
      const MAX_PRODUCTS_PER_NAV = 5;
      let availableSizes: string[] = [];

      for (let i = 0; i < MAX_PRODUCTS_PER_NAV; i++) {
        if (i > 0) {
          await ecommercePDPPage.goBack();
          await ecommercePLPPage.waitForPlpUrl();
          await ecommercePLPPage.waitForProductGrid();
        }
        await ecommercePLPPage.clickProductCard(i);
        await ecommercePDPPage.waitForPdpLoad();
        await ecommercePDPPage.ensureNoOverlay();
        availableSizes = await ecommercePDPPage.getAvailableSizes();
        if (availableSizes.length > 0) break;
      }

      // If scan returned empty, give the current PDP a full wait — covers both timing lag
      // (sizes render after heading) and sold-out products on last attempted product.
      if (availableSizes.length === 0) {
        await ecommercePDPPage.waitForSizeButtonsToRender();
        availableSizes = await ecommercePDPPage.getAvailableSizes();
      }

      if (availableSizes.length === 0) {
        test.skip(
          true,
          `${site.name}: no product with enabled sizes found in first ${MAX_PRODUCTS_PER_NAV} ${navLabel} PLP products`,
        );
        return;
      }

      logger.step('Step 11 - Capture initial mini cart count before ATC');
      const initialCartCount = await ecommercePDPPage.getMiniCartCount();
      logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // Try up to 3 sizes and stop at the first that actually enables Add to Cart.
      logger.step('Step 12 - Select a size that enables Add to Cart (try up to 3)');
      let targetSize: string | null = null;
      let atcEnabled = false;
      for (const size of availableSizes.slice(0, 3)) {
        await ecommercePDPPage.selectSize(size);
        atcEnabled = await ecommercePDPPage.isAddToCartEnabled();
        if (atcEnabled) {
          targetSize = size;
          break;
        }
      }
      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`,
        );
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      logger.step(`Step 13 - Click Add to Cart with size "${targetSize}" selected`);
      await ecommercePDPPage.addToCart();

      logger.step('Step 14 - Poll for mini cart count to increment');
      await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);

      logger.step('Step 15 - Check if mini cart overlay auto-opened after ATC');
      const autoOpened = await ecommerceCartOverlayPage.isOverlayVisible();

      logger.step('Step 16 - If overlay not auto-opened, click cart icon to open it');
      if (!autoOpened) {
        await ecommerceCartOverlayPage.clickCartIcon();
        await ecommerceCartOverlayPage.waitForOverlayVisible();
      }

      logger.step('Step 17 - Assert mini cart overlay is visible');
      const overlayVisible = await ecommerceCartOverlayPage.isOverlayVisible();
      softAssert.toBeTruthy(overlayVisible, `${site.name}: Mini cart overlay should be visible`);
    });
  }
});
