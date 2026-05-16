import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe.serial('Ecommerce PDP Smoke @ecommerce @smoke @pdp', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-001-${String(index + 1).padStart(3, '0')}`;
    const navLabel = site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel;

    test(`${tcId} - ${site.name} PDP loads with product name, price, and image gallery`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} PDP`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
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

      logger.step('Step 6 - Click first product card');
      await ecommercePLPPage.clickProductCard(0);

      logger.step('Step 7 - Wait for PDP to fully load');
      await ecommercePDPPage.waitForPdpLoad();

      logger.step('Step 8 - Assert product name is non-empty');
      const productName = await ecommercePDPPage.getProductName();
      softAssert.toBeGreaterThan(productName.length, 0, `${site.name}: Product name should be non-empty`);

      logger.step('Step 9 - Assert price is non-empty');
      const price = await ecommercePDPPage.getPrice();
      softAssert.toBeGreaterThan(price.length, 0, `${site.name}: Price should be non-empty`);

      logger.step('Step 10 - Assert image gallery is visible');
      const galleryVisible = await ecommercePDPPage.isImageGalleryVisible();
      softAssert.toBe(galleryVisible, true, `${site.name}: Image gallery should be visible`);
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-002-${String(index + 1).padStart(3, '0')}`;
    const navLabel = site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel;

    test(`${tcId} - ${site.name} Colour swatch selection updates product images`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Colour swatch`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured`);
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

      const MAX_PRODUCTS_TO_TRY = 20;
      logger.step(`Step 6 - Find a PDP with 2+ colour swatches (try up to ${MAX_PRODUCTS_TO_TRY} product cards)`);
      let swatchCount = 0;
      for (let productIndex = 0; productIndex < MAX_PRODUCTS_TO_TRY; productIndex++) {
        await ecommercePLPPage.clickProductCard(productIndex);
        await ecommercePDPPage.waitForPdpLoad();
        swatchCount = await ecommercePDPPage.getColourSwatchCount();
        if (swatchCount >= 2) break;
        if (productIndex < MAX_PRODUCTS_TO_TRY - 1) {
          await ecommercePDPPage.goBack();
          await ecommercePLPPage.waitForPlpUrl();
          await ecommercePLPPage.waitForProductGrid();
        }
      }

      if (swatchCount < 2) {
        test.skip(
          true,
          `${site.name}: no product with 2+ colour swatches found in first ${MAX_PRODUCTS_TO_TRY} MEN PLP products`,
        );
        return;
      }

      logger.step('Step 7 - Capture initial PDP URL');
      const initialUrl = await ecommercePDPPage.getCurrentUrl();

      logger.step('Step 8 - Click a different colour swatch');
      await ecommercePDPPage.clickColourSwatch(0);

      logger.step('Step 9 - Wait for colour variant PDP to load');
      await ecommercePDPPage.waitForVariantNavigation(initialUrl);

      logger.step('Step 10 - Assert URL changed and gallery images visible on variant PDP');
      const variantUrl = await ecommercePDPPage.getCurrentUrl();
      softAssert.toBe(
        variantUrl !== initialUrl,
        true,
        `${site.name}: URL should change to colour variant after swatch click`,
      );
      const galleryVisible = await ecommercePDPPage.isImageGalleryVisible();
      softAssert.toBe(galleryVisible, true, `${site.name}: Variant PDP gallery images should be visible`);
      logger.verify('Colour variant navigation', 'URL changed', variantUrl !== initialUrl ? 'changed' : 'unchanged');
    });
  }
});
