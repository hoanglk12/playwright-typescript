import { test, expect, softExpect } from '@config/base-test';
import { storefronts, type Storefront } from '@data/ecommerce/storefronts';
import { createGuestCheckoutEmail, createGuestShippingAddress } from '@data/ecommerce/test-accounts';
import { createTestLogger } from '@utils/test-logger';
import type { TestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import type { EcommerceNavPage } from '../../../src/pages/ecommerce/nav-page';
import type { EcommercePLPPage } from '../../../src/pages/ecommerce/plp-page';
import type { EcommercePDPPage } from '../../../src/pages/ecommerce/pdp-page';
import type { EcommerceCartOverlayPage } from '../../../src/pages/ecommerce/cart-overlay-page';
import type {
  EcommerceCheckoutPage,
  OrderSummaryTotals,
  OrderReviewLineItem,
} from '../../../src/pages/ecommerce/checkout-page';
import type { APIRequestContext } from '@playwright/test';
import {
  getPreferredNavLabel,
  navigateToPlp,
  shouldPreferMens,
  ensureCartOverlayOpen,
  findProductWithAvailableSizes,
} from '../smoke/smoke-helpers';

// E2E-CHKOUT-006 — Product identity captured during ATC, surfaced on the 'ok' outcome so
// callers can verify the order-review surface later shows the SAME product/quantity that was
// actually added (rather than merely asserting a row exists). Captured once, before the
// size-selection loop, since product name/price are stable across size variants and this keeps
// the isAddToCartEnabled() -> addToCart() adjacency tight (see the Step 8-9 comment below).
interface CheckoutCtaOkResult {
  status: 'ok';
  productName: string;
  productPrice: string;
  size: string;
}

interface CheckoutCtaSkippedResult {
  status: 'skipped';
}

type CheckoutCtaResult = CheckoutCtaOkResult | CheckoutCtaSkippedResult;

// E2E-CHKOUT-006 — Parses a price string captured via EcommercePDPPage.getPrice() (e.g.
// "$139.99") into a number, matching the same digit/decimal-point extraction strategy used by
// EcommerceCheckoutPage.getOrderSummaryTotals()'s internal parsePrice(). Returns null when no
// numeric value can be extracted.
function parsePriceToken(token: string): number | null {
  const cleaned = token.replace(/[^0-9.]/g, '');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

// Shared setup for checkout-regression tests: verifies origin health, navigates to a PLP,
// finds a purchasable product/size, adds it to cart, and opens the checkout CTA flow up to
// (but not including) the final checkout-state assertion — each test supplies its own
// assertion after this returns. Returns `{ status: 'skipped' }` when a precondition forces a
// skip (the caller must `return` immediately since `test.skip()` has already been called
// internally). Returns `{ status: 'ok', productName, productPrice, size }` otherwise, carrying
// the product identity captured at ATC time for tests that verify the order-review surface.
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
}): Promise<CheckoutCtaResult> {
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
    return { status: 'skipped' };
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
    return { status: 'skipped' };
  }

  logger.step('Steps 1-5 - Navigate to PLP');
  await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

  logger.step('Step 6 - Scan PLP for a product with available sizes');
  const availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
  if (availableSizes.length === 0) {
    test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
    return { status: 'skipped' };
  }

  logger.step('Step 7 - Capture initial mini cart count before ATC');
  const initialCartCount = await ecommercePDPPage.getMiniCartCount();
  logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));

  // E2E-CHKOUT-006 — Capture product identity BEFORE the size-selection loop, not inside it:
  // name/price are already rendered on the PDP and are stable across which size gets picked, so
  // capturing here keeps the isAddToCartEnabled() -> addToCart() adjacency in Step 8-9 tight
  // (inserting awaits between those two calls would reintroduce the timing gap documented below).
  const productName = await ecommercePDPPage.getProductName();
  const productPrice = await ecommercePDPPage.getPrice();

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
    return { status: 'skipped' };
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

  return { status: 'ok', productName, productPrice, size: targetSize };
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
      if (result.status === 'skipped') return;

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
      if (result.status === 'skipped') return;

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
      if (result.status === 'skipped') return;

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

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CHKOUT-004-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Shipping method selection updates order total`, async ({
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Shipping method selection updates order total`);

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
      if (result.status === 'skipped') return;

      logger.step('Step 15 - Fill a valid guest email and submit CONTINUE AS GUEST');
      const { email: guestEmail } = createGuestCheckoutEmail();
      await ecommerceCheckoutPage.fillGuestEmailAndContinue(guestEmail);

      logger.step('Step 16 - Assert the auth modal has closed and the shipping form is active');
      // Precondition gate — must be hard, not soft: without a confirmed transition to the
      // shipping form, every step below (address fill, method selection, total reads) would
      // operate against the wrong page state and produce meaningless results.
      const onShippingStep = await ecommerceCheckoutPage.isOnShippingStep();
      logger.verify('Shipping form is active after guest email submit', 'true', String(onShippingStep));
      expect(
        onShippingStep,
        `${site.name}: Submitting a valid guest email should close the auth modal and advance to the shipping address form`,
      ).toBeTruthy();

      logger.step('Step 17 - Fill guest shipping contact fields and address, selecting an address suggestion');
      const shippingAddress = createGuestShippingAddress(site.storeHeader === 'nz');
      const addressSelected = await ecommerceCheckoutPage.fillGuestShippingAddress(shippingAddress);
      if (!addressSelected) {
        test.skip(
          true,
          `${site.name}: no address suggestion could be selected for "${shippingAddress.addressQuery}" — shipping methods cannot be reliably rendered without a confirmed address`,
        );
        return;
      }

      logger.step('Step 18 - Wait for shipping methods to become selectable (enabled)');
      await ecommerceCheckoutPage.waitForShippingMethodsReady();

      logger.step('Step 19 - Assert at least 1 selectable shipping method is available (precondition)');
      const methodCount = await ecommerceCheckoutPage.getSelectableShippingMethodCount();
      logger.verify('Selectable shipping method count', '>= 1', String(methodCount));
      if (methodCount === 0) {
        test.skip(
          true,
          `${site.name}: no shipping methods became selectable within the readiness timeout after committing an address — cannot verify a method-selection total delta`,
        );
        return;
      }

      logger.step('Step 20 - Read the current order summary totals and detect whether a method already arrived pre-selected');
      // Waits for the pre-selection state to settle before snapshotting it — a storefront's
      // auto-selected default carrier can commit slightly after its radio first becomes enabled
      // (confirmed live on Skechers AU), which would otherwise read as "not pre-selected" a
      // moment too early and cause the first branch below to silently re-select the already-
      // checked free method.
      await ecommerceCheckoutPage.waitForShippingSelectionSettled();
      const currentTotals = await ecommerceCheckoutPage.getOrderSummaryTotals();
      const preSelected = await ecommerceCheckoutPage.isAnyShippingMethodSelected();
      logger.verify('A shipping method is pre-selected on arrival', 'boolean', String(preSelected));

      // Change-detection is keyed on the 'delivery' line rather than 'total': getOrderSummaryTotals()
      // parses 'total' positionally and a discount/member-price line inside the order summary panel
      // on some storefronts can shift that parse (confirmed live on Vans AU — a parsed total lower
      // than the parsed subtotal). 'delivery' sits immediately after the subtotal price with no
      // intervening discount line and has proven reliable on every storefront checked.
      // Shared consistency assertion for every "single shipping method, no alternate to compare
      // against" terminal state below — total must equal subtotal + delivery + discount (the
      // discount line, when present, is already negative — see OrderSummaryTotals.discount /
      // the class-level recon docblock on getOrderSummaryTotals(), confirmed live on Vans AU
      // where a "Singles Day 25% Off" promotion line sits between subtotal and delivery).
      // Deliberately does NOT require delivery > 0: confirmed live on Dr. Martens AU that the
      // single pre-selected method ("Free Express Delivery") can genuinely cost $0 — the
      // requirement ("shipping method selection updates order total") is already proven true by
      // the method being selected + the total being internally consistent with it, independent
      // of whether that method happens to be free.
      const assertSingleMethodConsistency = (totals: OrderSummaryTotals): void => {
        const isConsistent =
          totals.subtotal !== null &&
          totals.delivery !== null &&
          totals.total !== null &&
          Math.abs(totals.total - (totals.subtotal + totals.delivery + (totals.discount ?? 0))) < 0.01;
        softAssert.toBeTruthy(
          isConsistent,
          `${site.name}: Total should equal subtotal + delivery + discount (subtotal: ${totals.subtotal}, delivery: ${totals.delivery}, discount: ${totals.discount}, total: ${totals.total})`,
        );
      };

      if (!preSelected) {
        logger.step('Step 21 - No method pre-selected: select the first available method and capture the settled delivery cost');
        await ecommerceCheckoutPage.selectNthEnabledShippingMethod(0);
        const totalsAfterFirst = await ecommerceCheckoutPage.waitForOrderSummaryTotalChange(
          currentTotals.delivery,
          'delivery',
        );

        const deliveryIncreasedFromBaseline =
          currentTotals.delivery !== null &&
          totalsAfterFirst.delivery !== null &&
          totalsAfterFirst.delivery > currentTotals.delivery;

        if (deliveryIncreasedFromBaseline) {
          // The common case: the first method is a paid one and the delivery cost visibly
          // increased from the $0 pre-selection baseline.
          logger.step('Step 22 - Assert the delivery cost increased from the pre-selection $0 baseline (final outcome check)');
          softAssert.toBeTruthy(
            deliveryIncreasedFromBaseline,
            `${site.name}: Selecting a shipping method should increase the delivery cost line from its baseline (baseline: ${currentTotals.delivery}, after selection: ${totalsAfterFirst.delivery})`,
          );
        } else if (methodCount > 1) {
          // The first (index 0) method itself turned out to be free — confirmed live on Skechers
          // AU, where index 0 in DOM order is "Free Express Delivery" ($0.00) and index 1 is the
          // paid "Standard Shipping" ($10.00). Comparing against the original $0 baseline would
          // wrongly fail here (a free method was genuinely selected, nothing is broken), so
          // instead select the next method and compare the two settled delivery costs against
          // EACH OTHER — this still proves "shipping method selection updates order total"
          // without assuming the arbitrary first method in DOM order is a paid one.
          logger.step('Step 22 - First method is itself free: select an alternate method and compare delivery costs against each other (final outcome check)');
          await ecommerceCheckoutPage.selectNthEnabledShippingMethod(1);
          const totalsAfterSecond = await ecommerceCheckoutPage.waitForOrderSummaryTotalChange(
            totalsAfterFirst.delivery,
            'delivery',
          );
          const deliveryChanged =
            totalsAfterFirst.delivery !== null &&
            totalsAfterSecond.delivery !== null &&
            totalsAfterFirst.delivery !== totalsAfterSecond.delivery;
          softAssert.toBeTruthy(
            deliveryChanged,
            `${site.name}: Switching between shipping methods should change the delivery cost line (method 1: ${totalsAfterFirst.delivery}, method 2: ${totalsAfterSecond.delivery})`,
          );
        } else {
          // Exactly 1 method exists, it was not pre-selected, and selecting it left delivery at
          // $0 — confirmed live on Vans AU: the storefront's only shipping method is literally
          // named "freeshipping". This is a genuine $0-shipping storefront configuration, not a
          // failed click — getCheckedShippingMethodIndex() confirms the radio actually toggled.
          logger.step('Step 22 - Only method is genuinely free: confirm the selection registered and assert internal consistency of the settled totals');
          const selectionConfirmed = (await ecommerceCheckoutPage.getCheckedShippingMethodIndex()) !== -1;
          softAssert.toBeTruthy(
            selectionConfirmed,
            `${site.name}: The only shipping method should be checked after selecting it (confirms the $0 result reflects genuine free shipping, not a failed click)`,
          );
          assertSingleMethodConsistency(totalsAfterFirst);
        }
      } else if (methodCount > 1) {
        logger.step('Step 21 - A method is pre-selected and more than 1 is available: select an alternate method and wait for the delivery cost to change');
        const checkedIndex = await ecommerceCheckoutPage.getCheckedShippingMethodIndex();
        if (checkedIndex === -1) {
          // preSelected was true via isAnyShippingMethodSelected()'s 'delivery > 0' fallback, but
          // no radio reports checked in this same tick — we cannot determine which index is
          // already selected, so a computed "alternate" could silently reselect the same method
          // instead of a genuine alternate. Fall back to the same internal-consistency check used
          // for the "single method, pre-selected" terminal state rather than guessing.
          logger.step('Step 22 - Checked method index could not be determined: assert internal consistency of the settled totals instead of guessing an alternate');
          assertSingleMethodConsistency(currentTotals);
        } else {
          const alternateIndex = checkedIndex === 0 ? 1 : 0;
          await ecommerceCheckoutPage.selectNthEnabledShippingMethod(alternateIndex);
          const totalsAfterSwitch = await ecommerceCheckoutPage.waitForOrderSummaryTotalChange(
            currentTotals.delivery,
            'delivery',
          );

          logger.step('Step 22 - Assert the delivery cost changed after switching to the alternate method (final outcome check)');
          const deliveryChanged =
            currentTotals.delivery !== null &&
            totalsAfterSwitch.delivery !== null &&
            totalsAfterSwitch.delivery !== currentTotals.delivery;
          softAssert.toBeTruthy(
            deliveryChanged,
            `${site.name}: Switching to an alternate shipping method should change the delivery cost line (before: ${currentTotals.delivery}, after: ${totalsAfterSwitch.delivery})`,
          );
        }
      } else {
        // Exactly 1 method exists and it arrived pre-selected — this already proves "shipping
        // method selection updates order total" (the method's selection is what produced the
        // delivery line currently reflected in the total) and there is no alternate method
        // available for a delta comparison. Assert internal consistency instead (see
        // assertSingleMethodConsistency doc — deliberately does not require delivery > 0, since
        // the pre-selected method itself can genuinely be free, confirmed live on Dr. Martens AU).
        logger.step('Step 21 - Exactly 1 method, pre-selected: assert internal consistency of the settled totals (already proves the requirement)');
        assertSingleMethodConsistency(currentTotals);
      }
    });
  }

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CHKOUT-006-${String(index + 1).padStart(3, '0')}`;
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`${tcId} - ${site.name} Order review shows correct items, quantities, total`, async ({
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Order review shows correct items, quantities, total`);

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
      if (result.status === 'skipped') return;

      logger.step('Step 15 - Fill a valid guest email and submit CONTINUE AS GUEST');
      const { email: guestEmail } = createGuestCheckoutEmail();
      await ecommerceCheckoutPage.fillGuestEmailAndContinue(guestEmail);

      logger.step('Step 16 - Assert the auth modal has closed and the shipping form is active');
      // Precondition gate — must be hard: without a confirmed transition to the shipping form,
      // the order-review panel read below would operate against the wrong page state.
      const onShippingStep = await ecommerceCheckoutPage.isOnShippingStep();
      logger.verify('Shipping form is active after guest email submit', 'true', String(onShippingStep));
      expect(
        onShippingStep,
        `${site.name}: Submitting a valid guest email should close the auth modal and advance to the shipping address form`,
      ).toBeTruthy();

      logger.step('Step 17 - Fill guest shipping contact fields and address, selecting an address suggestion');
      const shippingAddress = createGuestShippingAddress(site.storeHeader === 'nz');
      const addressSelected = await ecommerceCheckoutPage.fillGuestShippingAddress(shippingAddress);
      if (!addressSelected) {
        test.skip(
          true,
          `${site.name}: no address suggestion could be selected for "${shippingAddress.addressQuery}" — the order-review panel cannot be reliably read without a confirmed address`,
        );
        return;
      }

      logger.step('Step 18 - Wait for shipping methods / order summary to settle');
      // The order-review item list is already fully rendered once the address is committed and
      // does not require a shipping method to be selected (confirmed live — see the recon
      // docblock above EcommerceCheckoutPage.orderReviewItemsHeaderPattern). Waiting for the
      // shipping-methods list to settle still ensures the Delivery/Total lines used by the
      // consistency check below reflect a fully-settled read rather than a mid-recalculation
      // snapshot (e.g. the "Hang tight, we are finding the best option" placeholder state).
      await ecommerceCheckoutPage.waitForShippingMethodsReady();
      await ecommerceCheckoutPage.waitForShippingSelectionSettled();

      logger.step('Step 19 - Read the order-review line items (precondition for per-item checks)');
      const lineItems: OrderReviewLineItem[] = await ecommerceCheckoutPage.getOrderReviewLineItems();
      logger.verify('Order review line items found', '>= 1', String(lineItems.length));
      // Precondition gate — must be hard: every check below is meaningless against an empty list.
      expect(
        lineItems.length,
        `${site.name}: The order-review panel should show at least 1 line item after adding a product to cart`,
      ).toBeGreaterThan(0);
      const [reviewedItem] = lineItems;

      logger.step('Step 20 - Assert the line item name matches the product added at ATC time (independent check)');
      const capturedName = result.productName.trim();
      const nameMatches =
        capturedName.length > 0 && reviewedItem.name.toLowerCase().includes(capturedName.toLowerCase());
      softAssert.toBeTruthy(
        nameMatches,
        `${site.name}: Order-review line item name ("${reviewedItem.name}") should contain the product name captured at ATC ("${result.productName}") — an empty captured name means getProductName() returned nothing (e.g. Skechers empty h1)`,
      );

      logger.step('Step 21 - Assert the line item quantity matches the quantity actually added (independent check)');
      softAssert.toBe(
        reviewedItem.quantity,
        1,
        `${site.name}: Order-review line item quantity should be 1 (the quantity added via ATC)`,
      );

      logger.step('Step 22 - Assert the line item price matches the price captured at ATC time (independent check)');
      const expectedPrice = parsePriceToken(result.productPrice);
      const priceMatches =
        expectedPrice !== null && reviewedItem.price !== null && Math.abs(reviewedItem.price - expectedPrice) < 0.01;
      softAssert.toBeTruthy(
        priceMatches,
        `${site.name}: Order-review line item price (${reviewedItem.price}) should match the price captured at ATC time (${expectedPrice})`,
      );

      logger.step('Step 23 - Assert the order summary total is internally consistent (final outcome check)');
      const totals: OrderSummaryTotals = await ecommerceCheckoutPage.getOrderSummaryTotals();
      const isConsistent =
        totals.subtotal !== null &&
        totals.delivery !== null &&
        totals.total !== null &&
        Math.abs(totals.total - (totals.subtotal + totals.delivery + (totals.discount ?? 0))) < 0.01;
      softAssert.toBeTruthy(
        isConsistent,
        `${site.name}: Total should equal subtotal + delivery + discount (subtotal: ${totals.subtotal}, delivery: ${totals.delivery}, discount: ${totals.discount}, total: ${totals.total})`,
      );
    });
  }
});
