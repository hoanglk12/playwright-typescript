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
  sizesOverlap,
} from './smoke-helpers';

test.describe('Ecommerce Cart Smoke @ecommerce @smoke @cart', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-001-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Mini cart shows 0 items on fresh session`, async ({
      ecommerceNavPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart empty`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceNavPage.navigate(site.url);
      });

      await logger.step('Step 2 - Wait for SPA nav hydration', async () => {
        await ecommerceNavPage.waitForNavHydration();
      });

      let count = 0;
      await logger.step('Step 3 - Get mini cart count', async () => {
        count = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Mini cart count on fresh session', '0', String(count));
      });

      await logger.step('Step 4 - Assert mini cart count is 0', async () => {
        expect(count).toBe(0);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-002-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Mini cart shows item count after Add to Cart`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart shows item count after ATC`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
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
      });

      await logger.step('Step 15 - Assert mini cart count incremented by exactly 1', async () => {
        expect(
          finalCartCount,
          `${site.name}: Mini cart count should increment by 1 after Add to Cart (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${finalCartCount})`,
        ).toBe(initialCartCount + 1);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-003-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
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

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
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

      await logger.step('Step 14 - Poll for mini cart count to increment', async () => {
        await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 15 - Open mini cart overlay (auto or manual)', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
      });

      await logger.step('Step 17 - Assert mini cart overlay is visible', async () => {
        const overlayVisible = await ecommerceCartOverlayPage.isOverlayVisible();
        softAssert.toBeTruthy(overlayVisible, `${site.name}: Mini cart overlay should be visible`);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-004-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Mini cart overlay shows product name, size, and price`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart overlay content verification`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      // Capture product details BEFORE size selection and before the ATC call.
      // WHY: on Vans AU the SPA can lose the ATC button within ~400ms of selectSize. Placing
      // getProductName/getPrice between isAddToCartEnabled and addToCart caused the button to
      // disappear before addToCart ran. Capturing here (sizes found, no size selected yet) keeps
      // addToCart immediately after isAddToCartEnabled in the hot path below.
      let productName = '';
      await logger.step('Step 11 - Capture product details (name and price) before size selection', async () => {
        productName = await ecommercePDPPage.getProductName();
        logger.verify('Product name captured before ATC', 'non-empty string', productName);
      });

      if (productName === '') {
        test.skip(
          true,
          `${site.name}: product name could not be read from PDP — skipping to avoid vacuous assertion`,
        );
        return;
      }

      const productPrice = await ecommercePDPPage.getPrice();
      logger.verify('Product price captured before ATC', 'non-empty string or empty', productPrice);

      let initialCartCount = 0;
      await logger.step('Step 12 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // Try up to 3 sizes and stop at the first that actually enables Add to Cart.
      // addToCart is called immediately after isAddToCartEnabled to minimize the window in which
      // the SPA can lose the button (observed on Vans AU with ~400ms gap).
      let targetSize: string | null = null;
      await logger.step('Step 13 - Select a size, then Add to Cart immediately (try up to 3 sizes)', async () => {
        for (const size of availableSizes.slice(0, 3)) {
          await ecommercePDPPage.selectSize(size);
          if (await ecommercePDPPage.isAddToCartEnabled()) {
            targetSize = size;
            await ecommercePDPPage.addToCart();
            break;
          }
        }
      });
      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`,
        );
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);
      const confirmedSize = targetSize;

      await logger.step('Step 15 - Poll for mini cart count to increment', async () => {
        await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 16 - Open mini cart overlay (auto or manual)', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
      });

      // Soft precondition: overlay must be open before content checks. This mirrors the CART-003
      // pattern — Vans AU's Bloomreach popup can intercept clickCartIcon() and prevent the overlay
      // from opening (known platform issue). A hard assertion here would hard-fail the test on
      // every Bloomreach intercept rather than letting retries succeed. The early return prevents
      // three misleading "content missing" soft failures when the overlay simply didn't open.
      let overlayIsOpen = false;
      await logger.step('Step 18 - Assert mini cart overlay is open (precondition for content checks)', async () => {
        overlayIsOpen = await ecommerceCartOverlayPage.isOverlayVisible();
        softAssert.toBeTruthy(
          overlayIsOpen,
          `${site.name}: Mini cart overlay must be open before content verification`,
        );
      });
      if (!overlayIsOpen) return;

      await logger.step('Step 19 - Assert mini cart overlay contains product name, size, and price', async () => {
        const nameInOverlay = await ecommerceCartOverlayPage.overlayContainsText(productName);
        softAssert.toBeTruthy(
          nameInOverlay,
          `${site.name}: Mini cart overlay should show product name "${productName}"`,
        );

        // overlayContainsSizeLabel is used instead of overlayContainsText to avoid false-positives:
        // short numeric sizes (e.g. "4") can appear inside price strings ("$149.99") and would
        // satisfy a plain includes() check even if the size is absent from the line items.
        const sizeInOverlay = await ecommerceCartOverlayPage.overlayContainsSizeLabel(confirmedSize);
        softAssert.toBeTruthy(
          sizeInOverlay,
          `${site.name}: Mini cart overlay should show size "${confirmedSize}"`,
        );

        if (productPrice !== '') {
          const priceInOverlay = await ecommerceCartOverlayPage.overlayContainsText(productPrice);
          softAssert.toBeTruthy(
            priceInOverlay,
            `${site.name}: Mini cart overlay should show price "${productPrice}"`,
          );
        } else {
          logger.verify('Price check skipped — PDP price not captured', 'price string', '(empty)');
        }
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-005-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Removing item from mini cart decrements count`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Remove item from mini cart`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      let initialCartCount = 0;
      await logger.step('Step 8 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // addToCart is called immediately after isAddToCartEnabled to minimise the window in which
      // the SPA can lose the button (observed on Vans AU with ~400ms gap).
      let targetSize: string | null = null;
      await logger.step('Step 9 - Select a size, then Add to Cart immediately (try up to 3 sizes)', async () => {
        for (const size of availableSizes.slice(0, 3)) {
          await ecommercePDPPage.selectSize(size);
          if (await ecommercePDPPage.isAddToCartEnabled()) {
            targetSize = size;
            await ecommercePDPPage.addToCart();
            break;
          }
        }
      });

      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`,
        );
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      let postAddCount = 0;
      await logger.step('Step 11 - Poll for mini cart count to increment after ATC', async () => {
        postAddCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 12 - Assert cart count incremented by 1 (precondition for remove step)', async () => {
        expect(
          postAddCount,
          `${site.name}: Cart count must increment by 1 after ATC before remove can be tested (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${postAddCount})`,
        ).toBe(initialCartCount + 1);
      });

      await logger.step('Step 13 - Open mini cart overlay (auto or manual)', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
      });

      // Soft precondition: overlay must be open before remove. Vans AU's Bloomreach popup can
      // intercept clickCartIcon() and prevent the overlay from opening (known platform issue).
      // A hard assertion here would hard-fail the test on every Bloomreach intercept. Early
      // return prevents a misleading removeFirstItem throw when the overlay simply didn't open.
      let overlayIsOpen = false;
      await logger.step('Step 14 - Assert mini cart overlay is open (precondition for remove step)', async () => {
        overlayIsOpen = await ecommerceCartOverlayPage.isOverlayVisible();
        softAssert.toBeTruthy(
          overlayIsOpen,
          `${site.name}: Mini cart overlay must be open before remove can be performed`,
        );
      });
      if (!overlayIsOpen) return;

      await logger.step('Step 15 - Remove the first item from the mini cart overlay', async () => {
        await ecommerceCartOverlayPage.removeFirstItem();
      });

      let finalCount = 0;
      await logger.step('Step 16 - Poll for mini cart count to decrement after remove', async () => {
        finalCount = await ecommerceCartOverlayPage.waitForMiniCartCountDecrement(postAddCount);
        logger.verify(
          'Cart count after remove',
          String(postAddCount - 1),
          String(finalCount),
        );
      });

      await logger.step('Step 17 - Assert cart count decremented by exactly 1', async () => {
        expect(
          finalCount,
          `${site.name}: Cart count should decrement by 1 after remove (was ${postAddCount}, expected ${postAddCount - 1}, got ${finalCount})`,
        ).toBe(postAddCount - 1);
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-006-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Continue Shopping closes cart overlay`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Continue Shopping closes cart overlay`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      let initialCartCount = 0;
      await logger.step('Step 8 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // addToCart is called immediately after isAddToCartEnabled to minimise the window in which
      // the SPA can lose the button (observed on Vans AU with ~400ms gap).
      let targetSize: string | null = null;
      await logger.step('Step 9 - Select a size, then Add to Cart immediately (try up to 3 sizes)', async () => {
        for (const size of availableSizes.slice(0, 3)) {
          await ecommercePDPPage.selectSize(size);
          if (await ecommercePDPPage.isAddToCartEnabled()) {
            targetSize = size;
            await ecommercePDPPage.addToCart();
            break;
          }
        }
      });

      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`,
        );
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      let postAddCount = 0;
      await logger.step('Step 11 - Poll for mini cart count to increment after ATC', async () => {
        postAddCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 12 - Assert cart count incremented by 1 (precondition for overlay steps)', async () => {
        expect(
          postAddCount,
          `${site.name}: Cart count must increment by 1 after ATC before Continue Shopping can be tested (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${postAddCount})`,
        ).toBe(initialCartCount + 1);
      });

      await logger.step('Step 13 - Open mini cart overlay (auto or manual)', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);

        // ensureCartOverlayOpen() only waits on the loose isOverlayVisible() detector, which can
        // be satisfied before the CSS opacity fade-in transition finishes (or even starts, on
        // auto-open). Wait for the strict opacity-aware detector to settle before reading the
        // Step 14 precondition, so the check doesn't race the transition.
        await ecommerceCartOverlayPage.waitForOverlayGenuinelyOpen();
      });

      // Soft precondition: overlay must be open before Continue Shopping can be tested. Vans AU's
      // Bloomreach popup can intercept clickCartIcon() and prevent the overlay from opening
      // (known platform issue). A hard assertion here would hard-fail the test on every
      // Bloomreach intercept. Early return prevents a misleading "Continue Shopping not found"
      // failure when the overlay simply didn't open.
      //
      // Uses isOverlayGenuinelyOpen() rather than isOverlayVisible() — on GRA storefronts the
      // drawer panel is permanently mounted with a non-zero fixed-position bounding box even
      // when closed (opacity:0), so isOverlayVisible() is always true for a non-empty cart and
      // would make this precondition vacuous (see isOverlayGenuinelyOpen() docblock).
      let overlayIsOpen = false;
      await logger.step('Step 14 - Assert mini cart overlay is open (precondition for Continue Shopping)', async () => {
        overlayIsOpen = await ecommerceCartOverlayPage.isOverlayGenuinelyOpen();
        softAssert.toBeTruthy(
          overlayIsOpen,
          `${site.name}: Mini cart overlay must be open before Continue Shopping can be tested`,
        );
      });
      if (!overlayIsOpen) return;

      let urlBeforeClick = '';
      await logger.step('Step 15 - Capture current URL before clicking Continue Shopping', async () => {
        urlBeforeClick = await ecommercePDPPage.getCurrentUrl();
      });

      let hasControl = false;
      await logger.step('Step 16 - Click Continue Shopping control in the mini cart overlay', async () => {
        hasControl = await ecommerceCartOverlayPage.clickContinueShopping();
      });
      if (!hasControl) {
        test.skip(true, `${site.name}: no "Continue Shopping" control found in cart overlay`);
        return;
      }

      await logger.step('Step 17 - Wait for mini cart overlay to close', async () => {
        await ecommerceCartOverlayPage.waitForOverlayHidden();
      });

      // Uses isOverlayGenuinelyOpen() rather than isOverlayVisible() for the same reason as the
      // Step 14 precondition — isOverlayVisible() cannot detect the closed (opacity:0) state on
      // GRA storefronts.
      await logger.step('Step 18 - Assert overlay is closed and the underlying page is unchanged', async () => {
        softAssert.toBeFalsy(
          await ecommerceCartOverlayPage.isOverlayGenuinelyOpen(),
          `${site.name}: Mini cart overlay should be closed after clicking Continue Shopping`,
        );
        softAssert.toBe(
          await ecommercePDPPage.getCurrentUrl(),
          urlBeforeClick,
          `${site.name}: Continue Shopping should close the overlay without navigating away from the current page`,
        );
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-007-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Adding same product in different size creates separate line item`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(
        `${tcId} - ${site.name} Adding same product in different size creates separate line item`,
      );

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length < 2) {
        test.skip(
          true,
          `${site.name}: fewer than 2 sizes found in first 10 ${navLabel} PLP products — cannot test two distinct sizes`,
        );
        return;
      }

      let initialCartCount = 0;
      await logger.step('Step 7 - Capture initial mini cart count before any ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // addToCart is called immediately after isAddToCartEnabled to minimise the window in which
      // the SPA can lose the button (observed on Vans AU with ~400ms gap). Try up to 5 candidates
      // to find the FIRST workable size (sizeA).
      let sizeA: string | null = null;
      await logger.step('Step 8 - Select first size, then Add to Cart immediately (try up to 5 sizes)', async () => {
        for (const size of availableSizes.slice(0, 5)) {
          await ecommercePDPPage.selectSize(size);
          if (await ecommercePDPPage.isAddToCartEnabled()) {
            sizeA = size;
            await ecommercePDPPage.addToCart();
            break;
          }
        }
      });
      if (sizeA === null) {
        test.skip(
          true,
          `${site.name}: first 5 sizes all resulted in sold-out state — no purchasable size found for first Add to Cart`,
        );
        return;
      }
      logger.verify('First size that enabled Add to Cart', 'non-empty string', sizeA);
      const confirmedSizeA = sizeA;

      let afterFirstAdd = 0;
      await logger.step('Step 9 - Poll for mini cart count to increment after first ATC', async () => {
        afterFirstAdd = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      // The mini cart drawer can auto-open after the first Add to Cart on some storefronts and,
      // being position:fixed, can intercept clicks on the PDP's size selector/ATC button for the
      // second add (addToCart() has no elementFromPoint/dispatchEvent coverage fallback, unlike
      // selectSize()). Close it before attempting the second size selection.
      await logger.step('Step 10 - Close mini cart overlay if it auto-opened, before selecting the second size', async () => {
        await ecommerceCartOverlayPage.closeOverlayIfOpen();
      });

      // Try remaining candidates for a second, DISTINCT purchasable size. Skip any candidate that
      // is a token-substring of sizeA (or vice versa, e.g. "8" vs "8.5") to avoid a false pass if
      // a storefront's overlay text search were ever to conflate the two.
      let sizeB: string | null = null;
      await logger.step('Step 11 - Select a second, distinct size, then Add to Cart immediately (try remaining candidates)', async () => {
        for (const size of availableSizes.slice(1)) {
          if (sizesOverlap(size, confirmedSizeA)) continue;
          await ecommercePDPPage.selectSize(size);
          if (await ecommercePDPPage.isAddToCartEnabled()) {
            sizeB = size;
            await ecommercePDPPage.addToCart();
            break;
          }
        }
      });
      if (sizeB === null) {
        test.skip(
          true,
          `${site.name}: no second distinct purchasable size found among remaining candidates — cannot test two sizes`,
        );
        return;
      }
      logger.verify('Second size that enabled Add to Cart', 'non-empty string', sizeB);
      const confirmedSizeB = sizeB;

      let afterSecondAdd = 0;
      await logger.step('Step 12 - Poll for mini cart count to increment after second ATC', async () => {
        afterSecondAdd = await ecommercePDPPage.waitForMiniCartCountIncrement(afterFirstAdd);
      });

      await logger.step('Step 13 - Open mini cart overlay (auto or manual)', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
        await ecommerceCartOverlayPage.waitForOverlayGenuinelyOpen();
      });

      // Soft precondition: overlay must be open before content checks. Vans AU's Bloomreach
      // popup can intercept clickCartIcon() and prevent the overlay from opening (known
      // platform issue). A hard assertion here would hard-fail the test on every Bloomreach
      // intercept rather than letting retries succeed. The early return prevents misleading
      // "size label missing" soft failures when the overlay simply didn't open.
      let overlayIsOpen = false;
      await logger.step('Step 14 - Assert mini cart overlay is open (precondition for line-item checks)', async () => {
        overlayIsOpen = await ecommerceCartOverlayPage.isOverlayVisible();
        softAssert.toBeTruthy(
          overlayIsOpen,
          `${site.name}: Mini cart overlay must be open before line-item verification`,
        );
      });
      if (!overlayIsOpen) return;

      // PRIMARY assertion: a single cart line item can only carry one size value, so both
      // distinct size labels appearing simultaneously in the overlay is proof of two separate
      // line items for the same product. Both checks are independent facts about the same
      // overlay state, so soft assertions let both be reported even if one fails.
      await logger.step('Step 15 - Assert mini cart overlay shows BOTH distinct size labels (separate line items)', async () => {
        const sizeAInOverlay = await ecommerceCartOverlayPage.overlayContainsSizeLabel(confirmedSizeA);
        softAssert.toBeTruthy(
          sizeAInOverlay,
          `${site.name}: Mini cart overlay should show size "${confirmedSizeA}" as its own line item`,
        );

        const sizeBInOverlay = await ecommerceCartOverlayPage.overlayContainsSizeLabel(confirmedSizeB);
        softAssert.toBeTruthy(
          sizeBInOverlay,
          `${site.name}: Mini cart overlay should show size "${confirmedSizeB}" as its own line item`,
        );
      });

      // SECONDARY/corroborating assertion: cart badge delta of exactly 2. Kept secondary because
      // a delta of 2 is also consistent with one line item at qty 2 — the size-label check above
      // is the real proof of two separate line items.
      await logger.step('Step 16 - Assert mini cart count incremented by exactly 2 in total (corroborating check)', async () => {
        softAssert.toBe(
          afterSecondAdd,
          initialCartCount + 2,
          `${site.name}: Mini cart count should increment by 2 total after adding two distinct sizes (was ${initialCartCount}, expected ${initialCartCount + 2}, got ${afterSecondAdd})`,
        );
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-008-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Cart total updates correctly`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Cart total updates correctly`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      // Capture product price BEFORE size selection and ATC.
      // WHY: on Vans AU the SPA can lose the ATC button within ~400ms of selectSize. Capturing
      // price here (sizes found, no size selected yet) mirrors the CART-004 pattern and keeps
      // the hot path from selectSize → isAddToCartEnabled → addToCart uninterrupted below.
      let productPrice = '';
      await logger.step('Step 7 - Capture product price before size selection', async () => {
        productPrice = await ecommercePDPPage.getPrice();
        logger.verify('Product price captured before ATC', 'non-empty string or empty', productPrice);
      });

      let initialCartCount = 0;
      await logger.step('Step 8 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
      // addToCart is called immediately after isAddToCartEnabled to minimise the window in which
      // the SPA can lose the button (observed on Vans AU with ~400ms gap).
      let targetSize: string | null = null;
      await logger.step('Step 9 - Select a size, then Add to Cart immediately (try up to 3 sizes)', async () => {
        for (const size of availableSizes.slice(0, 3)) {
          await ecommercePDPPage.selectSize(size);
          if (await ecommercePDPPage.isAddToCartEnabled()) {
            targetSize = size;
            await ecommercePDPPage.addToCart();
            break;
          }
        }
      });

      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`,
        );
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      await logger.step('Step 10 - Poll for mini cart count to increment after ATC', async () => {
        await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 11 - Open mini cart overlay (auto or manual)', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
      });

      // Soft precondition: overlay must be open before total checks. Vans AU's Bloomreach popup
      // can intercept clickCartIcon() and prevent the overlay from opening (known platform issue).
      // A hard assertion here would hard-fail the test on every Bloomreach intercept. Early return
      // prevents misleading "total empty" soft failures when the overlay simply didn't open.
      let overlayIsOpen = false;
      await logger.step('Step 12 - Assert mini cart overlay is open (precondition for total check)', async () => {
        overlayIsOpen = await ecommerceCartOverlayPage.isOverlayVisible();
        softAssert.toBeTruthy(
          overlayIsOpen,
          `${site.name}: Mini cart overlay must be open before cart total can be read`,
        );
      });
      if (!overlayIsOpen) return;

      let cartTotal = '';
      await logger.step('Step 13 - Read cart total from overlay', async () => {
        cartTotal = await ecommerceCartOverlayPage.getCartTotal();
      });

      await logger.step('Step 14 - Assert cart total is non-empty', async () => {
        softAssert.toBeTruthy(
          cartTotal !== '',
          `${site.name}: Cart overlay subtotal row should display a non-empty price`,
        );
      });

      // PRIMARY assertion: for a single-item cart with no tax/shipping added, the overlay
      // subtotal must equal the unit price captured from the PDP. If these values differ,
      // diagnose the DOM structure in getCartTotal() first (subtotal vs tax-inclusive total)
      // before weakening or removing this assertion.
      await logger.step('Step 15 - Assert cart total matches PDP unit price (single-item cart)', async () => {
        if (productPrice !== '' && cartTotal !== '') {
          const numericTotal = cartTotal.replace(/[^0-9.]/g, '');
          const numericPrice = productPrice.replace(/[^0-9.]/g, '');
          softAssert.toBe(
            numericTotal,
            numericPrice,
            `${site.name}: Cart total should equal product unit price for single item (overlay="${cartTotal}", PDP="${productPrice}")`,
          );
        } else {
          logger.verify(
            'Price comparison skipped',
            'both values non-empty',
            `cartTotal="${cartTotal}", productPrice="${productPrice}"`,
          );
        }
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-011-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Empty cart state renders empty message`, async ({
      ecommerceNavPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Empty cart empty message`);

      await logger.step('Step 1 - Navigate to homepage (fresh session)', async () => {
        await ecommerceNavPage.navigate(site.url);
      });

      await logger.step('Step 2 - Wait for SPA nav hydration', async () => {
        await ecommerceNavPage.waitForNavHydration();
      });

      await logger.step('Step 3 - Verify cart is empty before clicking icon (precondition)', async () => {
        const initialCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count (fresh session)', '0', String(initialCount));
        expect(initialCount, `${site.name}: Cart must be 0 on fresh session for empty-state test`).toBe(0);
      });

      await logger.step('Step 4 - Click cart icon to open mini cart', async () => {
        await ecommerceCartOverlayPage.clickCartIcon();
      });

      await logger.step('Step 5 - Wait for overlay (best-effort — empty state has no CTA, will time out gracefully)', async () => {
        await ecommerceCartOverlayPage.waitForOverlayVisible();
      });

      let emptyMessage = '';
      await logger.step('Step 6 - Read empty cart message from overlay or cart page', async () => {
        emptyMessage = await ecommerceCartOverlayPage.getEmptyCartMessage();
        logger.verify('Empty cart message', 'non-empty string', emptyMessage);
      });

      await logger.step('Step 7 - Assert empty cart message is visible', async () => {
        expect(
          emptyMessage,
          `${site.name}: Opening an empty cart should show an empty-state message (e.g. "Your cart is empty")`,
        ).not.toBe('');
      });
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-010-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Promo code field visible at checkout entry`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCheckoutPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Promo code field visible at checkout entry`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      let initialCartCount = 0;
      await logger.step('Step 7 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));
      });

      let targetSize: string | null = null;
      await logger.step('Step 8 - Select a size that enables Add to Cart (try up to 3)', async () => {
        targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
      });
      if (targetSize === null) {
        test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
        return;
      }
      logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

      await logger.step(`Step 9 - Click Add to Cart with size "${targetSize}" selected`, async () => {
        await ecommercePDPPage.addToCart();
      });

      let postAddCount = 0;
      await logger.step('Step 10 - Poll for mini cart count to increment after ATC', async () => {
        postAddCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 11 - Assert cart count incremented by 1 (precondition for promo-field check)', async () => {
        expect(
          postAddCount,
          `${site.name}: Cart count must increment by 1 after ATC before promo-field check is meaningful (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${postAddCount})`,
        ).toBe(initialCartCount + 1);
      });

      await logger.step('Step 12 - Navigate to /cart page', async () => {
        await ecommerceCheckoutPage.navigateToCart();
      });

      // PRIMARY assertion (hard): the promo/discount/coupon/voucher field must be visible on
      // the /cart page. Per the discovery report, this field lives at /cart, not behind the
      // checkout CTA / auth-modal flow.
      await logger.step('Step 13 - Assert promo/discount/coupon/voucher field is visible on /cart', async () => {
        const promoVisible = await ecommerceCheckoutPage.isPromoCodeFieldVisible();
        logger.verify('Promo field visible on /cart', 'true', String(promoVisible));
        expect(
          promoVisible,
          `${site.name}: E2E-CART-010 requires a promo/discount/coupon/voucher code field visible on /cart`,
        ).toBe(true);
      });

      // SECONDARY check (soft, best-effort): "Apply" button presence alongside the promo field.
      await logger.step('Step 14 - Best-effort check: Apply promo button visible on /cart', async () => {
        const applyVisible = await ecommerceCheckoutPage.hasApplyPromoButton();
        softAssert.toBeTruthy(
          applyVisible,
          `${site.name}: An "Apply" button should be present alongside the promo/discount/coupon/voucher field on /cart`,
        );
      });
    });
  }
});
