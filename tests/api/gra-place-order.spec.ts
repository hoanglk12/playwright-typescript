/**
 * Note: OOS item scenario (placeOrder with OOS item in cart) is not implemented because
 * PLA staging blocks out-of-stock items at the addProductsToCart level via user_errors,
 * making it impossible to have an OOS item in the cart to reach the placeOrder stage.
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { createCheckoutBillingPaymentData } from '../../src/data/api/gra-checkout-billing-payment-data';
import { PlaceOrderData, PlaceOrderTestDataGenerator } from '../../src/data/api/gra-place-order-data';
import { BraintreeTestCardGenerator } from '../../src/data/api/gra-braintree-payment-data';
import {
  signInAndStoreToken,
  wasRejected,
  createFreshCart,
  discoverInStockSkus,
  addFirstAddableProduct,
  setShippingAddressOnCart,
  selectShippingMethod,
  setBillingAddress,
  getAvailablePaymentCodes,
  getBraintreeClientConfig,
  tokenizeCard,
  setBraintreePaymentMethod,
} from './api-test-helpers';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import {
  ADD_PRODUCTS_MUTATION,
  PLACE_ORDER_MUTATION,
  UserError as CartUserError,
} from '../../src/data/api/gra-graphql-operations';
import { PlaceOrderResultDataSchema } from '../../src/data/api/schemas/gra-place-order-schemas';

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string = '';
let checkoutCartId: string = '';
let validSku: string = '';
let shippingMethodSet: boolean = false;
let checkoutBillingData = createCheckoutBillingPaymentData('AU');
// Cart is configured through billing address in beforeAll; TC_01 mints its own Braintree
// nonce and sets payment method itself — nonces are single-use and must not be minted in
// beforeAll (would be stale on a CI retry).
let cartReadyForPayment: boolean = false;

// ── GraphQL strings ───────────────────────────────────────────────────────────

const SET_GUEST_EMAIL_MUTATION = `
  mutation SetGuestEmailOnCart($cartId: String!, $email: String!) {
    setGuestEmailOnCart(input: { cart_id: $cartId, email: $email }) {
      cart { email __typename }
      __typename
    }
  }
`;

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('GRA GraphQL API - Place Order @api @graphql', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    // Full checkout setup = 8 sequential staging API calls; the default 30s hook
    // timeout is too tight on slow brands (drm-au) and kills TC_02/TC_03 as "did not run"
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    checkoutBillingData = createCheckoutBillingPaymentData(site.countryCode);
    const logger = createTestLogger('beforeAll Place Order setup');

    // ── 1. Always-fresh auth ───────────────────────────────────────────────
    const anonClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(anonClient, logger, site, siteState);

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // ── 2. Always-fresh cart ───────────────────────────────────────────────
    await logger.step('Step 2 - Create fresh cart for TC_01 happy path', async () => {
      checkoutCartId = await createFreshCart(authClient, logger);
    });

    // ── 3. Discover in-stock SKU and OOS SKU ──────────────────────────────
    let candidateSkus: string[] = [];
    await logger.step('Step 3 - Discover in-stock product SKUs', async () => {
      candidateSkus = await discoverInStockSkus(authClient, {
        searchTerms: PlaceOrderData.productSearchTerms,
        pageSize: 20,
      });

      logger.verify('candidateSkus found', 'at least 1', candidateSkus.length);

      if (!candidateSkus.length) throw new Error('beforeAll: no in-stock product SKU found in any search');
    });

    // ── 4. Try candidate SKUs until one can be added to the TC_01 cart ────
    await logger.step('Step 4 - Add in-stock product to checkout cart (with SKU retry)', async () => {
      const result = await addFirstAddableProduct(authClient, checkoutCartId, candidateSkus, undefined, logger);
      if (!result.added) throw new Error('beforeAll: no candidate SKU could be added to cart');
      validSku = result.sku;
    });

    // ── 5. Set shipping address ────────────────────────────────────────────
    // setupOk gates Steps 6-8: mirrors the original early `return` from beforeAll —
    // once a setup step fails, no subsequent step (or its `logger.step` marker) runs.
    let setupOk = true;
    let shippingResult: Awaited<ReturnType<typeof setShippingAddressOnCart>> | undefined;
    await logger.step('Step 5 - Set shipping address on checkout cart', async () => {
      shippingResult = await setShippingAddressOnCart(authClient, checkoutCartId, checkoutBillingData.shippingInlineAddress, logger);
      if (!shippingResult.ok) setupOk = false;
    });

    // Prefer flatrate_flatrate — instore_pickup requires a Pickup Location assigned before placeOrder
    if (setupOk) {
      await logger.step('Step 6 - Set shipping method (prefer flatrate_flatrate)', async () => {
        const methodResult = await selectShippingMethod(authClient, checkoutCartId, shippingResult!.availableMethods, undefined, logger);
        if (!methodResult.ok) {
          logger.action('No suitable shipping method found (flatrate/standard)', methodResult.error ?? 'TC_01 will be skipped');
          setupOk = false;
          return;
        }
        shippingMethodSet = true;
      });
    }

    // ── 7. Set billing address (same_as_shipping) ──────────────────────────
    if (setupOk) {
      await logger.step('Step 7 - Set billing address', async () => {
        const billingResult = await setBillingAddress(authClient, checkoutCartId, { sameAsShipping: true }, logger);
        if (!billingResult.ok) setupOk = false;
      });
    }

    if (setupOk) {
      cartReadyForPayment = true;
      logger.action('beforeAll complete', 'checkout cart configured through billing address; TC_01 sets payment itself');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TC_01 — happy path
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_01 - placeOrder on fully configured cart → returns order number', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 placeOrder happy path');
    // 5 sequential calls (payment-method check, Braintree client token, tokenize, set
    // payment method, placeOrder) including one to an external host — 30s default is too tight.
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);

    if (!cartReadyForPayment) {
      test.skip(true, 'Checkout cart not configured through billing address — skipping TC_01');
      return;
    }

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let availableCodes: string[] = [];
    await logger.step('Step 1 - Check braintree is an available payment method', async () => {
      availableCodes = await getAvailablePaymentCodes(authClient, checkoutCartId);
    });
    if (!availableCodes.includes('braintree')) {
      test.skip(true, `braintree not in available_payment_methods for this brand (got: ${availableCodes.join(', ')})`);
      return;
    }

    // tokenizeResult must be readable at test scope (not inside the step callback) because the
    // test.skip() guard that follows must run at test-function scope to abort the whole test —
    // see TC_03's identical constraint below.
    let tokenizeResult: Awaited<ReturnType<typeof tokenizeCard>> | undefined;
    await logger.step('Step 2 - Create Braintree client token and tokenize sandbox card', async () => {
      const config = await getBraintreeClientConfig(authClient, logger);
      tokenizeResult = await tokenizeCard(config, BraintreeTestCardGenerator.generateSandboxVisa(), logger);
    });

    if (tokenizeResult?.outcome === 'transport_error') {
      test.skip(true, `Braintree gateway unreachable: ${tokenizeResult.error}`);
      return;
    }
    expect(tokenizeResult?.outcome, `Braintree tokenizeCreditCard rejected: ${tokenizeResult?.outcome === 'rejected' ? tokenizeResult.error : ''}`).toBe('success');
    const nonce = tokenizeResult?.outcome === 'success' ? tokenizeResult.nonce : '';

    await logger.step('Step 3 - Set Braintree payment method on cart', async () => {
      const paymentResult = await setBraintreePaymentMethod(authClient, checkoutCartId, nonce, logger);
      expect(paymentResult.ok, `setBraintreePaymentMethod failed: ${paymentResult.error ?? 'unknown'}`).toBe(true);
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 4 - Execute placeOrder mutation', async () => {
      logger.action('POST', `placeOrder (cartId=${checkoutCartId})`);
      response = await authClient.mutateWrapped(PLACE_ORDER_MUTATION, { cartId: checkoutCartId });
    });

    await logger.step('Step 5 - Assert no errors and order number returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const orderNumber = data?.placeOrder?.order?.order_number;

      logger.verify('order_number is present', true, Boolean(orderNumber));
      logger.verify(`order_number matches /\\S+/`, true, PlaceOrderData.orderNumberPattern.test(orderNumber ?? ''));
      logger.verify('placeOrder __typename', 'PlaceOrderOutput', data?.placeOrder?.__typename);

      // Hard precondition: order_number must exist before pattern/typename checks are meaningful
      expect(orderNumber, 'order_number must be defined and truthy').toBeTruthy();
      softExpect(PlaceOrderData.orderNumberPattern.test(orderNumber ?? '')).toBe(true);
      softExpect(data?.placeOrder?.__typename).toBe('PlaceOrderOutput');
      await response.assertDataSchema(PlaceOrderResultDataSchema);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TC_02 — missing shipping address
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_02 - placeOrder without shipping address → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 placeOrder missing shipping address');

    if (!validSku) {
      test.skip(true, 'No valid SKU discovered in beforeAll — skipping TC_02');
      return;
    }

    // GUEST cart, not customer cart: for an authenticated customer, createEmptyCart returns
    // the customer's existing ACTIVE cart — which beforeAll configures through billing address
    // and TC_01 then completes with payment + placeOrder. If quote deactivation lags after
    // TC_01's order, this test would receive that complete cart back and placeOrder would
    // SUCCEED, failing the negative assertion. Guest carts are guaranteed unique and genuinely
    // incomplete.
    const guestClient = await createGraphQLClient();

    let errorCartId!: string;
    await logger.step('Step 1 - Create fresh guest cart with product only (no shipping address)', async () => {
      errorCartId = await createFreshCart(guestClient);

      logger.action('POST', `addProductsToCart (cartId=${errorCartId}, sku=${validSku})`);
      const addGql = await (await guestClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId: errorCartId,
        cartItems: [{ sku: validSku, quantity: 1 }],
      })).getGraphQLResponse();
      const addUserErrors: CartUserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
      if (wasRejected(addGql, 'addProductsToCart')) {
        throw new Error(`TC_02 setup: addProductsToCart failed: ${addGql.errors?.[0]?.message ?? addUserErrors[0]?.message ?? 'unknown'}`);
      }
    });

    await logger.step('Step 2 - Set guest email (so the only missing precondition is the shipping address)', async () => {
      await guestClient.mutateWrapped(SET_GUEST_EMAIL_MUTATION, {
        cartId: errorCartId,
        email: PlaceOrderTestDataGenerator.generateGuestEmail(),
      });
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 3 - Execute placeOrder without setting shipping address', async () => {
      logger.action('POST', `placeOrder (cartId=${errorCartId})`);
      response = await guestClient.mutateWrapped(PLACE_ORDER_MUTATION, { cartId: errorCartId });
    });

    await logger.step('Step 4 - Assert error returned for missing shipping address', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

      logger.verify('Error message present for missing shipping address', true, errorMessage.length > 0);
      expect(errorMessage.length, 'Expected error message for placeOrder without shipping address').toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TC_03 — missing payment method
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_03 - placeOrder without payment method → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 placeOrder missing payment method');

    if (!shippingMethodSet) {
      test.skip(true, 'Shipping methods not available on staging — skipping TC_03');
      return;
    }

    // GUEST cart, not customer cart — see TC_02 comment: customer createEmptyCart can
    // return the cart TC_01 completed (billing from beforeAll + payment from TC_01), making
    // placeOrder succeed
    const guestClient = await createGraphQLClient();

    // Fresh guest cart: product + email + shipping address + shipping method + billing — but NO payment method
    let errorCartId!: string;
    await logger.step('Step 1 - Create fresh guest cart and add product', async () => {
      errorCartId = await createFreshCart(guestClient);

      logger.action('POST', `addProductsToCart (cartId=${errorCartId})`);
      const addGql = await (await guestClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId: errorCartId,
        cartItems: [{ sku: validSku, quantity: 1 }],
      })).getGraphQLResponse();
      const addUserErrors: CartUserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
      if (wasRejected(addGql, 'addProductsToCart')) {
        throw new Error(`TC_03 setup: addProductsToCart failed: ${addGql.errors?.[0]?.message ?? addUserErrors[0]?.message ?? 'unknown'}`);
      }
    });

    // shippingResult must be readable at test scope (not inside the step callback below) because
    // the `test.skip()` guard that follows must run at test-function scope, not inside a step
    // callback, to correctly abort the whole test rather than just the step.
    let shippingResult: Awaited<ReturnType<typeof setShippingAddressOnCart>> | undefined;
    await logger.step('Step 2 - Set guest email, shipping address and method', async () => {
      await guestClient.mutateWrapped(SET_GUEST_EMAIL_MUTATION, {
        cartId: errorCartId,
        email: PlaceOrderTestDataGenerator.generateGuestEmail(),
      });

      shippingResult = await setShippingAddressOnCart(guestClient, errorCartId, checkoutBillingData.shippingInlineAddress);
    });

    // Mirrors selectShippingMethod's own candidate search (flatrate, else non-instore_pickup) —
    // used here only to distinguish "no suitable method" (skip) from "method found but the
    // set mutation failed" (throw, below), since selectShippingMethod's result collapses both.
    const hasAvailableMethod = (shippingResult?.availableMethods ?? []).some(
      (m) => m.available && m.carrier_code !== 'instore_pickup',
    );

    if (!hasAvailableMethod) {
      test.skip(true, 'No suitable shipping method (flatrate/standard) on staging — skipping TC_03');
      return;
    }

    const methodResult = await selectShippingMethod(guestClient, errorCartId, shippingResult!.availableMethods);
    if (!methodResult.ok) {
      throw new Error(`TC_03 setup: setShippingMethodsOnCart failed: ${methodResult.error ?? 'unknown'}`);
    }

    await logger.step('Step 3 - Set billing address (no payment method)', async () => {
      const billingResult = await setBillingAddress(guestClient, errorCartId, { sameAsShipping: true });
      if (!billingResult.ok) {
        throw new Error(`TC_03 setup: setBillingAddressOnCart failed: ${billingResult.error ?? 'unknown'}`);
      }
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 4 - Execute placeOrder without setting payment method', async () => {
      logger.action('POST', `placeOrder (cartId=${errorCartId})`);
      response = await guestClient.mutateWrapped(PLACE_ORDER_MUTATION, { cartId: errorCartId });
    });

    await logger.step('Step 5 - Assert error returned for missing payment method', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

      logger.verify('Error message present for missing payment method', true, errorMessage.length > 0);
      expect(errorMessage.length, 'Expected error message for placeOrder without payment method').toBeGreaterThan(0);
    });
  });

});

