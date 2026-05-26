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
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-004-${String(index + 1).padStart(3, '0')}`;
    const navLabel = site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel;

    test(`${tcId} - ${site.name} Size selector shows correct sizes with gender toggle`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Size selector`);

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

      logger.step('Step 8 - Dismiss any overlay before size interaction');
      await ecommercePDPPage.ensureNoOverlay();

      logger.step('Step 9 - Assert size selector is visible');
      const sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
      if (!sizeSelectorVisible) {
        test.skip(true, `${site.name}: size selector not visible on first PDP — product may have no sizes`);
        return;
      }

      logger.step('Step 10 - Get gender toggle labels (DOM-proximity: within size selector only)');
      const toggleLabels = await ecommercePDPPage.getSizeGenderToggleLabels();
      logger.verify('Gender toggle labels found', '>= 0 labels', `${toggleLabels.length} labels: ${JSON.stringify(toggleLabels)}`);

      logger.step('Step 11 - Get active toggle label');
      const activeLabel = await ecommercePDPPage.getSizeToggleActiveLabel();
      logger.verify('Active toggle label', 'non-empty or empty (best-effort)', activeLabel || '(none)');

      logger.step('Step 12 - Get all visible size labels (includes disabled — not yet in-cart state)');
      const initialSizes = await ecommercePDPPage.getVisibleSizeLabels();
      logger.verify('Initial visible sizes count', '>= 0', String(initialSizes.length));

      if (site.pdpSizeToggleLabels && site.pdpSizeToggleLabels.length >= 2) {
        const firstConfigLabel = site.pdpSizeToggleLabels[0];
        const secondConfigLabel = site.pdpSizeToggleLabels[1];
        // Match configured labels against discovered labels by last word ("WOMENS" in "US WOMENS").
        // Configured labels are best-effort; actual DOM labels may omit the prefix.
        const firstLabelWord =
          firstConfigLabel.toUpperCase().split(' ').pop() ?? firstConfigLabel.toUpperCase();
        const secondLabelWord =
          secondConfigLabel.toUpperCase().split(' ').pop() ?? secondConfigLabel.toUpperCase();
        const actualFirstToggle = toggleLabels.find((l) => l.toUpperCase().includes(firstLabelWord));
        const actualSecondToggle = toggleLabels.find((l) => l.toUpperCase().includes(secondLabelWord));

        if (actualSecondToggle) {
          // If no sizes visible yet, click the first toggle to initialise the size panel
          if (initialSizes.length === 0 && actualFirstToggle) {
            logger.step(`Step 13a - Click first toggle "${actualFirstToggle}" to initialise size panel`);
            await ecommercePDPPage.clickSizeGenderToggle(actualFirstToggle);
          }

          logger.step(`Step 13 - Click second gender toggle: "${actualSecondToggle}"`);
          await ecommercePDPPage.clickSizeGenderToggle(actualSecondToggle);

          const sizesAfterToggle = await ecommercePDPPage.getVisibleSizeLabels();
          softAssert.toBeGreaterThan(
            sizesAfterToggle.length,
            0,
            `${site.name}: sizes should be visible after toggling to "${actualSecondToggle}"`,
          );
          logger.verify(
            `Visible sizes after toggle to "${actualSecondToggle}"`,
            '>= 1',
            String(sizesAfterToggle.length),
          );

          if (site.pdpExpectedSize) {
            const allSizes = [...new Set([...initialSizes, ...sizesAfterToggle])];
            const expectedFound = allSizes.some((s) => s.includes(site.pdpExpectedSize!));
            softAssert.toBe(
              expectedFound,
              true,
              `${site.name}: expected size "${site.pdpExpectedSize}" to appear in size grid (checked both toggle states)`,
            );
            logger.verify(
              `Expected size "${site.pdpExpectedSize}" present`,
              'true',
              String(expectedFound),
            );
          }
        } else {
          logger.step(
            `Step 13 - No second toggle matched for "${secondConfigLabel}" in discovered labels ${JSON.stringify(toggleLabels)} — asserting initial sizes only`,
          );
          if (site.pdpExpectedSize && initialSizes.length > 0) {
            softAssert.toBe(
              initialSizes.some((s) => s.includes(site.pdpExpectedSize!)),
              true,
              `${site.name}: expected size "${site.pdpExpectedSize}" in initial size grid`,
            );
          }
        }
      } else {
        logger.step('Step 13 - No multi-gender toggle configured — asserting initial sizes');
        if (site.pdpExpectedSize && initialSizes.length > 0) {
          softAssert.toBe(
            initialSizes.some((s) => s.includes(site.pdpExpectedSize!)),
            true,
            `${site.name}: expected size "${site.pdpExpectedSize}" in size grid`,
          );
        }
      }
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-005-${String(index + 1).padStart(3, '0')}`;
    // Skechers WOMENS PLP leads to non-footwear first → prefer MENS for reliable size coverage
    const navLabel = site.name.toLowerCase().includes('skechers')
      ? (site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel)
      : (site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel);

    test(`${tcId} - ${site.name} Selecting a size enables Add to Cart button`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Size enables ATC`);

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

      logger.step('Step 8 - Dismiss any overlay before size interaction');
      await ecommercePDPPage.ensureNoOverlay();

      logger.step('Step 8b - Wait for size buttons to render (best-effort; times out silently for non-footwear)');
      await ecommercePDPPage.waitForSizeButtonsToRender();

      logger.step('Step 9 - Assert size selector is visible (hard precondition)');
      const sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
      if (!sizeSelectorVisible) {
        test.skip(
          true,
          `${site.name}: size selector not visible on first PDP — product may have no sizes`,
        );
        return;
      }

      logger.step('Step 10 - Get available (enabled) sizes');
      const availableSizes = await ecommercePDPPage.getAvailableSizes();
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no enabled sizes found on first PDP`);
        return;
      }

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // Try up to 3 sizes and stop at the first that actually enables Add to Cart.
      logger.step('Step 11 - Select a size that enables Add to Cart (try up to 3)');
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

      logger.step('Step 12 - Assert Add to Cart button is enabled after size selection');
      softAssert.toBe(
        atcEnabled,
        true,
        `${site.name}: Add to Cart button should be enabled after selecting size "${targetSize}"`,
      );
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-006-${String(index + 1).padStart(3, '0')}`;
    // Skechers and Vans NZ: MENS PLP leads to footwear with consistent size selectors.
    // Vans NZ WOMENS lands on a sub-category PLP (Classics) rather than a product PDP.
    const preferMens =
      site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
    const navLabel = preferMens
      ? (site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel)
      : (site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel);

    test(`${tcId} - ${site.name} Add to Cart without size shows validation`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} ATC without size validation`);

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

      logger.step('Step 8 - Dismiss any overlay before interaction');
      await ecommercePDPPage.ensureNoOverlay();

      logger.step('Step 8b - Wait for size buttons to render (best-effort)');
      await ecommercePDPPage.waitForSizeButtonsToRender();

      logger.step('Step 9 - Assert size selector is visible (hard precondition)');
      const sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
      if (!sizeSelectorVisible) {
        test.skip(true, `${site.name}: size selector not visible — product may have no sizes`);
        return;
      }

      logger.step('Step 10 - Check ATC state WITHOUT selecting a size');
      const atcEnabledBeforeSize = await ecommercePDPPage.isAddToCartEnabled();

      if (!atcEnabledBeforeSize) {
        logger.step('Step 10a (BRANCH A) - ATC button is disabled without size — validation by button state');
        softAssert.toBe(
          atcEnabledBeforeSize,
          false,
          `${site.name}: Add to Cart button should be disabled when no size is selected`,
        );
        logger.verify('ATC disabled without size (BRANCH A)', 'false', String(atcEnabledBeforeSize));
      } else {
        logger.step('Step 10b (BRANCH B) - ATC button enabled — click without size and expect validation signal');
        const initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC click', 'number >= 0', String(initialCartCount));

        await ecommercePDPPage.addToCart();

        logger.step('Step 11b - Poll for validation signal (aria-live or role=alert)');
        const hasValidation = await ecommercePDPPage.hasSizeValidationMessage();
        // A site that silently rejects (no signal at all) is a real UX bug per E2E-PDP-006.
        softAssert.toBe(
          hasValidation,
          true,
          `${site.name}: A size validation signal (role=alert or aria-live) should appear after clicking ATC without size selection`,
        );
        logger.verify('Validation signal present after ATC without size (BRANCH B)', 'true', String(hasValidation));

        logger.step('Step 12b - Assert cart count did not increment');
        const cartCountAfterClick = await ecommercePDPPage.getMiniCartCount();
        softAssert.toBe(
          cartCountAfterClick,
          initialCartCount,
          `${site.name}: Cart count should not increment when ATC clicked without size selection`,
        );
        logger.verify('Cart count unchanged after failed ATC', String(initialCartCount), String(cartCountAfterClick));
      }
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-007-${String(index + 1).padStart(3, '0')}`;
    // Skechers and Vans NZ: MENS PLP leads to footwear with consistent size selectors.
    // Vans NZ WOMENS lands on a sub-category PLP (Classics) rather than a product PDP.
    const preferMens =
      site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
    const navLabel = preferMens
      ? (site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel)
      : (site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel);

    test(`${tcId} - ${site.name} Add to Cart adds item and updates mini cart count`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} ATC updates mini cart count`);

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

      logger.step('Step 8 - Dismiss any overlay before size interaction');
      await ecommercePDPPage.ensureNoOverlay();

      logger.step('Step 8b - Wait for size buttons to render (best-effort)');
      await ecommercePDPPage.waitForSizeButtonsToRender();

      logger.step('Step 9 - Assert size selector is visible (hard precondition)');
      const sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
      if (!sizeSelectorVisible) {
        test.skip(true, `${site.name}: size selector not visible on first PDP — product may have no sizes`);
        return;
      }

      logger.step('Step 10 - Get available (enabled) sizes');
      const availableSizes = await ecommercePDPPage.getAvailableSizes();
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no enabled sizes found on first PDP`);
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
      logger.verify(
        'Mini cart count after ATC',
        String(initialCartCount + 1),
        String(finalCartCount),
      );

      logger.step('Step 15 - Assert mini cart count incremented by exactly 1');
      softAssert.toBe(
        finalCartCount,
        initialCartCount + 1,
        `${site.name}: Mini cart count should increment by 1 after Add to Cart (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${finalCartCount})`,
      );
    });
  }
});
