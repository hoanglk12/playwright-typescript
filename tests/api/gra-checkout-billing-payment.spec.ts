/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Checkout Billing & Payment — setBillingAddressOnCart, setPaymentMethodOnCart
 *
 * Prerequisites: authenticated cart with at least one product and shipping address/method set.
 * Always-fresh auth and cart per CLAUDE.md rules.
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { createCheckoutBillingPaymentData } from '../../src/data/api/gra-checkout-billing-payment-data';
import {
  signInAndStoreToken,
  createFreshCart,
  discoverInStockSkus,
  addFirstAddableProduct,
  setShippingAddressOnCart,
  selectShippingMethod,
} from './api-test-helpers';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import {
  GET_AVAILABLE_PAYMENT_METHODS_QUERY,
  SET_BILLING_ADDRESS_MUTATION,
  SET_PAYMENT_METHOD_MUTATION,
  PaymentMethod,
  SKU_DISCOVERY_DEFAULTS,
} from '../../src/data/api/gra-graphql-operations';

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string = '';
let cartId: string = '';
let shippingMethodSet: boolean = false;
let availablePaymentMethods: string[] = [];
let checkoutBillingData = createCheckoutBillingPaymentData('AU');

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('GRA GraphQL API - Checkout Billing & Payment @api @graphql', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    // 7+ sequential staging calls; default 30s hook timeout is too tight on slow brands
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    checkoutBillingData = createCheckoutBillingPaymentData(site.countryCode);
    const logger = createTestLogger('beforeAll Checkout Billing & Payment setup');

    // ── 1. Always-fresh auth ───────────────────────────────────────────────
    const anonClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(anonClient, logger, site, siteState);

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // ── 2. Always-fresh cart ───────────────────────────────────────────────
    await logger.step('Step 2 - Create fresh cart', async () => {
      cartId = await createFreshCart(authClient, logger);
    });

    // ── 3. Discover in-stock candidate SKUs ───────────────────────────────
    let candidateSkus: string[] = [];
    await logger.step('Step 3 - Discover in-stock product SKU candidates', async () => {
      candidateSkus = await discoverInStockSkus(authClient, SKU_DISCOVERY_DEFAULTS);
      if (!candidateSkus.length) throw new Error('beforeAll: no in-stock product SKU found');
    });

    // ── 4. Try candidate SKUs until one adds successfully ─────────────────
    await logger.step('Step 4 - Add in-stock product to cart (with SKU retry)', async () => {
      const result = await addFirstAddableProduct(authClient, cartId, candidateSkus, undefined, logger);
      if (!result.added) throw new Error('beforeAll: no candidate SKU could be added to cart');
      logger.verify('SKU added', 'truthy', result.sku);
    });

    // ── 5. Set shipping address (required for same_as_shipping and payment) ─
    let shippingResult: Awaited<ReturnType<typeof setShippingAddressOnCart>> | undefined;
    await logger.step('Step 5 - Set shipping address', async () => {
      shippingResult = await setShippingAddressOnCart(authClient, cartId, checkoutBillingData.shippingInlineAddress, logger);
    });

    // ── 6. Set shipping method ──────────────────────────────────────────────
    // selectShippingMethod prefers flatrate_flatrate over "first available" (its default) —
    // this file only asserts billing/payment, never carrier/method code, so the change is safe.
    if (shippingResult?.ok) {
      await logger.step('Step 6 - Set shipping method', async () => {
        const methodResult = await selectShippingMethod(authClient, cartId, shippingResult!.availableMethods, undefined, logger);
        if (methodResult.ok) {
          shippingMethodSet = true;
        } else {
          logger.action('No available shipping methods found', methodResult.error ?? 'TC_03/TC_04 may be skipped');
        }
      });
    }

    // ── 7. Query available payment methods ─────────────────────────────────
    await logger.step('Step 7 - Query available payment methods', async () => {
      try {
        const paymentData = await (await authClient.queryWrapped(GET_AVAILABLE_PAYMENT_METHODS_QUERY, { cartId })).getData();
        const methods: PaymentMethod[] = paymentData?.cart?.available_payment_methods ?? [];
        availablePaymentMethods = methods.map((m: PaymentMethod) => m.code);
        logger.action('Available payment methods', availablePaymentMethods.join(', ') || 'none');
      } catch {
        logger.action('Payment methods query failed', 'may be unavailable without shipping method');
      }

      logger.action('beforeAll complete', 'all setup steps finished');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setBillingAddressOnCart
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_01 - setBillingAddressOnCart same_as_shipping: true → billing mirrors shipping', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 setBillingAddressOnCart same_as_shipping true');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setBillingAddressOnCart with same_as_shipping: true', async () => {
      logger.action('POST', `setBillingAddressOnCart (cartId=${cartId}, same_as_shipping=true)`);
      response = await authClient.mutateWrapped(SET_BILLING_ADDRESS_MUTATION, {
        cartId,
        billingAddress: { same_as_shipping: true },
      });
    });

    await logger.step('Step 2 - Assert no errors and billing address populated', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const billingAddr = data?.setBillingAddressOnCart?.cart?.billing_address;

      expect(billingAddr, 'billing_address must be defined and not null — staging confirms same_as_shipping populates it').not.toBeNull();

      const { firstname, postcode } = checkoutBillingData.shippingInlineAddress;
      logger.verify('firstname matches shipping', firstname, billingAddr?.firstname);
      logger.verify('postcode matches shipping', postcode, billingAddr?.postcode);
      softExpect(billingAddr?.firstname).toBe(firstname);
      softExpect(billingAddr?.postcode).toBe(postcode);
      softExpect(Array.isArray(billingAddr?.street)).toBe(true);
    });
  });

  test('TC_02 - setBillingAddressOnCart inline address → custom billing address set', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 setBillingAddressOnCart inline billing address');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { firstname, lastname, street, city, region, postcode, country_code, telephone } = checkoutBillingData.billingInlineAddress;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setBillingAddressOnCart with inline billing address', async () => {
      logger.action('POST', `setBillingAddressOnCart (cartId=${cartId})`);
      response = await authClient.mutateWrapped(SET_BILLING_ADDRESS_MUTATION, {
        cartId,
        billingAddress: {
          address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        },
      });
    });

    await logger.step('Step 2 - Assert no errors and billing address matches input', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const billingAddr = data?.setBillingAddressOnCart?.cart?.billing_address;

      expect(billingAddr, 'billing_address must be defined').toBeDefined();
      expect(billingAddr, 'billing_address must not be null for inline address').not.toBeNull();

      logger.verify('firstname', firstname, billingAddr?.firstname);
      logger.verify('lastname', lastname, billingAddr?.lastname);
      logger.verify('postcode', postcode, billingAddr?.postcode);

      softExpect(billingAddr?.firstname).toBe(firstname);
      softExpect(billingAddr?.lastname).toBe(lastname);
      softExpect(billingAddr?.postcode).toBe(postcode);
      softExpect(Array.isArray(billingAddr?.street)).toBe(true);
      softExpect(billingAddr?.street?.[0]).toBe(street[0]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setPaymentMethodOnCart
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_03 - setPaymentMethodOnCart checkmo → selected_payment_method updated', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 setPaymentMethodOnCart checkmo');

    if (!shippingMethodSet || availablePaymentMethods.length === 0) {
      test.skip(true, 'No shipping method set or no payment methods available — skipping TC_03');
      return;
    }

    const targetCode = availablePaymentMethods.includes('checkmo')
      ? 'checkmo'
      : availablePaymentMethods[0];

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step(`Step 1 - Execute setPaymentMethodOnCart with code=${targetCode}`, async () => {
      logger.action('POST', `setPaymentMethodOnCart (cartId=${cartId}, code=${targetCode})`);
      response = await authClient.mutateWrapped(SET_PAYMENT_METHOD_MUTATION, {
        cartId,
        paymentMethodCode: targetCode,
      });
    });

    await logger.step('Step 2 - Assert no errors and payment method applied', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const selectedMethod = data?.setPaymentMethodOnCart?.cart?.selected_payment_method;

      expect(selectedMethod, 'selected_payment_method must be defined').toBeDefined();
      logger.verify('payment code', targetCode, selectedMethod?.code);
      softExpect(selectedMethod?.code).toBe(targetCode);
      softExpect(selectedMethod?.title).toBeTruthy();
    });
  });

  test('TC_04 - setPaymentMethodOnCart alternate method → payment method applied', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 setPaymentMethodOnCart alternate method');

    if (!shippingMethodSet || availablePaymentMethods.length === 0) {
      test.skip(true, 'No shipping method set or no payment methods available — skipping TC_04');
      return;
    }

    // Braintree variants require SDK-provided payment nonce — not testable in isolation.
    // Prefer afterpay or another simple method; skip if none available beyond checkmo.
    const simpleAlternates = ['afterpay', 'free', 'cashondelivery', 'banktransfer', 'purchaseorder'];
    const targetCode =
      availablePaymentMethods.find(c => simpleAlternates.includes(c)) ??
      availablePaymentMethods.find(c => c !== 'checkmo' && !c.includes('braintree')) ??
      '';

    if (!targetCode) {
      test.skip(true, 'No suitable alternate payment method (non-checkmo, non-braintree) — skipping TC_04');
      return;
    }

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step(`Step 1 - Execute setPaymentMethodOnCart with alternate code=${targetCode}`, async () => {
      logger.action('POST', `setPaymentMethodOnCart (cartId=${cartId}, code=${targetCode})`);
      response = await authClient.mutateWrapped(SET_PAYMENT_METHOD_MUTATION, {
        cartId,
        paymentMethodCode: targetCode,
      });
    });

    await logger.step('Step 2 - Assert no errors and alternate payment method applied', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const selectedMethod = data?.setPaymentMethodOnCart?.cart?.selected_payment_method;

      expect(selectedMethod, 'selected_payment_method must be defined').toBeDefined();
      logger.verify('alternate payment code applied', targetCode, selectedMethod?.code);
      softExpect(selectedMethod?.code).toBe(targetCode);
      softExpect(selectedMethod?.title).toBeTruthy();
    });
  });

  test('TC_05 - setPaymentMethodOnCart invalid code → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 setPaymentMethodOnCart invalid code');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setPaymentMethodOnCart with invalid code', async () => {
      logger.action('POST', `setPaymentMethodOnCart (cartId=${cartId}, code=${checkoutBillingData.invalidPaymentCode})`);
      response = await authClient.mutateWrapped(SET_PAYMENT_METHOD_MUTATION, {
        cartId,
        paymentMethodCode: checkoutBillingData.invalidPaymentCode,
      });
    });

    await logger.step('Step 2 - Assert error returned for invalid payment code', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

      logger.verify('Error message present for invalid payment code', true, errorMessage.length > 0);
      expect(errorMessage.length, 'Expected an error message for invalid payment code').toBeGreaterThan(0);
    });
  });

});
