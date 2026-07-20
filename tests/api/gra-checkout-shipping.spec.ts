/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Checkout Shipping — setShippingAddressesOnCart, setShippingMethodsOnCart
 *
 * Prerequisites: authenticated cart with at least one product.
 * Always-fresh auth and cart per CLAUDE.md rules.
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { createCheckoutShippingData } from '../../src/data/api/gra-checkout-shipping-data';
import { signInAndStoreToken, createFreshCart, discoverInStockSkus, addFirstAddableProduct } from './api-test-helpers';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import {
  SET_SHIPPING_ADDRESSES_RICH_MUTATION,
  SET_SHIPPING_METHODS_MUTATION,
  SKU_DISCOVERY_DEFAULTS,
} from '../../src/data/api/gra-graphql-operations';

// ── Local types ───────────────────────────────────────────────────────────────

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
let checkoutData = createCheckoutShippingData('AU');

// ── GraphQL strings ───────────────────────────────────────────────────────────

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

test.describe('GRA GraphQL API - Checkout Shipping @api @graphql', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    // 6+ sequential staging calls; default 30s hook timeout is too tight on slow brands
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    checkoutData = createCheckoutShippingData(site.countryCode);
    const logger = createTestLogger('beforeAll Checkout Shipping setup');

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
      validSku = result.sku;
      logger.verify('SKU added', 'truthy', validSku);
    });

    // ── 5. Find or create a saved address ─────────────────────────────────
    await logger.step('Step 5 - Resolve saved customer address', async () => {
      const addrData = await (await authClient.queryWrapped(GET_CUSTOMER_ADDRESSES_QUERY)).getData();
      const addresses: CustomerAddress[] = addrData?.customer?.addresses ?? [];

      if (addresses.length > 0) {
        savedAddressId = addresses[0].id;
        logger.action('Using existing address', `id=${savedAddressId}`);
      } else {
        logger.action('No addresses found', 'attempting to create one');
        const { firstname, lastname, street, city, region, postcode, country_code, telephone, default_shipping, default_billing } = checkoutData.createAddressInput;
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setShippingAddressesOnCart
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_01 - setShippingAddressesOnCart with inline address → address populated on cart', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 setShippingAddressesOnCart inline address');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { firstname, lastname, street, city, region, postcode, country_code, telephone } = checkoutData.inlineAddress;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setShippingAddressesOnCart with inline address', async () => {
      logger.action('POST', `setShippingAddressesOnCart (cartId=${cartId})`);
      response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_RICH_MUTATION, {
        cartId,
        shippingAddresses: [{
          address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        }],
      });
    });

    await logger.step('Step 2 - Assert no errors and address populated', async () => {
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
  });

  test('TC_02 - setShippingAddressesOnCart with customer_address_id → saved address applied', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 setShippingAddressesOnCart customer_address_id');

    if (!savedAddressId) {
      test.skip(true, 'No saved address available — skipping TC_02');
      return;
    }

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setShippingAddressesOnCart with customer_address_id', async () => {
      logger.action('POST', `setShippingAddressesOnCart (cartId=${cartId}, addressId=${savedAddressId})`);
      response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_RICH_MUTATION, {
        cartId,
        shippingAddresses: [{ customer_address_id: savedAddressId }],
      });
    });

    await logger.step('Step 2 - Assert no errors and address applied', async () => {
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
  });

  test('TC_03 - setShippingAddressesOnCart with invalid customer_address_id → error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 setShippingAddressesOnCart invalid customer_address_id');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setShippingAddressesOnCart with invalid address id', async () => {
      logger.action('POST', `setShippingAddressesOnCart (cartId=${cartId}, addressId=${checkoutData.invalidCustomerAddressId})`);
      response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_RICH_MUTATION, {
        cartId,
        shippingAddresses: [{ customer_address_id: checkoutData.invalidCustomerAddressId }],
      });
    });

    await logger.step('Step 2 - Assert error returned', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

      logger.verify('Error message present for invalid address id', true, errorMessage.length > 0);
      expect(errorMessage.length, 'Expected an error message for invalid customer_address_id').toBeGreaterThan(0);
    });
  });

  test('TC_04 - setShippingAddressesOnCart with empty firstname → validation error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 setShippingAddressesOnCart missing required fields');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { lastname, street, city, region, postcode, country_code, telephone } = checkoutData.inlineAddress;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setShippingAddressesOnCart with empty firstname', async () => {
      logger.action('POST', 'setShippingAddressesOnCart (firstname empty)');
      response = await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_RICH_MUTATION, {
        cartId,
        shippingAddresses: [{
          address: { firstname: '', lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        }],
      });
    });

    await logger.step('Step 2 - Assert validation error returned', async () => {
      const gql = await response.getGraphQLResponse();
      const hasErrors = (gql.errors?.length ?? 0) > 0;
      const errorMessage = hasErrors ? gql.errors![0]?.message ?? '' : '';

      logger.verify('Validation error present', true, hasErrors);
      expect(hasErrors, 'Expected a validation error for empty firstname').toBe(true);
      softExpect(errorMessage.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setShippingMethodsOnCart
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_05 - setShippingMethodsOnCart with first available method → selected_shipping_method updated', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 setShippingMethodsOnCart first available method');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // Re-set inline address — TC_04's empty-firstname mutation may have cleared the cart's shipping address on some staging environments
    await logger.step('Step 1 - Re-set inline shipping address', async () => {
      const { firstname, lastname, street, city, region, postcode, country_code, telephone } = checkoutData.inlineAddress;
      await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_RICH_MUTATION, {
        cartId,
        shippingAddresses: [{
          address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        }],
      });
    });

    let carrier_code!: string;
    let method_code!: string;
    await logger.step('Step 2 - Query cart for available shipping methods', async () => {
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

      carrier_code = firstAvailable.carrier_code;
      method_code = firstAvailable.method_code;
      logger.action('Using method', `${carrier_code}_${method_code}`);
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 3 - Execute setShippingMethodsOnCart with first available method', async () => {
      response = await authClient.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
        cartId,
        carrierCode: carrier_code,
        methodCode: method_code,
      });
    });

    await logger.step('Step 4 - Assert no errors and selected method matches', async () => {
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
  });

  test('TC_06 - setShippingMethodsOnCart with alternate method → method applied', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 setShippingMethodsOnCart alternate method');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // Re-set inline address — defensive guard; TC_05 already sets it but re-query may see stale state
    await logger.step('Step 1 - Re-set inline shipping address', async () => {
      const { firstname, lastname, street, city, region, postcode, country_code, telephone } = checkoutData.inlineAddress;
      await authClient.mutateWrapped(SET_SHIPPING_ADDRESSES_RICH_MUTATION, {
        cartId,
        shippingAddresses: [{
          address: { firstname, lastname, street, city, region, postcode, country_code, telephone, save_in_address_book: false },
        }],
      });
    });

    let carrier_code!: string;
    let method_code!: string;
    await logger.step('Step 2 - Query cart for available shipping methods', async () => {
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
      carrier_code = targetMethod.carrier_code;
      method_code = targetMethod.method_code;
      logger.action('Using method', `${carrier_code}_${method_code}`);
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 3 - Execute setShippingMethodsOnCart with target method', async () => {
      response = await authClient.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
        cartId,
        carrierCode: carrier_code,
        methodCode: method_code,
      });
    });

    await logger.step('Step 4 - Assert no errors and selected method applied', async () => {
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
  });

  test('TC_07 - setShippingMethodsOnCart with invalid carrier/method → error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 setShippingMethodsOnCart invalid carrier and method');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute setShippingMethodsOnCart with invalid codes', async () => {
      logger.action('POST', `setShippingMethodsOnCart (carrier=${checkoutData.invalidCarrierCode}, method=${checkoutData.invalidMethodCode})`);
      response = await authClient.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
        cartId,
        carrierCode: checkoutData.invalidCarrierCode,
        methodCode: checkoutData.invalidMethodCode,
      });
    });

    await logger.step('Step 2 - Assert error returned', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMessage = gql.errors?.length ? gql.errors[0]?.message ?? '' : '';

      logger.verify('Error message present for invalid carrier/method', true, errorMessage.length > 0);
      expect(errorMessage.length, 'Expected an error message for invalid carrier/method codes').toBeGreaterThan(0);
    });
  });

});
