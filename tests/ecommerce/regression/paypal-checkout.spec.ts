import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createGuestCheckoutEmail, createGuestShippingAddress } from '@data/ecommerce/test-accounts';
import type { GuestShippingAddress } from '@data/ecommerce/test-accounts';
import { paypalSandboxAccount } from '@data/ecommerce/payment-accounts';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import { getPreferredNavLabel, shouldPreferMens } from '../smoke/smoke-helpers';
import { addToCartAndReachCheckoutCta } from './checkout-helpers';

// E2E-PLAORD-001 — Platypus AU only (see handoff scope decision): a real Braintree-mediated
// PayPal sandbox round trip is a slow, external-dependency flow, fundamentally different in
// cost from the fast DOM-scan smoke/regression checks that loop over all 8 storefronts.
const site = storefronts.find((s) => s.name === 'Platypus AU');
if (!site) {
  throw new Error('Platypus AU storefront entry not found in storefronts.ts');
}

test.describe('Ecommerce PayPal Checkout Regression @regression @ecommerce', () => {
  test('E2E-PLAORD-001-platypus-au - Place order via Paypal using guest user', async ({
    request,
    ecommerceNavPage,
    ecommercePLPPage,
    ecommercePDPPage,
    ecommerceCartOverlayPage,
    ecommerceCheckoutPage,
  }) => {
    // PLP scan + full checkout + the PayPal sandbox popup round trip (up to NETWORK_IDLE_SLOW
    // waits x2 and a PAGE_LOAD_SLOW order-success poll) comfortably exceeds the default
    // per-test timeout even with test.slow()'s 3x multiplier applied to a fast baseline.
    test.setTimeout(TIMEOUTS.PAGE_LOAD_SLOW * 3);

    test.skip(
      !paypalSandboxAccount.password,
      'PAYPAL_SANDBOX_PASSWORD env var not set — skipping PayPal sandbox checkout test',
    );

    const logger = createTestLogger('E2E-PLAORD-001-platypus-au Place order via Paypal using guest user');
    const preferMens = shouldPreferMens(site);
    const navLabel = getPreferredNavLabel(site, preferMens);

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

    await logger.step('Step 15 - Fill a valid guest email and submit CONTINUE AS GUEST', async () => {
      const { email: guestEmail } = createGuestCheckoutEmail();
      await ecommerceCheckoutPage.fillGuestEmailAndContinue(guestEmail);
    });

    await logger.step('Step 16 - Assert the auth modal has closed and the shipping form is active', async () => {
      // Precondition gate — must be hard: every step below operates against the shipping form.
      const onShippingStep = await ecommerceCheckoutPage.isOnShippingStep();
      logger.verify('Shipping form is active after guest email submit', 'true', String(onShippingStep));
      expect(
        onShippingStep,
        `${site.name}: Submitting a valid guest email should close the auth modal and advance to the shipping address form`,
      ).toBeTruthy();
    });

    let shippingAddress!: GuestShippingAddress;
    let addressSelected = false;
    await logger.step('Step 17 - Fill guest shipping contact fields and address, selecting an address suggestion', async () => {
      shippingAddress = createGuestShippingAddress(site.storeHeader === 'nz');
      addressSelected = await ecommerceCheckoutPage.fillGuestShippingAddress(shippingAddress);
    });
    if (!addressSelected) {
      test.skip(
        true,
        `${site.name}: no address suggestion could be selected for "${shippingAddress.addressQuery}" — cannot reach the payment step without a confirmed address`,
      );
      return;
    }

    await logger.step('Step 18 - Wait for shipping methods to become selectable and select the first one', async () => {
      // RECON FINDING (Platypus AU staging) — CONTINUE TO PAYMENT stays disabled until a
      // delivery-method radio is actually checked; committing the address alone is not enough.
      await ecommerceCheckoutPage.waitForShippingMethodsReady();
      await ecommerceCheckoutPage.selectNthEnabledShippingMethod(0);
      await ecommerceCheckoutPage.waitForShippingSelectionSettled();
    });

    await logger.step('Step 19 - Assert a shipping method is checked (precondition for CONTINUE TO PAYMENT to enable)', async () => {
      // Precondition gate — must be hard: without a checked method, CONTINUE TO PAYMENT stays
      // disabled and submitCurrentStep() below would silently no-op.
      const checkedIndex = await ecommerceCheckoutPage.getCheckedShippingMethodIndex();
      logger.verify('A shipping method is checked', '!= -1', String(checkedIndex));
      expect(
        checkedIndex,
        `${site.name}: A shipping method must be checked before CONTINUE TO PAYMENT can be clicked`,
      ).not.toBe(-1);
    });

    await logger.step('Step 20 - Wait for CONTINUE TO PAYMENT to enable, then submit it', async () => {
      // RECON FINDING (Platypus AU staging) — CONTINUE TO PAYMENT's disabled state lags a
      // shipping-method radio becoming checked; submitting immediately after Step 19's checked-
      // radio assertion can still find the button disabled and silently no-op.
      await ecommerceCheckoutPage.waitForContinueToPaymentEnabled();
      await ecommerceCheckoutPage.submitCurrentStep();
    });

    await logger.step('Step 21 - Assert the payment step is active', async () => {
      // Precondition gate — must be hard: selecting the PayPal radio against the wrong page
      // state would throw or silently no-op.
      const onPaymentStep = await ecommerceCheckoutPage.isOnPaymentStep();
      logger.verify('Payment step is active', 'true', String(onPaymentStep));
      expect(
        onPaymentStep,
        `${site.name}: Submitting CONTINUE TO PAYMENT should advance to the payment-method selection step`,
      ).toBeTruthy();
    });

    await logger.step('Step 22 - Select the PayPal payment method and wait for the Smart Button to render', async () => {
      await ecommerceCheckoutPage.selectPayPalPaymentMethod();
      await ecommerceCheckoutPage.waitForPayPalSmartButtonReady();
    });

    let checkoutCompleted = false;
    await logger.step('Step 23 - Complete the PayPal sandbox popup flow (login, approve, return to storefront)', async () => {
      checkoutCompleted = await ecommerceCheckoutPage.completeBraintreePayPalCheckout(paypalSandboxAccount);
    });

    await logger.step('Step 24 - Assert the order was placed successfully', async () => {
      logger.verify('PayPal sandbox checkout completed', 'true', String(checkoutCompleted));
      expect(
        checkoutCompleted,
        `${site.name}: The PayPal sandbox checkout should complete and land on the order-success page`,
      ).toBeTruthy();

      const orderNumber = await ecommerceCheckoutPage.getOrderConfirmationNumber();
      logger.verify('Order confirmation number captured', 'non-null string', String(orderNumber));
      expect(
        orderNumber,
        `${site.name}: Order-success page should display an order confirmation number`,
      ).not.toBeNull();
    });
  });
});
