import { test, expect, softExpect } from '@config/base-test';
import { storefronts, type Storefront } from '@data/ecommerce/storefronts';
import { createGuestCheckoutEmail } from '@data/ecommerce/test-accounts';
import { createTestLogger } from '@utils/test-logger';
import type { TestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import type { EcommerceNavPage } from '../../../src/pages/ecommerce/nav-page';
import type { EcommercePLPPage } from '../../../src/pages/ecommerce/plp-page';
import type { EcommercePDPPage } from '../../../src/pages/ecommerce/pdp-page';
import type { EcommerceCartOverlayPage } from '../../../src/pages/ecommerce/cart-overlay-page';
import type { EcommerceCheckoutPage } from '../../../src/pages/ecommerce/checkout-page';
import type { APIRequestContext } from '@playwright/test';
import {
  getPreferredNavLabel,
  navigateToPlp,
  shouldPreferMens,
  ensureCartOverlayOpen,
  findProductWithAvailableSizes,
} from '../smoke/smoke-helpers';

// Shared setup for checkout-regression tests: verifies origin health, navigates to a PLP,
// finds a purchasable product/size, adds it to cart, and opens the checkout CTA flow up to
// (but not including) the final checkout-state assertion — each test supplies its own
// assertion after this returns. Returns `'skipped'` when a precondition forces a skip (the
// caller must `return` immediately since `test.skip()` has already been called internally).
async function addToCartAndReachCheckoutCta(params: {
  site: Storefront;
  navLabel: string | undefined;
  request: APIRequestContext;
  ecommerceNavPage: EcommerceNavPage;
  ecommercePLPPage: EcommercePLPPage;
  ecommercePDPPage: EcommercePDPPage;
  ecommerceCartOverlayPage: EcommerceCartOverlayPage;
  ecommerceCheckoutPage: EcommerceCheckoutPage;
  logger: TestLogger;
}): Promise<'ok' | 'skipped'> {
  const {
    site,
    navLabel,
    request,
    ecommerceNavPage,
    ecommercePLPPage,
    ecommercePDPPage,
    ecommerceCartOverlayPage,
    ecommerceCheckoutPage,
    logger,
  } = params;

  if (!navLabel) {
    test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
    return 'skipped';
  }

  logger.step('Step 0 - Verify storefront origin is reachable before running the full flow');
  const originHealthy = await request
    .get(site.url, { timeout: TIMEOUTS.TIMEOUT_SHORT })
    .then((response) => response.ok())
    .catch(() => false);
  if (!originHealthy) {
    test.skip(
      true,
      `${site.name}: origin failed health check (unreachable or non-2xx within ${TIMEOUTS.TIMEOUT_SHORT}ms) — skipping to avoid burning the retry/test.slow() budget on a dead backend`,
    );
    return 'skipped';
  }

  logger.step('Steps 1-5 - Navigate to PLP');
  await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

  logger.step('Step 6 - Scan PLP for a product with available sizes');
  const availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
  if (availableSizes.length === 0) {
    test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
    return 'skipped';
  }

  logger.step('Step 7 - Capture initial mini cart count before ATC');
  const initialCartCount = await ecommercePDPPage.getMiniCartCount();
  logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));

  // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
  // addToCart is called immediately after isAddToCartEnabled to minimise the window in which
  // the SPA can lose the button (observed on Vans AU with ~400ms gap). Do NOT split this into
  // selectFirstPurchasableSize() + a separate addToCart() call — that reintroduces the timing
  // gap and addToCart() silently no-ops against a stale/removed button.
  logger.step('Step 8-9 - Select a size, then Add to Cart immediately (try up to 3 sizes)');
  let targetSize: string | null = null;
  for (const size of availableSizes.slice(0, 3)) {
    await ecommercePDPPage.selectSize(size);
    if (await ecommercePDPPage.isAddToCartEnabled()) {
      targetSize = size;
      await ecommercePDPPage.addToCart();
      break;
    }
  }
  if (targetSize === null) {
    test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
    return 'skipped';
  }
  logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

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

  return 'ok';
}

test.describe('Ecommerce Checkout Regression @regression @ecommerce', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CHKOUT-001-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Checkout page loads after items added to cart`, async ({
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Checkout page loads after items added to cart`);

      const result = await addToCartAndReachCheckoutCta({
        site,
        navLabel,
        request,
        ecommerceNavPage,
        ecommercePLPPage,
        ecommercePDPPage,
        ecommerceCartOverlayPage,
        ecommerceCheckoutPage,
        logger,
      });
      if (result === 'skipped') return;

      logger.step('Step 15 - Assert checkout page has loaded');
      const onCheckoutPage = await ecommerceCheckoutPage.isOnCheckoutPage();
      logger.verify('Checkout page loaded', 'true', String(onCheckoutPage));
      expect(
        onCheckoutPage,
        `${site.name}: Checkout page (or guest-checkout auth modal) should be reachable after adding an item to cart`,
      ).toBeTruthy();
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CHKOUT-002-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Guest checkout email entry step is presented`, async ({
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Guest checkout email entry step is presented`);

      const result = await addToCartAndReachCheckoutCta({
        site,
        navLabel,
        request,
        ecommerceNavPage,
        ecommercePLPPage,
        ecommercePDPPage,
        ecommerceCartOverlayPage,
        ecommerceCheckoutPage,
        logger,
      });
      if (result === 'skipped') return;

      logger.step('Step 15 - Assert guest checkout email field is presented');
      const guestEmailFieldVisible = await ecommerceCheckoutPage.isGuestEmailFieldVisible();
      logger.verify('Guest checkout email field visible', 'true', String(guestEmailFieldVisible));
      expect(
        guestEmailFieldVisible,
        `${site.name}: Guest checkout email entry field should be presented in the auth modal after adding an item to cart`,
      ).toBeTruthy();
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CHKOUT-003-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Shipping address form validates required fields`, async ({
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Shipping address form validates required fields`);

      const result = await addToCartAndReachCheckoutCta({
        site,
        navLabel,
        request,
        ecommerceNavPage,
        ecommercePLPPage,
        ecommercePDPPage,
        ecommerceCartOverlayPage,
        ecommerceCheckoutPage,
        logger,
      });
      if (result === 'skipped') return;

      logger.step('Step 15 - Fill a valid guest email and submit CONTINUE AS GUEST');
      const { email: guestEmail } = createGuestCheckoutEmail();
      await ecommerceCheckoutPage.fillGuestEmailAndContinue(guestEmail);

      logger.step('Step 16 - Assert the auth modal has closed and the shipping form is active');
      // Precondition gate — must be hard, not soft: if the transition to the shipping form
      // never happened, the next step's blank-form submit would just re-click the SAME guest
      // CTA again and hasRequiredFieldValidation() would vacuously pass on the stale
      // "Please enter your email address." message, collapsing this test into a duplicate of
      // E2E-CHKOUT-002 while reporting green.
      const onShippingStep = await ecommerceCheckoutPage.isOnShippingStep();
      logger.verify('Shipping form is active after guest email submit', 'true', String(onShippingStep));
      expect(
        onShippingStep,
        `${site.name}: Submitting a valid guest email should close the auth modal and advance to the shipping address form`,
      ).toBeTruthy();

      logger.step('Step 17 - Submit the blank shipping form to trigger required-field validation');
      await ecommerceCheckoutPage.submitCurrentStep();

      logger.step('Step 18 - Assert required-field validation is shown on the shipping form');
      const hasValidation = await ecommerceCheckoutPage.hasRequiredFieldValidation();
      logger.verify('Shipping form required-field validation visible', 'true', String(hasValidation));
      expect(
        hasValidation,
        `${site.name}: Submitting the blank shipping address form should surface required-field validation`,
      ).toBeTruthy();

      logger.step('Step 19 - Capture validation messages for logging (observational, independent check)');
      const validationMessages = await ecommerceCheckoutPage.getValidationMessages();
      logger.verify('Shipping form validation messages captured', '>= 1 message', String(validationMessages.length));
      softExpect(validationMessages.length).toBeGreaterThan(0);
    });
  }
});
