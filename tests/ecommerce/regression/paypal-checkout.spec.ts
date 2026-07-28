import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { paypalSandboxAccount } from '@data/ecommerce/payment-accounts';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import { getPreferredNavLabel, shouldPreferMens } from '../smoke/smoke-helpers';
import { addToCartAndReachCheckoutCta, fillGuestDetailsAndCommitAddress } from './checkout-helpers';

// A real Braintree-mediated PayPal sandbox round trip is a slow, external-dependency flow
// across all 8 storefronts — deliberately kept in its own regression spec (rather than folded
// into checkout.spec.ts) so a PayPal sandbox outage doesn't mask the fast DOM-scan checks there.
test.describe('Ecommerce PayPal Checkout Regression @regression @ecommerce @paypal', () => {
  // All 8 tests authorise against the SAME PayPal sandbox buyer (a single shared account in
  // payment-accounts.ts). The root config sets fullyParallel: true, which would otherwise spread
  // them across workers and open 8 concurrent sessions for that one buyer. 'default' mode runs
  // them sequentially within this file WITHOUT serial mode's cascade-skip behaviour, so a single
  // storefront failure still leaves the other 7 reporting their own result.
  test.describe.configure({ mode: 'default' });

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PLAORD-001-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Place order via Paypal using guest user`, async ({
      browserName,
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

      // The whole PayPal path (Smart Button iframe, popup window handoff, opener redirect) was
      // reconned and verified on Chromium only. CI already excludes ecommerce/regression from
      // the Firefox project; this keeps a local `npm test` run consistent with that instead of
      // doubling every PayPal sandbox round trip onto an unverified browser.
      test.skip(browserName !== 'chromium', 'PayPal sandbox flow is verified on Chromium only');

      const logger = createTestLogger(`${tcId} - ${site.name} Place order via Paypal using guest user`);
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

      const guestStep = await fillGuestDetailsAndCommitAddress({
        site,
        ecommerceCheckoutPage,
        logger,
        addressSkipContext: 'cannot reach the payment step without a confirmed address',
      });
      if (guestStep.status === 'skipped') return;

      await logger.step('Step 17b - Assert the shipping form contact fields settled (precondition)', async () => {
        // Precondition gate — must be hard: an unsettled contact field is a likely app
        // regression in the shipping form's remount behaviour, not environment/data flakiness
        // like the address-autocomplete skip above — it should turn this test red, not gray.
        expect(
          guestStep.contactFieldsSettled,
          `${site.name}: The shipping form's first name / last name / phone fields must settle on their intended values before the payment step can be reached`,
        ).toBeTruthy();
      });

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
  }
});
