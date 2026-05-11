import { test } from '@config/base-test';
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
});
