import { test } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import {
  getPreferredNavLabel,
  navigateToPlp,
  shouldPreferMens,
  ensureCartOverlayOpen,
  findProductWithAvailableSizes,
} from '../smoke/smoke-helpers';
import {
  applyNoiseRouteBlocks,
  atcEventContainsProductName,
  createAddToCartCapture,
  dismissVansPostAtcPopup,
  extractProductNameFromAtcEvent,
  getAddToCartDataLayerEvent,
  parsePriceToken,
} from './integration-helpers';
import type { AddToCartCapture, AdobeDataLayerEvent } from './integration-helpers';

test.describe('Ecommerce Add to Cart Integration @ecommerce @integration @regression', () => {
  test.slow();

  test.beforeEach(async ({ page }) => {
    await applyNoiseRouteBlocks(page);
  });

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-INT-001-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Add to Cart mutation propagates to UI and analytics`, async ({
      page,
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      softAssert,
    }) => {
      const logger = createTestLogger(
        `${tcId} - ${site.name} Add to Cart mutation propagates to UI and analytics`,
      );

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
        return;
      }

      let originHealthy = false;
      await logger.step('Step 0 - Verify storefront origin is reachable before running the full flow', async () => {
        originHealthy = await request
          .get(site.url, { timeout: TIMEOUTS.TIMEOUT_SHORT })
          .then((response) => response.ok())
          .catch(() => false);
      });
      if (!originHealthy) {
        test.skip(
          true,
          `${site.name}: origin failed health check (unreachable or non-2xx within ${TIMEOUTS.TIMEOUT_SHORT}ms) — skipping to avoid burning the retry/test.slow() budget on a dead backend`,
        );
        return;
      }

      // Interception must be armed before the PLP navigation that follows, so both actions stay
      // in a single step rather than being split across two — see integration-helpers.ts for why
      // the capture is a pass-through route handler that must already be registered.
      let capture!: AddToCartCapture;
      await logger.step('Step 1-2 - Intercept add-to-cart GraphQL mutation before navigation (pass-through only), then navigate to PLP', async () => {
        capture = await createAddToCartCapture(page);
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 3 - Scan PLP for a product with available sizes (precondition)', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
        return;
      }

      // Captured BEFORE selectSize(): Vans AU drops the ATC button on size selection (race
      // condition) — this ordering is mandatory, not optional.
      let productName = '';
      let productPrice = '';
      await logger.step('Step 4 - Capture product name and price BEFORE size selection', async () => {
        productName = await ecommercePDPPage.getProductName();
        productPrice = await ecommercePDPPage.getPrice();
      });

      let initialCartCount = 0;
      await logger.step('Step 5 - Capture initial mini cart count before ATC', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
      });

      // Select then addToCart immediately — no awaits inserted between isAddToCartEnabled() and
      // addToCart() (same tight adjacency pattern as checkout.spec.ts Step 8-9).
      let targetSize: string | null = null;
      await logger.step('Step 6 - Select a size, then Add to Cart immediately (try up to 3 sizes)', async () => {
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
        test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
        return;
      }

      // Not a hard precondition gate here (unlike checkout.spec.ts's cart-count check): the cart
      // count delta IS one of this scenario's 3 independent boundary outcomes (Boundary B), and a
      // storefront with a broken badge but working analytics must still have its Boundary A/C
      // checks run and reported — a hard gate here would stop the test before Steps 9/12/13 ever
      // execute. getCartTotal()/getAddToCartDataLayerEvent() below degrade gracefully (empty
      // string / undefined) rather than throwing when the cart genuinely never updated.
      let newCartCount = 0;
      await logger.step('Step 7 - Poll for mini cart count to increment after ATC', async () => {
        newCartCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 8 - Dismiss Vans Bloomreach popup if present, then open the mini cart overlay', async () => {
        await dismissVansPostAtcPopup(ecommercePDPPage, site);
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
      });

      await logger.step('Step 9 - Boundary A: Assert intercepted GraphQL mutation cart has items', async () => {
        // `data` contains exactly one field (the interceptor only captures the add-to-cart
        // mutation), so its value is read positionally rather than by a hardcoded field-name key —
        // see the AddToCartMutationResponse doc comment for why the field name varies by storefront.
        const mutationResult = capture.state.payload?.data
          ? Object.values(capture.state.payload.data)[0]
          : undefined;
        const cartItems = mutationResult?.cart?.items;
        softAssert.toBeTruthy(
          (cartItems?.length ?? 0) > 0,
          `${site.name}: Intercepted add-to-cart mutation response should contain cart items`,
        );
        if ((cartItems?.length ?? 0) === 0) {
          logger.verify(
            `${site.name}: Boundary A raw mutation payload (for diagnosis)`,
            'non-null payload with cart.items',
            JSON.stringify(capture.state.payload),
          );
        }
      });

      await logger.step('Step 10 - Boundary B: Assert cart badge equals initial count + 1 (delta assertion)', async () => {
        softAssert.toBe(
          newCartCount,
          initialCartCount + 1,
          `${site.name}: Cart badge should equal initial count + 1 after ATC`,
        );
      });

      await logger.step('Step 11 - Boundary B: Assert mini-cart overlay total matches PDP price (±0.01)', async () => {
        const overlayTotal = await ecommerceCartOverlayPage.getCartTotal();
        const overlayTotalNumeric = parsePriceToken(overlayTotal);
        const pdpPriceNumeric = parsePriceToken(productPrice);
        const totalsMatch =
          overlayTotalNumeric !== null &&
          pdpPriceNumeric !== null &&
          Math.abs(overlayTotalNumeric - pdpPriceNumeric) <= 0.01;
        softAssert.toBeTruthy(
          totalsMatch,
          `${site.name}: Mini-cart overlay total (${overlayTotal}) should match PDP price (${productPrice}) within +/-0.01`,
        );
      });

      let atcEvent: AdobeDataLayerEvent | undefined;
      await logger.step('Step 12 - Boundary C: Assert add-to-cart event fired in adobeDataLayer/dataLayer', async () => {
        atcEvent = await getAddToCartDataLayerEvent(page);
        softAssert.toBeTruthy(
          !!atcEvent,
          `${site.name}: add_to_cart event should be present in adobeDataLayer or dataLayer`,
        );
      });

      await logger.step('Step 13 - Boundary C: Assert event product name matches the PDP product name captured at Step 4', async () => {
        const capturedName = productName.trim();
        const extractedName = extractProductNameFromAtcEvent(atcEvent);
        const nameMatches =
          (extractedName.length > 0 &&
            capturedName.length > 0 &&
            extractedName.toLowerCase().includes(capturedName.toLowerCase())) ||
          atcEventContainsProductName(atcEvent, capturedName);
        softAssert.toBeTruthy(
          nameMatches,
          `${site.name}: add_to_cart event product name should match the PDP product name ("${productName}")`,
        );
      });
    });
  }
});
