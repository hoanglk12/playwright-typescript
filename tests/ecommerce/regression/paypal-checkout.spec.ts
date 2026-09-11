import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { paypalSandboxAccount } from '@data/ecommerce/payment-accounts';
import { testAccounts, createGuestShippingAddress } from '@data/ecommerce/test-accounts';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import type { GuestShippingFillResult } from '../../../src/pages/ecommerce/checkout-page';
import { clearCustomerCartViaGraphQL, getPreferredNavLabel, shouldPreferMens } from '../smoke/smoke-helpers';
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

  // E2E-PLAORD-002 — sibling of E2E-PLAORD-001 above, logged-in instead of guest. Kept in the
  // SAME describe block (not a second file/describe) because both loops authorise against the
  // same shared PayPal sandbox buyer and the root config runs fullyParallel: true — a separate
  // file would schedule onto a different worker and risk two concurrent sessions for that one
  // buyer. This loop reuses the existing 'default' mode above it.
  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-PLAORD-002-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Place order via Paypal using logged-in user`, async ({
      browserName,
      request,
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
      ecommerceAccountModalPage,
      softAssert,
    }) => {
      // Same timeout budget and PayPal/Chromium skip rationale as E2E-PLAORD-001 above.
      test.setTimeout(TIMEOUTS.PAGE_LOAD_SLOW * 3);

      test.skip(
        !paypalSandboxAccount.password,
        'PAYPAL_SANDBOX_PASSWORD env var not set — skipping PayPal sandbox checkout test',
      );
      test.skip(browserName !== 'chromium', 'PayPal sandbox flow is verified on Chromium only');

      const account = testAccounts[site.name];
      test.skip(
        !account.password,
        'GRA_TEST_PASSWORD env var not set — skipping logged-in checkout test',
      );

      const logger = createTestLogger(`${tcId} - ${site.name} Place order via Paypal using logged-in user`);
      const preferMens = shouldPreferMens(site);
      const navLabel = getPreferredNavLabel(site, preferMens);

      await logger.step('Step 1 - Log in with the persistent QA account', async () => {
        await ecommerceAccountModalPage.navigate(site.url);
        await ecommerceAccountModalPage.openModal();
        await ecommerceAccountModalPage.waitForModalVisible();
        await ecommerceAccountModalPage.login(account.email, account.password);
        await ecommerceAccountModalPage.waitForLoginComplete();
      });

      await logger.step('Step 2 - Assert login succeeded (precondition)', async () => {
        const loggedIn = await ecommerceAccountModalPage.isLoggedIn();
        logger.verify('Logged in before proceeding to checkout', 'true', String(loggedIn));
        expect(loggedIn, `${site.name}: login must succeed before the checkout flow is meaningful`).toBeTruthy();
      });

      // Precondition hygiene, not a gate — this shared QA account's cart can accumulate items
      // left over from an incomplete prior run (e.g. Skechers AU, see memory-vault
      // ecommerce-checkout-payment-flow.md), which would desync the Step 7 pre-ATC mini-cart
      // count below. A clear failure or an already-empty cart is logged and the test continues.
      await logger.step('Step 2b - Clear any leftover cart items via GraphQL before ATC', async () => {
        const clearResult = await clearCustomerCartViaGraphQL(request, site, account);
        const reasonSuffix = clearResult.reason ? `, reason=${clearResult.reason}` : '';
        logger.verify(
          'Customer cart cleared before ATC',
          'true or false',
          `cleared=${clearResult.cleared}, itemsRemoved=${clearResult.itemsRemoved}${reasonSuffix}`,
        );
      });

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

      // A logged-in session either has a default shipping address already saved (skip the form
      // entirely) or does not (fill it, same as the guest flow). isOnShippingStep() cannot
      // distinguish the two — its heading match fires for both "DELIVER TO" (address already
      // populated) and "DELIVERY METHOD" (form still empty) — so waitForDeliverToAddressPopulated()
      // + a digit check on the resolved text is the only reliable discriminator (E2E-CHKOUT-009).
      await logger.step('Step 15 - Wait for the DELIVER TO block to settle, then determine which shipping path applies', async () => {
        await ecommerceCheckoutPage.waitForDeliverToAddressPopulated();
      });

      const diagnostics = await ecommerceCheckoutPage.getDeliverToAddressDiagnostics();
      const hasSavedAddress = /\d/.test(diagnostics.text);
      logger.verify('Saved default shipping address detected', 'true or false', String(hasSavedAddress));

      // Default (unsettled) shape mirrors fillGuestDetailsAndCommitAddress()'s own initial value
      // in checkout-helpers.ts — only overwritten below when branch (a) actually runs the fill.
      let fillResult: GuestShippingFillResult = {
        addressSelected: false,
        contactFieldsSettled: false,
        addressStillFilled: false,
      };
      if (hasSavedAddress) {
        await logger.step('Step 16 - Saved default shipping address found — skip the address form entirely', async () => {
          // No-op: proceed straight to shipping-method selection using the saved address.
        });
      } else {
        await logger.step('Step 16 - Assert the shipping address form is active (precondition)', async () => {
          const onShippingStep = await ecommerceCheckoutPage.isOnShippingStep();
          logger.verify('Shipping form is active', 'true', String(onShippingStep));
          expect(
            onShippingStep,
            `${site.name}: no saved address was found, so the shipping form must be active before it can be filled`,
          ).toBeTruthy();
        });

        const shippingAddress = createGuestShippingAddress(site.storeHeader === 'nz');
        await logger.step('Step 17 - Fill shipping contact fields and address, selecting an address suggestion', async () => {
          fillResult = await ecommerceCheckoutPage.fillGuestShippingAddress(shippingAddress);
          logger.verify('Address suggestion committed', 'true', String(fillResult.addressSelected));
        });

        if (!fillResult.addressSelected) {
          test.skip(
            true,
            `${site.name}: no address suggestion could be selected for "${shippingAddress.addressQuery}" — cannot reach the payment step without a confirmed address`,
          );
          return;
        }

        await logger.step('Step 17b - Soft-assert the shipping form contact fields settled on their intended values', async () => {
          // Soft, not hard: a logged-in account's profile may pre-populate first/last name
          // differently than the guest flow, so "settled" behaviour is not yet confirmed here
          // the way it is for the guest path in E2E-PLAORD-001.
          softAssert.toBeTruthy(
            fillResult.contactFieldsSettled,
            `${site.name}: shipping form contact fields settle on their intended values (logged-in session)`,
          );
        });
      }

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
