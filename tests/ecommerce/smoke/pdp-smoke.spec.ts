import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';
import {
  getPreferredNavLabel,
  navigateToPlp,
  shouldPreferMens,
  selectFirstPurchasableSize,
} from './smoke-helpers';

test.describe('Ecommerce PDP Smoke @ecommerce @smoke @pdp', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-001-${String(index + 1).padStart(3, '0')}`;
    const navLabel = getPreferredNavLabel(site);

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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      await logger.step('Step 6 - Click first product card', async () => {
        await ecommercePLPPage.clickProductCard(0);
      });

      await logger.step('Step 7 - Wait for PDP to fully load', async () => {
        await ecommercePDPPage.waitForPdpLoad();
      });

      await logger.step('Step 8 - Assert product name is non-empty', async () => {
        const productName = await ecommercePDPPage.getProductName();
        softAssert.toBeGreaterThan(productName.length, 0, `${site.name}: Product name should be non-empty`);
      });

      await logger.step('Step 9 - Assert price is non-empty', async () => {
        const price = await ecommercePDPPage.getPrice();
        softAssert.toBeGreaterThan(price.length, 0, `${site.name}: Price should be non-empty`);
      });

      await logger.step('Step 10 - Assert image gallery is visible', async () => {
        const galleryVisible = await ecommercePDPPage.isImageGalleryVisible();
        softAssert.toBe(galleryVisible, true, `${site.name}: Image gallery should be visible`);
      });
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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      const MAX_PRODUCTS_TO_TRY = 10;
      let swatchCount = 0;
      await logger.step(`Step 6 - Find a PDP with 2+ colour swatches (try up to ${MAX_PRODUCTS_TO_TRY} product cards)`, async () => {
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
      });

      if (swatchCount < 2) {
        test.skip(
          true,
          `${site.name}: no product with 2+ colour swatches found in first ${MAX_PRODUCTS_TO_TRY} MEN PLP products`,
        );
        return;
      }

      let initialUrl!: string;
      await logger.step('Step 7 - Capture initial PDP URL', async () => {
        initialUrl = await ecommercePDPPage.getCurrentUrl();
      });

      await logger.step('Step 8 - Click a different colour swatch', async () => {
        await ecommercePDPPage.clickColourSwatch(0);
      });

      await logger.step('Step 9 - Wait for colour variant PDP to load', async () => {
        await ecommercePDPPage.waitForVariantNavigation(initialUrl);
      });

      await logger.step('Step 10 - Assert URL changed and gallery images visible on variant PDP', async () => {
        const variantUrl = await ecommercePDPPage.getCurrentUrl();
        softAssert.toBe(
          variantUrl !== initialUrl,
          true,
          `${site.name}: URL should change to colour variant after swatch click`,
        );
        const galleryVisible = await ecommercePDPPage.isImageGalleryVisible();
        softAssert.toBe(galleryVisible, true, `${site.name}: Variant PDP gallery images should be visible`);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-004-${String(index + 1).padStart(3, '0')}`;
    const navLabel = getPreferredNavLabel(site);

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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      await logger.step('Step 6 - Click first product card', async () => {
        await ecommercePLPPage.clickProductCard(0);
      });

      await logger.step('Step 7 - Wait for PDP to fully load', async () => {
        await ecommercePDPPage.waitForPdpLoad();
      });

      await logger.step('Step 8 - Dismiss any overlay before size interaction', async () => {
        await ecommercePDPPage.ensureNoOverlay();
      });

      let sizeSelectorVisible = false;
      await logger.step('Step 9 - Assert size selector is visible', async () => {
        sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
      });
      if (!sizeSelectorVisible) {
        test.skip(true, `${site.name}: size selector not visible on first PDP — product may have no sizes`);
        return;
      }

      let toggleLabels: string[] = [];
      await logger.step('Step 10 - Get gender toggle labels (DOM-proximity: within size selector only)', async () => {
        toggleLabels = await ecommercePDPPage.getSizeGenderToggleLabels();
        logger.verify('Gender toggle labels found', '>= 0 labels', `${toggleLabels.length} labels: ${JSON.stringify(toggleLabels)}`);
      });

      await logger.step('Step 11 - Get active toggle label', async () => {
        const activeLabel = await ecommercePDPPage.getSizeToggleActiveLabel();
        logger.verify('Active toggle label', 'non-empty or empty (best-effort)', activeLabel || '(none)');
      });

      let initialSizes: string[] = [];
      await logger.step('Step 12 - Get all visible size labels (includes disabled — not yet in-cart state)', async () => {
        initialSizes = await ecommercePDPPage.getVisibleSizeLabels();
        logger.verify('Initial visible sizes count', '>= 0', String(initialSizes.length));
      });

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
            await logger.step(`Step 13a - Click first toggle "${actualFirstToggle}" to initialise size panel`, async () => {
              await ecommercePDPPage.clickSizeGenderToggle(actualFirstToggle);
            });
          }

          await logger.step(`Step 13 - Click second gender toggle: "${actualSecondToggle}"`, async () => {
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
          });
        } else {
          await logger.step(
            `Step 13 - No second toggle matched for "${secondConfigLabel}" in discovered labels ${JSON.stringify(toggleLabels)} — asserting initial sizes only`,
            async () => {
              if (site.pdpExpectedSize && initialSizes.length > 0) {
                softAssert.toBe(
                  initialSizes.some((s) => s.includes(site.pdpExpectedSize!)),
                  true,
                  `${site.name}: expected size "${site.pdpExpectedSize}" in initial size grid`,
                );
              }
            },
          );
        }
      } else {
        await logger.step('Step 13 - No multi-gender toggle configured — asserting initial sizes', async () => {
          if (site.pdpExpectedSize && initialSizes.length > 0) {
            softAssert.toBe(
              initialSizes.some((s) => s.includes(site.pdpExpectedSize!)),
              true,
              `${site.name}: expected size "${site.pdpExpectedSize}" in size grid`,
            );
          }
        });
      }
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-005-${String(index + 1).padStart(3, '0')}`;
    const navLabel = getPreferredNavLabel(site, site.name.toLowerCase().includes('skechers'));

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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      // The first PDP may be fully OOS (all sizes disabled). Retry up to MAX_PRODUCTS_TO_TRY
      // products before giving up — mirrors the colour-swatch retry in E2E-PDP-002.
      const MAX_PRODUCTS_TO_TRY = 10;
      let availableSizes: string[] = [];

      for (let productIndex = 0; productIndex < MAX_PRODUCTS_TO_TRY; productIndex++) {
        if (productIndex > 0) {
          await ecommercePDPPage.goBack();
          await ecommercePLPPage.waitForPlpUrl();
          await ecommercePLPPage.waitForProductGrid();
        }

        await logger.step(`Step 6 - Click product card #${productIndex + 1}`, async () => {
          await ecommercePLPPage.clickProductCard(productIndex);
        });

        await logger.step('Step 7 - Wait for PDP to fully load', async () => {
          await ecommercePDPPage.waitForPdpLoad();
        });

        await logger.step('Step 8 - Dismiss any overlay before size interaction', async () => {
          await ecommercePDPPage.ensureNoOverlay();
        });

        await logger.step('Step 8b - Wait for size buttons to render (best-effort; times out silently for non-footwear)', async () => {
          await ecommercePDPPage.waitForSizeButtonsToRender();
        });

        const sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
        if (!sizeSelectorVisible) continue;

        availableSizes = await ecommercePDPPage.getAvailableSizes();
        if (availableSizes.length > 0) break;
      }

      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no enabled sizes found in first ${MAX_PRODUCTS_TO_TRY} PDPs`);
        return;
      }

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // selectFirstPurchasableSize tries up to 3 and returns the first that enables ATC.
      let targetSize: string | null = null;
      await logger.step('Step 11 - Select a size that enables Add to Cart (try up to 3)', async () => {
        targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
      });
      if (targetSize === null) {
        test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      await logger.step('Step 12 - Assert Add to Cart button is enabled after size selection', async () => {
        const atcEnabled = await ecommercePDPPage.isAddToCartEnabled();
        softAssert.toBe(
          atcEnabled,
          true,
          `${site.name}: Add to Cart button should be enabled after selecting size "${targetSize}"`,
        );
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-006-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      await logger.step('Step 6 - Click first product card', async () => {
        await ecommercePLPPage.clickProductCard(0);
      });

      await logger.step('Step 7 - Wait for PDP to fully load', async () => {
        await ecommercePDPPage.waitForPdpLoad();
      });

      await logger.step('Step 8 - Dismiss any overlay before interaction', async () => {
        await ecommercePDPPage.ensureNoOverlay();
      });

      await logger.step('Step 8b - Wait for size buttons to render (best-effort)', async () => {
        await ecommercePDPPage.waitForSizeButtonsToRender();
      });

      let sizeSelectorVisible = false;
      await logger.step('Step 9 - Assert size selector is visible (hard precondition)', async () => {
        sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
      });
      if (!sizeSelectorVisible) {
        test.skip(true, `${site.name}: size selector not visible — product may have no sizes`);
        return;
      }

      let atcEnabledBeforeSize = false;
      await logger.step('Step 10 - Check ATC state WITHOUT selecting a size', async () => {
        atcEnabledBeforeSize = await ecommercePDPPage.isAddToCartEnabled();
      });

      if (!atcEnabledBeforeSize) {
        await logger.step('Step 10a (BRANCH A) - ATC button is disabled without size — validation by button state', async () => {
          softAssert.toBe(
            atcEnabledBeforeSize,
            false,
            `${site.name}: Add to Cart button should be disabled when no size is selected`,
          );
          logger.verify('ATC disabled without size (BRANCH A)', 'false', String(atcEnabledBeforeSize));
        });
      } else {
        let initialCartCount = 0;
        await logger.step('Step 10b (BRANCH B) - ATC button enabled — click without size and expect validation signal', async () => {
          initialCartCount = await ecommercePDPPage.getMiniCartCount();
          logger.verify('Initial cart count before ATC click', 'number >= 0', String(initialCartCount));

          await ecommercePDPPage.addToCart();
        });

        await logger.step('Step 11b - Poll for validation signal (aria-live or role=alert)', async () => {
          const hasValidation = await ecommercePDPPage.hasSizeValidationMessage();
          // A site that silently rejects (no signal at all) is a real UX bug per E2E-PDP-006.
          softAssert.toBe(
            hasValidation,
            true,
            `${site.name}: A size validation signal (role=alert or aria-live) should appear after clicking ATC without size selection`,
          );
          logger.verify('Validation signal present after ATC without size (BRANCH B)', 'true', String(hasValidation));
        });

        await logger.step('Step 12b - Assert cart count did not increment', async () => {
          const cartCountAfterClick = await ecommercePDPPage.getMiniCartCount();
          softAssert.toBe(
            cartCountAfterClick,
            initialCartCount,
            `${site.name}: Cart count should not increment when ATC clicked without size selection`,
          );
          logger.verify('Cart count unchanged after failed ATC', String(initialCartCount), String(cartCountAfterClick));
        });
      }
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PDP-007-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      // The first PDP may be fully OOS (all sizes disabled). Retry up to MAX_PRODUCTS_TO_TRY
      // products before giving up — mirrors the colour-swatch retry in E2E-PDP-002.
      const MAX_PRODUCTS_TO_TRY = 10;
      let availableSizes: string[] = [];

      for (let productIndex = 0; productIndex < MAX_PRODUCTS_TO_TRY; productIndex++) {
        if (productIndex > 0) {
          await ecommercePDPPage.goBack();
          await ecommercePLPPage.waitForPlpUrl();
          await ecommercePLPPage.waitForProductGrid();
        }

        await logger.step(`Step 6 - Click product card #${productIndex + 1}`, async () => {
          await ecommercePLPPage.clickProductCard(productIndex);
        });

        await logger.step('Step 7 - Wait for PDP to fully load', async () => {
          await ecommercePDPPage.waitForPdpLoad();
        });

        await logger.step('Step 8 - Dismiss any overlay before size interaction', async () => {
          await ecommercePDPPage.ensureNoOverlay();
        });

        await logger.step('Step 8b - Wait for size buttons to render (best-effort)', async () => {
          await ecommercePDPPage.waitForSizeButtonsToRender();
        });

        const sizeSelectorVisible = await ecommercePDPPage.isSizeSelectorVisible();
        if (!sizeSelectorVisible) continue;

        availableSizes = await ecommercePDPPage.getAvailableSizes();
        if (availableSizes.length > 0) break;
      }

      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no enabled sizes found in first ${MAX_PRODUCTS_TO_TRY} PDPs`);
        return;
      }

      let initialCartCount = 0;
      await logger.step('Step 11 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // selectFirstPurchasableSize tries up to 3 and returns the first that enables ATC.
      let targetSize: string | null = null;
      await logger.step('Step 12 - Select a size that enables Add to Cart (try up to 3)', async () => {
        targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
      });
      if (targetSize === null) {
        test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      await logger.step(`Step 13 - Click Add to Cart with size "${targetSize}" selected`, async () => {
        await ecommercePDPPage.addToCart();
      });

      let finalCartCount = 0;
      await logger.step('Step 14 - Poll for mini cart count to increment', async () => {
        finalCartCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
        logger.verify(
          'Mini cart count after ATC',
          String(initialCartCount + 1),
          String(finalCartCount),
        );
      });

      await logger.step('Step 15 - Assert mini cart count incremented by exactly 1', async () => {
        softAssert.toBe(
          finalCartCount,
          initialCartCount + 1,
          `${site.name}: Mini cart count should increment by 1 after Add to Cart (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${finalCartCount})`,
        );
      });
    });
  }
});
