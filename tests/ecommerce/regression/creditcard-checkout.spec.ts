import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { CreditCardCheckoutData } from '@data/ecommerce/card-payment-data';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import type { CardPlaceOrderOutcome } from '../../../src/pages/ecommerce/checkout-page';
import { getPreferredNavLabel, shouldPreferMens } from '../smoke/smoke-helpers';
import { addToCartAndReachCheckoutCta, fillGuestDetailsAndCommitAddress } from './checkout-helpers';

// Opt-in gate: the sandbox test card is public Braintree test data, not a secret, so the gate is
// an explicit env var rather than a silent skip — without it, every chromium regression run would
// place real sandbox orders on all 8 storefronts.
const runCardCheckout = process.env.RUN_CARD_CHECKOUT;

// E2E-PLAORD-003 — root cause of the expected per-brand rejections is recorded in
// memory-vault/20-memory/project/gra-card-checkout-placeorder-blocker.md: the UI never calls
// setPaymentMethodOnCart before placeOrder, so most/all 8 storefronts are expected to fail here.
// That failure is the intended signal this spec characterizes — it is not a test defect.
test.describe('Ecommerce Credit Card Checkout Regression @regression @ecommerce @creditcard', () => {
  // No describe.configure({mode:'default'}) here, unlike paypal-checkout.spec.ts: PayPal shares
  // ONE external sandbox buyer account across all 8 iterations, which forces sequencing to avoid
  // concurrent sessions. This flow uses a fresh guest email and a fresh Braintree nonce per test,
  // in its own browser context — no shared mutable resource to serialize around.
  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PLAORD-003-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Place order via Credit Card using guest user`, async ({
      browserName,
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
    }) => {
      test.setTimeout(TIMEOUTS.PAGE_LOAD_SLOW * 3);

      test.skip(
        !runCardCheckout,
        'RUN_CARD_CHECKOUT env var not set — skipping to avoid placing real sandbox card orders',
      );
      test.skip(browserName !== 'chromium', 'Braintree Hosted Fields card flow is verified on Chromium only');

      const logger = createTestLogger(`${tcId} - ${site.name} Place order via Credit Card using guest user`);
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
        onPreconditionFailure: 'return',
      });
      await logger.step('Step 0-14 result - Assert the cart/checkout-reach precondition succeeded', async () => {
        expect(result.status, `${site.name}: ${result.status === 'skipped' ? result.reason : ''}`).toBe('ok');
      });
      if (result.status !== 'ok') return;

      const guestStep = await fillGuestDetailsAndCommitAddress({
        site,
        ecommerceCheckoutPage,
        logger,
        addressSkipContext: 'cannot reach the payment step without a confirmed address',
        onPreconditionFailure: 'return',
      });
      await logger.step('Step 15-17 result - Assert the guest shipping precondition succeeded', async () => {
        expect(guestStep.status, `${site.name}: ${guestStep.status === 'skipped' ? guestStep.reason : ''}`).toBe('ok');
      });
      if (guestStep.status !== 'ok') return;

      await logger.step('Step 17b - Assert the shipping form contact fields settled (precondition)', async () => {
        expect(
          guestStep.contactFieldsSettled,
          `${site.name}: The shipping form's first name / last name / phone fields must settle on their intended values before the payment step can be reached`,
        ).toBeTruthy();
      });

      await logger.step('Step 18 - Wait for shipping methods to become selectable and select the first one', async () => {
        await ecommerceCheckoutPage.waitForShippingMethodsReady();
        await ecommerceCheckoutPage.selectNthEnabledShippingMethod(0);
        await ecommerceCheckoutPage.waitForShippingSelectionSettled();
      });

      await logger.step('Step 19 - Assert a shipping method is checked (precondition for CONTINUE TO PAYMENT to enable)', async () => {
        const checkedIndex = await ecommerceCheckoutPage.getCheckedShippingMethodIndex();
        logger.verify('A shipping method is checked', '!= -1', String(checkedIndex));
        expect(
          checkedIndex,
          `${site.name}: A shipping method must be checked before CONTINUE TO PAYMENT can be clicked`,
        ).not.toBe(-1);
      });

      await logger.step('Step 20 - Wait for CONTINUE TO PAYMENT to enable, then submit it', async () => {
        await ecommerceCheckoutPage.waitForContinueToPaymentEnabled();
        await ecommerceCheckoutPage.submitCurrentStep();
      });

      await logger.step('Step 21 - Assert the payment step is active', async () => {
        const onPaymentStep = await ecommerceCheckoutPage.isOnPaymentStep();
        logger.verify('Payment step is active', 'true', String(onPaymentStep));
        expect(
          onPaymentStep,
          `${site.name}: Submitting CONTINUE TO PAYMENT should advance to the payment-method selection step`,
        ).toBeTruthy();
      });

      await logger.step('Step 22 - Select the Credit/Debit Card payment method and wait for Hosted Fields to render', async () => {
        await ecommerceCheckoutPage.selectCardPaymentMethod();
        await ecommerceCheckoutPage.waitForCardHostedFieldsReady();
      });

      await logger.step('Step 23 - Fill card details (single generated card threaded through all 3 fields)', async () => {
        const card = CreditCardCheckoutData.generateGuestCard();
        await ecommerceCheckoutPage.fillCardDetails(card);
      });

      await logger.step('Step 24 - Wait for PLACE ORDER to enable, then submit it', async () => {
        await ecommerceCheckoutPage.waitForPlaceOrderEnabled();
        await ecommerceCheckoutPage.clickPlaceOrder();
      });

      let outcome: CardPlaceOrderOutcome = { orderSucceeded: false, failureMessages: [] };
      await logger.step('Step 25 - Wait for the place-order outcome (success or a visible failure message)', async () => {
        outcome = await ecommerceCheckoutPage.waitForCardPlaceOrderOutcome();
      });

      await logger.step('Step 26 - Assert the order was placed successfully', async () => {
        logger.verify('Card checkout completed', 'true', String(outcome.orderSucceeded));
        expect(
          outcome.orderSucceeded,
          `${site.name}: PLACE ORDER should complete and land on the order-success page${
            outcome.failureMessages.length > 0 ? ` — visible failure message: "${outcome.failureMessages.join(' | ')}"` : ''
          }`,
        ).toBeTruthy();
      });

      await logger.step('Step 27 - Assert an order confirmation number is displayed', async () => {
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
