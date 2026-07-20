/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Place Order — placeOrder mutation
 *
 * TC_01: Happy path — placeOrder on fully configured cart returns order number
 * TC_02: Missing shipping address → placeOrder returns error
 * TC_03: Missing payment method → placeOrder returns error
 *
 * Note: OOS item scenario (placeOrder with OOS item in cart) is not implemented because
 * PLA staging blocks out-of-stock items at the addProductsToCart level via user_errors,
 * making it impossible to have an OOS item in the cart to reach the placeOrder stage.
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { createCheckoutBillingPaymentData } from '../../src/data/api/gra-checkout-billing-payment-data';
import { PlaceOrderData, PlaceOrderTestDataGenerator } from '../../src/data/api/gra-place-order-data';
import { signInAndStoreToken } from './api-test-helpers';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { GraphQLResponse } from '../../src/api/GraphQLClient';

// ── Local types ───────────────────────────────────────────────────────────────

interface ShippingMethod {
  carrier_code: string;
  method_code: string;
  available: boolean;
}

interface PaymentMethod {
  code: string;
  title: string;
}

interface CartUserError {
  code: string;
  message: string;
}

interface ProductVariant {
  product: { sku: string; stock_status: string; __typename: string };
}

interface ProductItem {
  sku: string;
  stock_status: string;
  __typename: string;
  variants?: ProductVariant[];
}

// ── Module-level constants ────────────────────────────────────────────────────

const SIMPLE_PAYMENT_CODES = ['checkmo', 'afterpay', 'free', 'cashondelivery'];

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string = '';
let checkoutCartId: string = '';
let validSku: string = '';
let shippingMethodSet: boolean = false;
let checkoutBillingData = createCheckoutBillingPaymentData('AU');
let checkoutReady: boolean = false;

// ── GraphQL strings ───────────────────────────────────────────────────────────

const GET_PRODUCTS_QUERY = `
  query GetTestProducts($search: String!) {
    products(search: $search, pageSize: 20, currentPage: 1) {
      items {
        sku
        name
        stock_status
        __typename
        ... on ConfigurableProduct {
          variants {
            product { sku stock_status __typename }
          }
        }
      }
    }
  }
`;

const CREATE_CART_MUTATION = `mutation CreateCart { cartId: createEmptyCart }`;

const ADD_PRODUCTS_MUTATION = `
  mutation AddProductsToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
    addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
      cart {
        items { id quantity product { sku __typename } __typename }
        total_quantity
        __typename
      }
      user_errors { code message __typename }
      __typename
    }
  }
`;

const SET_SHIPPING_ADDRESSES_MUTATION = `
  mutation SetShippingAddressesOnCart($cartId: String!, $shippingAddresses: [ShippingAddressInput!]!) {
    setShippingAddressesOnCart(input: {
      cart_id: $cartId,
      shipping_addresses: $shippingAddresses
    }) {
      cart {
        shipping_addresses {
          available_shipping_methods {
            carrier_code
            method_code
            available
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const SET_SHIPPING_METHOD_MUTATION = `
  mutation SetShippingMethodsOnCart($cartId: String!, $carrierCode: String!, $methodCode: String!) {
    setShippingMethodsOnCart(input: {
      cart_id: $cartId,
      shipping_methods: [{ carrier_code: $carrierCode, method_code: $methodCode }]
    }) {
      cart { __typename }
      __typename
    }
  }
`;

const SET_BILLING_ADDRESS_MUTATION = `
  mutation SetBillingAddressOnCart($cartId: String!, $billingAddress: BillingAddressInput!) {
    setBillingAddressOnCart(input: {
      cart_id: $cartId,
      billing_address: $billingAddress
    }) {
      cart {
        billing_address { firstname lastname __typename }
        __typename
      }
      __typename
    }
  }
`;

const GET_AVAILABLE_PAYMENT_METHODS_QUERY = `
  query GetAvailablePaymentMethods($cartId: String!) {
    cart(cart_id: $cartId) {
      available_payment_methods { code title __typename }
      __typename
    }
  }
`;

const SET_PAYMENT_METHOD_MUTATION = `
  mutation SetPaymentMethodOnCart($cartId: String!, $paymentMethodCode: String!) {
    setPaymentMethodOnCart(input: {
      cart_id: $cartId,
      payment_method: { code: $paymentMethodCode }
    }) {
      cart {
        selected_payment_method { code title __typename }
        __typename
      }
      __typename
    }
  }
`;

const PLACE_ORDER_MUTATION = `
  mutation PlaceOrder($cartId: String!) {
    placeOrder(input: { cart_id: $cartId }) {
      order { order_number __typename }
      __typename
    }
  }
`;

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
      const cartGql = await (await authClient.mutateWrapped(CREATE_CART_MUTATION)).getGraphQLResponse();
      if (cartGql.errors?.length) throw new Error(`createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`);
      checkoutCartId = cartGql.data?.cartId ?? '';
      if (!checkoutCartId) throw new Error('beforeAll: checkoutCartId is empty after createEmptyCart');
      logger.action('Cart created', checkoutCartId);
    });

    // ── 3. Discover in-stock SKU and OOS SKU ──────────────────────────────
    let candidateSkus: string[] = [];
    await logger.step('Step 3 - Discover in-stock product SKUs', async () => {
      for (const term of PlaceOrderData.productSearchTerms) {
        const productsData = await (await authClient.queryWrapped(GET_PRODUCTS_QUERY, { search: term })).getData();
        const items: ProductItem[] = productsData?.products?.items ?? [];

        for (const item of items) {
          // Only take simple product SKUs or confirmed in-stock variant SKUs — never parent configurable SKUs
          if (item.stock_status === 'IN_STOCK' && item.__typename === 'SimpleProduct') {
            if (!candidateSkus.includes(item.sku)) candidateSkus.push(item.sku);
          } else if (item.__typename === 'ConfigurableProduct' && Array.isArray(item.variants)) {
            for (const variant of item.variants) {
              if (variant.product?.stock_status === 'IN_STOCK' && !candidateSkus.includes(variant.product.sku)) {
                candidateSkus.push(variant.product.sku);
              }
            }
          }
        }
        if (candidateSkus.length >= 3) break;
      }

      logger.verify('candidateSkus found', 'at least 1', candidateSkus.length);

      if (!candidateSkus.length) throw new Error('beforeAll: no in-stock product SKU found in any search');
    });

    // ── 4. Try candidate SKUs until one can be added to the TC_01 cart ────
    await logger.step('Step 4 - Add in-stock product to checkout cart (with SKU retry)', async () => {
      let addSucceeded = false;
      for (const sku of candidateSkus) {
        const addGql = await (await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
          cartId: checkoutCartId,
          cartItems: [{ sku, quantity: 1 }],
        })).getGraphQLResponse();
        const addUserErrors: CartUserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
        if (!(addGql.errors?.length) && !addUserErrors.length) {
          validSku = sku;
          addSucceeded = true;
          logger.action('Product added to cart', sku);
          break;
        }
        logger.action(`SKU ${sku} not addable`, addUserErrors[0]?.message ?? addGql.errors?.[0]?.message ?? 'unknown');
      }
      if (!addSucceeded) throw new Error('beforeAll: no candidate SKU could be added to cart');
    });

    // ── 5. Set shipping address ────────────────────────────────────────────
    // setupOk gates Steps 6-8: mirrors the original early `return` from beforeAll —
    // once a setup step fails, no subsequent step (or its `logger.step` marker) runs.
    let setupOk = true;
    let shippingGql!: GraphQLResponse;
    await logger.step('Step 5 - Set shipping address on checkout cart', async () => {
      const { firstname, lastname, street, city, region, postcode, country_code, telephone } = checkoutBillingData.shippingInlineAddress;
      shippingGql = await (await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
        cartId: checkoutCartId,
        shippingAddresses: [{
          address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        }],
      })).getGraphQLResponse();

      if (shippingGql.errors?.length) {
        logger.action('Shipping address setup failed', shippingGql.errors[0]?.message ?? 'unknown');
        setupOk = false;
      }
    });

    // Prefer flatrate_flatrate — instore_pickup requires a Pickup Location assigned before placeOrder
    if (setupOk) {
      await logger.step('Step 6 - Set shipping method (prefer flatrate_flatrate)', async () => {
        const availableMethods: ShippingMethod[] = shippingGql.data?.setShippingAddressesOnCart?.cart?.shipping_addresses?.[0]?.available_shipping_methods ?? [];
        const flatrate = availableMethods.find(m => m.available && m.carrier_code === 'flatrate');
        const firstAvailable = flatrate ?? availableMethods.find(m => m.available && m.carrier_code !== 'instore_pickup');

        if (!firstAvailable) {
          logger.action('No suitable shipping method found (flatrate/standard)', 'TC_01 will be skipped');
          setupOk = false;
          return;
        }

        const { carrier_code, method_code } = firstAvailable;
        const methodGql = await (await authClient.mutateWrapped(SET_SHIPPING_METHOD_MUTATION, {
          cartId: checkoutCartId,
          carrierCode: carrier_code,
          methodCode: method_code,
        })).getGraphQLResponse();

        if (methodGql.errors?.length) {
          logger.action('Shipping method setup failed', methodGql.errors[0]?.message ?? 'unknown');
          setupOk = false;
          return;
        }
        shippingMethodSet = true;
        logger.action('Shipping method set', `${carrier_code}_${method_code}`);
      });
    }

    // ── 7. Set billing address (same_as_shipping) ──────────────────────────
    if (setupOk) {
      await logger.step('Step 7 - Set billing address', async () => {
        const billingGql = await (await authClient.mutateWrapped(SET_BILLING_ADDRESS_MUTATION, {
          cartId: checkoutCartId,
          billingAddress: { same_as_shipping: true },
        })).getGraphQLResponse();

        if (billingGql.errors?.length) {
          logger.action('Billing address setup failed', billingGql.errors[0]?.message ?? 'unknown');
          setupOk = false;
        }
      });
    }

    // ── 8. Set payment method ──────────────────────────────────────────────
    if (setupOk) {
      await logger.step('Step 8 - Set payment method', async () => {
        const paymentData = await (await authClient.queryWrapped(GET_AVAILABLE_PAYMENT_METHODS_QUERY, { cartId: checkoutCartId })).getData();
        const methods: PaymentMethod[] = paymentData?.cart?.available_payment_methods ?? [];
        const paymentCode = methods.map(m => m.code).find(c => SIMPLE_PAYMENT_CODES.includes(c)) ?? '';

        if (!paymentCode) {
          logger.action('No simple payment method available', 'TC_01 will be skipped');
          setupOk = false;
          return;
        }

        const payGql = await (await authClient.mutateWrapped(SET_PAYMENT_METHOD_MUTATION, {
          cartId: checkoutCartId,
          paymentMethodCode: paymentCode,
        })).getGraphQLResponse();

        if (payGql.errors?.length) {
          logger.action('Payment method setup failed', payGql.errors[0]?.message ?? 'unknown');
          setupOk = false;
          return;
        }
        logger.action('Payment method set', paymentCode);

        checkoutReady = true;
        logger.action('beforeAll complete', 'checkout cart fully configured for TC_01');
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TC_01 — happy path
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_01 - placeOrder on fully configured cart → returns order number', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 placeOrder happy path');

    if (!checkoutReady) {
      test.skip(true, 'Checkout cart not fully configured — skipping TC_01');
      return;
    }

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute placeOrder mutation', async () => {
      logger.action('POST', `placeOrder (cartId=${checkoutCartId})`);
      response = await authClient.mutateWrapped(PLACE_ORDER_MUTATION, { cartId: checkoutCartId });
    });

    await logger.step('Step 2 - Assert no errors and order number returned', async () => {
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

    // GUEST cart, not customer cart: for an authenticated customer, createEmptyCart
    // returns the customer's existing ACTIVE cart — which beforeAll has fully configured
    // (incl. payment). If quote deactivation lags after TC_01's order, this test would
    // receive that complete cart back and placeOrder would SUCCEED, failing the negative
    // assertion. Guest carts are guaranteed unique and genuinely incomplete.
    const guestClient = await createGraphQLClient();

    let errorCartId!: string;
    await logger.step('Step 1 - Create fresh guest cart with product only (no shipping address)', async () => {
      const cartGql = await (await guestClient.mutateWrapped(CREATE_CART_MUTATION)).getGraphQLResponse();
      if (cartGql.errors?.length) throw new Error(`createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`);
      errorCartId = cartGql.data?.cartId ?? '';
      if (!errorCartId) throw new Error('TC_02: errorCartId is empty');

      logger.action('POST', `addProductsToCart (cartId=${errorCartId}, sku=${validSku})`);
      const addGql = await (await guestClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId: errorCartId,
        cartItems: [{ sku: validSku, quantity: 1 }],
      })).getGraphQLResponse();
      const addUserErrors: CartUserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
      if (addGql.errors?.length || addUserErrors.length) {
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
    // return the beforeAll-configured active cart (with payment), making placeOrder succeed
    const guestClient = await createGraphQLClient();

    // Fresh guest cart: product + email + shipping address + shipping method + billing — but NO payment method
    let errorCartId!: string;
    await logger.step('Step 1 - Create fresh guest cart and add product', async () => {
      const cartGql = await (await guestClient.mutateWrapped(CREATE_CART_MUTATION)).getGraphQLResponse();
      if (cartGql.errors?.length) throw new Error(`createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`);
      errorCartId = cartGql.data?.cartId ?? '';
      if (!errorCartId) throw new Error('TC_03: errorCartId is empty');

      logger.action('POST', `addProductsToCart (cartId=${errorCartId})`);
      const addGql = await (await guestClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId: errorCartId,
        cartItems: [{ sku: validSku, quantity: 1 }],
      })).getGraphQLResponse();
      const addUserErrors: CartUserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
      if (addGql.errors?.length || addUserErrors.length) {
        throw new Error(`TC_03 setup: addProductsToCart failed: ${addGql.errors?.[0]?.message ?? addUserErrors[0]?.message ?? 'unknown'}`);
      }
    });

    // firstAvailable must be readable at test scope (not inside the step callback below) because
    // the `test.skip()` guard that follows must run at test-function scope, not inside a step
    // callback, to correctly abort the whole test rather than just the step.
    let firstAvailable: ShippingMethod | undefined;
    await logger.step('Step 2 - Set guest email, shipping address and method', async () => {
      await guestClient.mutateWrapped(SET_GUEST_EMAIL_MUTATION, {
        cartId: errorCartId,
        email: PlaceOrderTestDataGenerator.generateGuestEmail(),
      });

      const { firstname, lastname, street, city, region, postcode, country_code, telephone } = checkoutBillingData.shippingInlineAddress;
      const shippingGql = await (await guestClient.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
        cartId: errorCartId,
        shippingAddresses: [{
          address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        }],
      })).getGraphQLResponse();

      const availableMethods: ShippingMethod[] = shippingGql.data?.setShippingAddressesOnCart?.cart?.shipping_addresses?.[0]?.available_shipping_methods ?? [];
      const flatrate = availableMethods.find(m => m.available && m.carrier_code === 'flatrate');
      firstAvailable = flatrate ?? availableMethods.find(m => m.available && m.carrier_code !== 'instore_pickup');
    });

    if (!firstAvailable) {
      test.skip(true, 'No suitable shipping method (flatrate/standard) on staging — skipping TC_03');
      return;
    }

    const methodGql = await (await guestClient.mutateWrapped(SET_SHIPPING_METHOD_MUTATION, {
      cartId: errorCartId,
      carrierCode: firstAvailable.carrier_code,
      methodCode: firstAvailable.method_code,
    })).getGraphQLResponse();
    if (methodGql.errors?.length) {
      throw new Error(`TC_03 setup: setShippingMethodsOnCart failed: ${methodGql.errors[0]?.message ?? 'unknown'}`);
    }

    await logger.step('Step 3 - Set billing address (no payment method)', async () => {
      const billingGql = await (await guestClient.mutateWrapped(SET_BILLING_ADDRESS_MUTATION, {
        cartId: errorCartId,
        billingAddress: { same_as_shipping: true },
      })).getGraphQLResponse();
      if (billingGql.errors?.length) {
        throw new Error(`TC_03 setup: setBillingAddressOnCart failed: ${billingGql.errors[0]?.message ?? 'unknown'}`);
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

