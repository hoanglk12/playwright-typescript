/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Checkout Shipping — setShippingAddressesOnCart, setShippingMethodsOnCart
 *
 * Prerequisites: authenticated cart with at least one product.
 * Always-fresh auth and cart per CLAUDE.md rules.
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { CheckoutShippingData } from '../../src/data/api/pla-checkout-shipping-data';
import { signInAndStoreToken } from './api-test-helpers';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';

// ── Local types ───────────────────────────────────────────────────────────────

interface ProductVariant {
  product: { sku: string; stock_status: string };
}

interface ProductItem {
  sku: string;
  stock_status: string;
  __typename: string;
  variants?: ProductVariant[];
}

interface CustomerAddress {
  id: number;
}

interface ShippingAddress {
  firstname: string;
  lastname: string;
  postcode: string;
  street: string[];
  available_shipping_methods?: ShippingMethod[];
}

interface ShippingMethod {
  carrier_code: string;
  method_code: string;
  available: boolean;
}

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string = '';
let cartId: string = '';
let validSku: string = '';
let savedAddressId: number = 0;

// ── GraphQL strings ───────────────────────────────────────────────────────────

const CREATE_ACCOUNT_MUTATION = `
  mutation CreateAccount(
    $email: String!,
    $firstname: String!,
    $lastname: String!,
    $password: String!,
    $phone_number: String!,
    $is_subscribed: Boolean!,
    $loyalty_program_status: Boolean,
    $order_number: String,
    $gender: Int,
    $date_of_birth: String
  ) {
    createCustomer(input: {
      email: $email,
      firstname: $firstname,
      lastname: $lastname,
      password: $password,
      phone_number: $phone_number,
      is_subscribed: $is_subscribed,
      loyalty_program_status: $loyalty_program_status,
      order_number: $order_number,
      gender: $gender,
      date_of_birth: $date_of_birth
    }) {
      customer { id email __typename }
    }
  }
`;

const SIGN_IN_MUTATION = `
  mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
    generateCustomerToken(email: $email, password: $password, remember: $remember) {
      token
      __typename
    }
  }
`;

const GET_PRODUCTS_QUERY = `
  query GetTestProducts($search: String!) {
    products(search: $search, pageSize: 10, currentPage: 1) {
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

const GET_CUSTOMER_ADDRESSES_QUERY = `
  query GetCustomerAddresses {
    customer {
      addresses {
        id
        firstname
        lastname
        street
        city
        region { region_code __typename }
        postcode
        country_code
        telephone
        default_shipping
        __typename
      }
      __typename
    }
  }
`;

const CREATE_CUSTOMER_ADDRESS_MUTATION = `
  mutation CreateCustomerAddress(
    $firstname: String!,
    $lastname: String!,
    $street: [String!]!,
    $city: String!,
    $region: CustomerAddressRegionInput,
    $postcode: String!,
    $country_code: CountryCodeEnum!,
    $telephone: String!,
    $default_shipping: Boolean,
    $default_billing: Boolean
  ) {
    createCustomerAddress(input: {
      firstname: $firstname,
      lastname: $lastname,
      street: $street,
      city: $city,
      region: $region,
      postcode: $postcode,
      country_code: $country_code,
      telephone: $telephone,
      default_shipping: $default_shipping,
      default_billing: $default_billing
    }) {
      id
      firstname
      lastname
      street
      city
      region { region_code __typename }
      postcode
      country_code
      telephone
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
          firstname
          lastname
          street
          city
          region { label __typename }
          postcode
          country { label __typename }
          telephone
          available_shipping_methods {
            carrier_code
            method_code
            carrier_title
            method_title
            available
            amount { value currency __typename }
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

const SET_SHIPPING_METHODS_MUTATION = `
  mutation SetShippingMethodsOnCart($cartId: String!, $carrierCode: String!, $methodCode: String!) {
    setShippingMethodsOnCart(input: {
      cart_id: $cartId,
      shipping_methods: [{ carrier_code: $carrierCode, method_code: $methodCode }]
    }) {
      cart {
        shipping_addresses {
          selected_shipping_method {
            carrier_code
            method_code
            carrier_title
            method_title
            amount { value currency __typename }
            __typename
          }
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

const GET_CART_SHIPPING_METHODS_QUERY = `
  query GetCartShippingMethods($cartId: String!) {
    cart(cart_id: $cartId) {
      shipping_addresses {
        available_shipping_methods {
          carrier_code
          method_code
          carrier_title
          method_title
          available
          amount { value currency __typename }
          __typename
        }
        selected_shipping_method {
          carrier_code
          method_code
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('PLA GraphQL API - Checkout Shipping @api @graphql', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('beforeAll Checkout Shipping setup');

    // ── 1. Always-fresh auth ───────────────────────────────────────────────
    const anonClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(anonClient, logger, site, siteState);

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // ── 2. Always-fresh cart ───────────────────────────────────────────────
    logger.step('Step 2 - Create fresh cart');
    const cartGql = await (await authClient.mutateWrapped(CREATE_CART_MUTATION)).getGraphQLResponse();
    if (cartGql.errors?.length) throw new Error(`createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`);
    cartId = cartGql.data?.cartId ?? '';
    if (!cartId) throw new Error('beforeAll: cartId is empty after createEmptyCart');
    logger.action('Cart created', cartId);

    // ── 3. Discover a valid SKU ────────────────────────────────────────────
    logger.step('Step 3 - Discover in-stock product SKU');
    for (const term of ['', 'shoe', 'nike', 'a']) {
      const productsData = await (await authClient.queryWrapped(GET_PRODUCTS_QUERY, { search: term })).getData();
      const items: ProductItem[] = productsData?.products?.items ?? [];
      for (const item of items) {
        if (item.stock_status === 'IN_STOCK' && item.__typename === 'SimpleProduct') {
          validSku = item.sku;
          break;
        }
        if (item.__typename === 'ConfigurableProduct' && Array.isArray(item.variants)) {
          const v = item.variants.find((v: ProductVariant) => v.product?.stock_status === 'IN_STOCK');
          if (v) { validSku = v.product.sku; break; }
        }
        if (!validSku && item.sku) validSku = item.sku;
      }
      if (validSku) break;
    }
    if (!validSku) throw new Error('beforeAll: no in-stock product SKU found');
    logger.verify('SKU found', 'truthy', validSku);

    // ── 4. Add product to cart ─────────────────────────────────────────────
    logger.step('Step 4 - Add product to cart');
    const addGql = await (await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
      cartId,
      cartItems: [{ sku: validSku, quantity: 1 }],
    })).getGraphQLResponse();
    if (addGql.errors?.length) throw new Error(`addProductsToCart failed: ${addGql.errors[0]?.message ?? 'unknown'}`);

    // ── 5. Find or create a saved address ─────────────────────────────────
    logger.step('Step 5 - Resolve saved customer address');
    const addrData = await (await authClient.queryWrapped(GET_CUSTOMER_ADDRESSES_QUERY)).getData();
    const addresses: CustomerAddress[] = addrData?.customer?.addresses ?? [];

    if (addresses.length > 0) {
      savedAddressId = addresses[0].id;
      logger.action('Using existing address', `id=${savedAddressId}`);
    } else {
      logger.action('No addresses found', 'attempting to create one');
      const { firstname, lastname, street, city, region, postcode, country_code, telephone, default_shipping, default_billing } = CheckoutShippingData.createAddressInput;
      const createAddrGql = await (await authClient.mutateWrapped(CREATE_CUSTOMER_ADDRESS_MUTATION, {
        firstname, lastname, street, city,
        region: { region_code: region.region_code },
        postcode, country_code, telephone,
        default_shipping, default_billing,
      })).getGraphQLResponse();

      if (!(createAddrGql.errors?.length) && createAddrGql.data?.createCustomerAddress?.id) {
        savedAddressId = createAddrGql.data.createCustomerAddress.id;
        logger.action('Address created', `id=${savedAddressId}`);
      } else {
        logger.action('Address creation failed', 'TC_02 will be skipped');
        savedAddressId = 0;
      }
    }

    logger.verify('beforeAll complete', true, true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setShippingAddressesOnCart
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_01 - setShippingAddressesOnCart with inline address → address populated on cart', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 setShippingAddressesOnCart inline address');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { firstname, lastname, street, city, region, postcode, country_code, telephone } = CheckoutShippingData.inlineAddress;

    logger.step('Step 1 - Execute setShippingAddressesOnCart with inline address');
    logger.action('POST', `setShippingAddressesOnCart (cartId=${cartId})`);
    const response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
      cartId,
      shippingAddresses: [{
        address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
      }],
    });

    logger.step('Step 2 - Assert no errors and address populated');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const shippingAddresses: ShippingAddress[] = data?.setShippingAddressesOnCart?.cart?.shipping_addresses ?? [];

    expect(shippingAddresses.length, 'shipping_addresses must not be empty').toBeGreaterThan(0);
    const addr = shippingAddresses[0];

    logger.verify('firstname', firstname, addr.firstname);
    logger.verify('lastname', lastname, addr.lastname);
    logger.verify('postcode', postcode, addr.postcode);

    softExpect(addr.firstname).toBe(firstname);
    softExpect(addr.lastname).toBe(lastname);
    softExpect(addr.postcode).toBe(postcode);
    softExpect(Array.isArray(addr.street)).toBe(true);
    softExpect(addr.street[0]).toBe(street[0]);
    softExpect(Array.isArray(addr.available_shipping_methods)).toBe(true);
  });

  test('TC_02 - setShippingAddressesOnCart with customer_address_id → saved address applied', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 setShippingAddressesOnCart customer_address_id');

    if (!savedAddressId) {
      test.skip(true, 'No saved address available — skipping TC_02');
      return;
    }

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    logger.step('Step 1 - Execute setShippingAddressesOnCart with customer_address_id');
    logger.action('POST', `setShippingAddressesOnCart (cartId=${cartId}, addressId=${savedAddressId})`);
    const response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
      cartId,
      shippingAddresses: [{ customer_address_id: savedAddressId }],
    });

    logger.step('Step 2 - Assert no errors and address applied');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const shippingAddresses: ShippingAddress[] = data?.setShippingAddressesOnCart?.cart?.shipping_addresses ?? [];

    expect(shippingAddresses.length, 'shipping_addresses must not be empty').toBeGreaterThan(0);

    const addr = shippingAddresses[0];
    logger.verify('Shipping address present', true, !!addr);
    softExpect(addr.firstname).toBeTruthy();
    softExpect(addr.postcode).toBeTruthy();
    softExpect(Array.isArray(addr.available_shipping_methods)).toBe(true);
  });

  test('TC_03 - setShippingAddressesOnCart with invalid customer_address_id → error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 setShippingAddressesOnCart invalid customer_address_id');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    logger.step('Step 1 - Execute setShippingAddressesOnCart with invalid address id');
    logger.action('POST', `setShippingAddressesOnCart (cartId=${cartId}, addressId=${CheckoutShippingData.invalidCustomerAddressId})`);
    const response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
      cartId,
      shippingAddresses: [{ customer_address_id: CheckoutShippingData.invalidCustomerAddressId }],
    });

    logger.step('Step 2 - Assert error returned');
    await response.assertHasErrors();

    const gql = await response.getGraphQLResponse();
    const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

    logger.verify('Error message present for invalid address id', true, errorMessage.length > 0);
    expect(errorMessage.length, 'Expected an error message for invalid customer_address_id').toBeGreaterThan(0);
  });

  test('TC_04 - setShippingAddressesOnCart with empty firstname → validation error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 setShippingAddressesOnCart missing required fields');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { lastname, street, city, region, postcode, country_code, telephone } = CheckoutShippingData.inlineAddress;

    logger.step('Step 1 - Execute setShippingAddressesOnCart with empty firstname');
    logger.action('POST', 'setShippingAddressesOnCart (firstname empty)');
    const response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
      cartId,
      shippingAddresses: [{
        address: { firstname: '', lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
      }],
    });

    logger.step('Step 2 - Assert validation error returned');
    const gql = await response.getGraphQLResponse();
    const hasErrors = (gql.errors?.length ?? 0) > 0;
    const errorMessage = hasErrors ? gql.errors![0]?.message ?? '' : '';

    logger.verify('Validation error present', true, hasErrors);
    expect(hasErrors, 'Expected a validation error for empty firstname').toBe(true);
    softExpect(errorMessage.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setShippingMethodsOnCart
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_05 - setShippingMethodsOnCart with first available method → selected_shipping_method updated', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 setShippingMethodsOnCart first available method');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    logger.step('Step 1 - Query cart for available shipping methods');
    const cartData = await (await authClient.queryWrapped(GET_CART_SHIPPING_METHODS_QUERY, { cartId })).getData();
    const shippingAddrs: ShippingAddress[] = cartData?.cart?.shipping_addresses ?? [];

    if (!shippingAddrs.length) {
      test.skip(true, 'No shipping address set on cart — skipping TC_05');
      return;
    }

    const availableMethods: ShippingMethod[] = shippingAddrs[0]?.available_shipping_methods ?? [];
    const firstAvailable = availableMethods.find((m: ShippingMethod) => m.available);

    if (!firstAvailable) {
      test.skip(true, 'No available shipping methods — skipping TC_05');
      return;
    }

    const { carrier_code, method_code } = firstAvailable;
    logger.action('Using method', `${carrier_code}_${method_code}`);

    logger.step('Step 2 - Execute setShippingMethodsOnCart with first available method');
    const response = await authClient.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
      cartId,
      carrierCode: carrier_code,
      methodCode: method_code,
    });

    logger.step('Step 3 - Assert no errors and selected method matches');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const selectedMethod = data?.setShippingMethodsOnCart?.cart?.shipping_addresses?.[0]?.selected_shipping_method;

    expect(selectedMethod, 'selected_shipping_method must be defined').toBeDefined();
    logger.verify('carrier_code', carrier_code, selectedMethod?.carrier_code);
    logger.verify('method_code', method_code, selectedMethod?.method_code);
    softExpect(selectedMethod?.carrier_code).toBe(carrier_code);
    softExpect(selectedMethod?.method_code).toBe(method_code);
  });

  test('TC_06 - setShippingMethodsOnCart with alternate method → method applied', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 setShippingMethodsOnCart alternate method');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    logger.step('Step 1 - Query cart for available shipping methods');
    const cartData = await (await authClient.queryWrapped(GET_CART_SHIPPING_METHODS_QUERY, { cartId })).getData();
    const shippingAddrs: ShippingAddress[] = cartData?.cart?.shipping_addresses ?? [];

    if (!shippingAddrs.length) {
      test.skip(true, 'No shipping address on cart — skipping TC_06');
      return;
    }

    const availableMethods: ShippingMethod[] = (shippingAddrs[0]?.available_shipping_methods ?? []).filter((m: ShippingMethod) => m.available);

    if (!availableMethods.length) {
      test.skip(true, 'No available shipping methods — skipping TC_06');
      return;
    }

    // Pick second method if multiple, otherwise reuse first (idempotent set)
    const targetMethod = availableMethods.length > 1 ? availableMethods[1] : availableMethods[0];
    const { carrier_code, method_code } = targetMethod;
    logger.action('Using method', `${carrier_code}_${method_code}`);

    logger.step('Step 2 - Execute setShippingMethodsOnCart with target method');
    const response = await authClient.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
      cartId,
      carrierCode: carrier_code,
      methodCode: method_code,
    });

    logger.step('Step 3 - Assert no errors and selected method applied');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const selectedMethod = data?.setShippingMethodsOnCart?.cart?.shipping_addresses?.[0]?.selected_shipping_method;

    expect(selectedMethod, 'selected_shipping_method must be defined').toBeDefined();
    logger.verify('carrier_code applied', carrier_code, selectedMethod?.carrier_code);
    logger.verify('method_code applied', method_code, selectedMethod?.method_code);
    softExpect(selectedMethod?.carrier_code).toBe(carrier_code);
    softExpect(selectedMethod?.method_code).toBe(method_code);
  });

  test('TC_07 - setShippingMethodsOnCart with invalid carrier/method → error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 setShippingMethodsOnCart invalid carrier and method');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    logger.step('Step 1 - Execute setShippingMethodsOnCart with invalid codes');
    logger.action('POST', `setShippingMethodsOnCart (carrier=${CheckoutShippingData.invalidCarrierCode}, method=${CheckoutShippingData.invalidMethodCode})`);
    const response = await authClient.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
      cartId,
      carrierCode: CheckoutShippingData.invalidCarrierCode,
      methodCode: CheckoutShippingData.invalidMethodCode,
    });

    logger.step('Step 2 - Assert error returned');
    await response.assertHasErrors();

    const gql = await response.getGraphQLResponse();
    const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

    logger.verify('Error message present for invalid carrier/method', true, errorMessage.length > 0);
    expect(errorMessage.length, 'Expected an error message for invalid carrier/method codes').toBeGreaterThan(0);
  });

});
