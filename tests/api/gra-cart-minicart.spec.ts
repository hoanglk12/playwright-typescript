/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Cart & MiniCart — all operations in one serial suite:
 *   createEmptyCart, cart queries (CartTrigger, MiniCart, CartDetails, checkUserIsAuthed)
 *   addProductsToCart, removeItemFromCart, updateCartItems, applyCouponToCart
 *
 * DEPENDENCY: Runs after pla-account-creation-signin.spec.ts which stores
 * customerToken in shared-state.ts.  Falls back to self-authentication
 * (create account + sign in) when run as a standalone file.
 *
 * API Endpoint: Configured via environment (graphqlApiBaseUrl)
 */

import { graTest as test, expect, softExpect } from './gra-test';
import {
  graErrorMessages,
} from '../../src/data/api/gra-test-data';
import { CartOperationsData } from '../../src/data/api/gra-cart-operations-data';
import { signInAndStoreToken } from './api-test-helpers';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { GraphQLResponse } from '../../src/api/GraphQLClient';

// ── Local types ───────────────────────────────────────────────────────────────

interface ProductVariant {
  product: { sku: string; stock_status: string; __typename: string };
}

interface ProductItem {
  sku: string;
  stock_status: string;
  __typename: string;
  variants?: ProductVariant[];
}

interface CartItem {
  id: number;
  quantity: number;
  product: { sku: string; __typename: string };
}

interface UserError {
  code: string;
  message: string;
}

interface PaymentMethod {
  code: string;
  title: string;
}

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string = '';
let cartId: string = '';
let validSku: string = '';
let cartItemId: number = 0;

const specialCharRegex = /[^a-zA-Z0-9._-]/;

// ── Reusable mutation/query strings ──────────────────────────────────────────

const ADD_PRODUCTS_MUTATION = `
  mutation AddProductsToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
    addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
      cart {
        items {
          id
          quantity
          product { sku name __typename }
          __typename
        }
        total_quantity
        __typename
      }
      user_errors { code message __typename }
      __typename
    }
  }
`;

const REMOVE_ITEM_MUTATION = `
  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {
    removeItemFromCart(input: $input) {
      cart {
        items { id quantity product { sku __typename } __typename }
        total_quantity
        __typename
      }
      __typename
    }
  }
`;

const UPDATE_CART_ITEMS_MUTATION = `
  mutation UpdateCartItems($input: UpdateCartItemsInput!) {
    updateCartItems(input: $input) {
      cart {
        items { id quantity product { sku __typename } __typename }
        total_quantity
        __typename
      }
      __typename
    }
  }
`;

const APPLY_COUPON_MUTATION = `
  mutation ApplyCouponToCart($input: ApplyCouponToCartInput!) {
    applyCouponToCart(input: $input) {
      cart {
        applied_coupons { code __typename }
        __typename
      }
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

const CREATE_CART_MUTATION = `mutation CreateCartAfterSignIn { cartId: createEmptyCart }`;

const GET_ITEM_COUNT_QUERY = `query getItemCount($cartId:String!){cart(cart_id:$cartId){id ...CartTriggerFragment __typename}}fragment CartTriggerFragment on Cart{id total_quantity shipping_addresses{street selected_shipping_method{method_code __typename}__typename}__typename}`;

const MINI_CART_QUERY = `query MiniCartQuery($cartId:String!){cart(cart_id:$cartId){id ...MiniCartFragment __typename}}fragment MiniCartFragment on Cart{id total_quantity prices{subtotal_including_tax{currency value __typename}grand_total{value currency __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}...ProductListFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment ...AppliedQantasPointsFragment __typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}`;

const GET_CART_DETAILS_QUERY = `query GetCartDetailsAfterSignIn($cartId:String!){cart(cart_id:$cartId){id items{id product{id name sku small_image{url label __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}__typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}__typename}__typename}prices{grand_total{value currency __typename}__typename}...CartPageFragment __typename}}fragment CartPageFragment on Cart{...ProductListFragment id total_quantity prices{grand_total{value currency __typename}subtotal_including_tax{currency value __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}available_payment_methods{code title __typename}...ShippingAddressFragment ...PriceMainFragment ...AppliedCouponsFragment ...GiftCardFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment __typename}fragment ShippingAddressFragment on Cart{shipping_addresses{address_name firstname lastname telephone street postcode country{label __typename}city region{label __typename}customer_notes available_shipping_methods{method_code method_title carrier_code carrier_title alternative_title available amount{value currency __typename}__typename}selected_shipping_method{method_code method_title carrier_code carrier_title amount{currency value __typename}__typename}__typename}__typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment PriceMainFragment on Cart{id items{id quantity __typename}total_quantity ...ShippingMainFragment prices{...TaxSummaryFragment ...GrandTotalFragment ...CouponCodePriceSummaryFragment subtotal_including_tax{currency value __typename}special_price_discount{value currency __typename}__typename}...AppliedQantasPointsFragment ...GiftCardMainFragment ...PlatyPointsSummaryFragment __typename}fragment GiftCardMainFragment on Cart{id applied_gift_cards{code applied_balance{value currency __typename}__typename}__typename}fragment GrandTotalFragment on CartPrices{grand_total{currency value __typename}__typename}fragment ShippingMainFragment on Cart{id shipping_addresses{selected_shipping_method{method_code method_title amount{currency value __typename}__typename}available_shipping_methods{method_code method_title carrier_code carrier_title alternative_title available amount{value currency __typename}__typename}street __typename}__typename}fragment TaxSummaryFragment on CartPrices{applied_taxes{amount{currency value __typename}__typename}__typename}fragment PlatyPointsSummaryFragment on Cart{applied_multiple_rewards{applied_amount applied_rewards{applied left reward_id __typename}__typename}__typename}fragment CouponCodePriceSummaryFragment on CartPrices{discounts{amount{currency value __typename}coupon_code description label gst __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}fragment AppliedCouponsFragment on Cart{id applied_coupons{code __typename}__typename}fragment GiftCardFragment on Cart{__typename id}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}`;

const CHECK_USER_IS_AUTHED_QUERY = `query checkUserIsAuthed($cartId:String!){cart(cart_id:$cartId){id __typename}}`;

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('GRA GraphQL API - Cart & MiniCart @api @graphql', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    // Auth + SKU discovery + cart creation + probe add/remove = multiple sequential
    // staging calls; the default 30s hook timeout is too tight on slow brands
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('beforeAll PLA Cart & MiniCart setup');

    // ── 1. Authentication ──────────────────────────────────────────────────
    const anonClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(anonClient, logger, site, siteState);

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    // ── 2. Discover in-stock candidate SKUs ────────────────────────────────
    const candidateSkus: string[] = [];
    await logger.step('Discover in-stock product SKU candidates', async () => {
      const searchTerms = ['', 'shoe', 'nike', 'a'];
      for (const term of searchTerms) {
        const productsResponse = await authClient.queryWrapped(GET_PRODUCTS_QUERY, { search: term });
        const productsData = await productsResponse.getData();
        const items: ProductItem[] = productsData?.products?.items ?? [];

        for (const item of items) {
          if (item.stock_status === 'IN_STOCK' && item.__typename === 'SimpleProduct') {
            if (!candidateSkus.includes(item.sku)) candidateSkus.push(item.sku);
          } else if (item.__typename === 'ConfigurableProduct' && Array.isArray(item.variants)) {
            for (const v of item.variants) {
              if (v.product?.stock_status === 'IN_STOCK' && !candidateSkus.includes(v.product.sku)) {
                candidateSkus.push(v.product.sku);
              }
            }
          }
          // No fallback to item.sku — parent configurable SKUs return PRODUCT_NOT_FOUND on add
        }
        if (candidateSkus.length >= 3) break;
      }

      if (!candidateSkus.length) {
        throw new Error('beforeAll: no in-stock product found — cannot run cart operation tests');
      }
    });

    // ── 3. Create shared cart in the hook (not in a test) ─────────────────
    // Retry workers re-run beforeAll but NOT earlier tests; creating the cart here
    // guarantees cartId is never empty in a retry worker (fixes "cart_id missing" cascade)
    await logger.step('Create shared cart', async () => {
      const cartGql = await (await authClient.mutateWrapped(CREATE_CART_MUTATION)).getGraphQLResponse();
      if (cartGql.errors?.length) throw new Error(`createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`);
      cartId = cartGql.data?.cartId ?? '';
      if (!cartId) throw new Error('beforeAll: cartId is empty after createEmptyCart');
      siteState.setCartId(cartId);
      logger.action('Cart created', cartId);
    });

    // ── 4. Verify a candidate SKU is genuinely addable (probe add → remove) ─
    await logger.step('Verify candidate SKU addability (probe add, then remove)', async () => {
      for (const sku of candidateSkus) {
        const addGql = await (await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
          cartId,
          cartItems: [{ sku, quantity: 1 }],
        })).getGraphQLResponse();
        const addUserErrors: UserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
        if (!(addGql.errors?.length) && !addUserErrors.length) {
          validSku = sku;
          // Remove the probe item so TC_01 starts from an empty cart
          const probeItem = (addGql.data?.addProductsToCart?.cart?.items ?? []).find(
            (i: CartItem) => i.product.sku === sku,
          );
          if (probeItem) {
            await authClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
              input: { cart_id: cartId, cart_item_id: probeItem.id },
            });
          }
          logger.action('SKU verified addable', sku);
          break;
        }
        logger.action(`SKU ${sku} not addable`, addUserErrors[0]?.message ?? addGql.errors?.[0]?.message ?? 'unknown');
      }

      if (!validSku) {
        throw new Error('beforeAll: no candidate SKU could be added to cart — cannot run cart operation tests');
      }

      logger.verify('beforeAll ready', 'validSku found', validSku);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Cart creation & read queries (existing coverage)
  // ═══════════════════════════════════════════════════════════════════════════

  test('GRA_CreateCartAfterSignIn - should create new cartId with valid token', async ({
    createGraphQLClient, siteState,
  }) => {
    const logger = createTestLogger('PLA_CreateCartAfterSignIn should create new cartId with valid token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute createEmptyCart mutation', async () => {
      response = await authClient.queryWrapped(CREATE_CART_MUTATION);
    });

    await logger.step('Step 2 - Assert cart created', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      await response.assertStatus(200);

      const data = await response.getData();
      cartId = data.cartId;
      siteState.setCartId(cartId);

      expect(cartId).toBeDefined();
      softExpect(cartId).not.toMatch(specialCharRegex);

      logger.verify('Cart created', true, !!cartId);
      logger.action('Stored', `cartId=${cartId}`);
    });
  });

  test('GRA_GetItemCount - should show error with wrong cartId', async ({
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('PLA_GetItemCount should show error with wrong cartId');
    const variables = { cartId: site.testData.invalidCartId };
    const graphQLClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    let graphqlResponse!: GraphQLResponse;
    await logger.step('Step 1 - Execute getItemCount with invalid cartId', async () => {
      response = await graphQLClient.queryWrapped(GET_ITEM_COUNT_QUERY, variables);
      graphqlResponse = await response.getGraphQLResponse();
    });

    await logger.step('Step 2 - Assert error returned', async () => {
      await response.assertHasErrors();
      await response.assertHasData();

      expect(graphqlResponse.errors).toBeDefined();
      expect(graphqlResponse.errors?.length).toBeGreaterThan(0);
      softExpect(graphqlResponse.errors![0].message).toContain(graErrorMessages.invalidCartId);
      softExpect(graphqlResponse.data?.cart).toBeNull();

      logger.verify('Error message', graErrorMessages.invalidCartId, graphqlResponse.errors![0].message);
    });
  });

  test('GRA_GetItemCount - should return data about cartId, quantity and shipping address', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_GetItemCount should return data about cartId, quantity and shipping address');

    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute getItemCount with valid cartId', async () => {
      response = await authClient.queryWrapped(GET_ITEM_COUNT_QUERY, { cartId });
    });

    await logger.step('Step 2 - Assert cart data returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();

      expect(data.cart).not.toBeNull();
      expect(data.cart).toBeDefined();

      softExpect(data.cart.id).toBe(cartId);
      softExpect(data.cart.total_quantity).toBeDefined();
      softExpect(Array.isArray(data.cart.shipping_addresses)).toBe(true);
      softExpect(data.cart.__typename).toBe('Cart');

      logger.verify('Cart ID', cartId, data.cart.id);
      logger.verify('Cart typename', 'Cart', data.cart.__typename);
    });
  });

  test('GRA_MiniCartQuery - should show error with wrong cartId', async ({
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('PLA_MiniCartQuery should show error with wrong cartId');

    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const variables = { cartId: site.testData.invalidCartId };
    const graphQLClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    let graphqlResponse!: GraphQLResponse;
    await logger.step('Step 1 - Execute MiniCartQuery with invalid cartId', async () => {
      response = await graphQLClient.queryWrapped(MINI_CART_QUERY, variables);
      graphqlResponse = await response.getGraphQLResponse();
    });

    await logger.step('Step 2 - Assert error returned', async () => {
      await response.assertHasErrors();
      await response.assertHasData();

      expect(graphqlResponse.errors).toBeDefined();
      expect(graphqlResponse.errors?.length).toBeGreaterThan(0);
      softExpect(graphqlResponse.errors![0].message).toContain(graErrorMessages.invalidCartId);
      softExpect(graphqlResponse.data?.cart).toBeNull();

      logger.verify('Error message', graErrorMessages.invalidCartId, graphqlResponse.errors![0].message);
    });
  });

  test('GRA_MiniCartQuery - return data about cartId, quantity, prices, rewards msg, and qff', async ({
    createGraphQLClient,
    site,
  }) => {
    const logger = createTestLogger('PLA_MiniCartQuery return data about cartId, quantity, prices, rewards msg, and qff');

    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute MiniCartQuery with valid cartId', async () => {
      response = await authClient.queryWrapped(MINI_CART_QUERY, { cartId });
    });

    await logger.step('Step 2 - Assert mini-cart data returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();

      expect(data.cart).not.toBeNull();
      expect(data.cart).toBeDefined();

      softExpect(data.cart.id).toBe(cartId);
      softExpect(data.cart.total_quantity).toBeDefined();
      softExpect(data.cart.prices.subtotal_including_tax).toBeDefined();
      softExpect(data.cart.prices.grand_total).toBeDefined();
      softExpect(data.cart.prices.special_price_discount).toBeDefined();
      softExpect(data.cart.prices.discounts).toBeNull();
      softExpect(data.cart.prices.__typename).toBe('CartPrices');
      if (site.brand === 'platypus') {
        softExpect(data.cart.multiple_rewards_message).toBe(
          'Spend $100 to earn a $10 voucher on your next shop! Join Kicks Club at checkout.'
        );
      } else {
        softExpect(
          data.cart.multiple_rewards_message === null || typeof data.cart.multiple_rewards_message === 'string'
        ).toBe(true);
      }
      if (site.countryCode === 'AU') {
        softExpect(data.cart.qff_reward.is_qff_member).toBe(false);
        softExpect(data.cart.qff_reward.qff_points).toBe(0);
        softExpect(data.cart.qff_reward.qff_reward_message).toBe(
          'Earn 0 Qantas Points with this purchase'
        );
        softExpect(data.cart.qff_reward.__typename).toBe('QffReward');
        softExpect(data.cart.applied_qantas_points).toBeNull();
      }
      softExpect(data.cart.__typename).toBe('Cart');

      logger.verify('Cart ID', cartId, data.cart.id);
      logger.verify('Cart typename', 'Cart', data.cart.__typename);
    });
  });

  test('GRA_GetCartDetailsAfterSignIn - return data about cartId, quantity, prices, rewards msg, and qff', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_GetCartDetailsAfterSignIn return data about cartId, quantity, prices, rewards msg, and qff');

    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute GetCartDetailsAfterSignIn with valid cartId', async () => {
      response = await authClient.queryWrapped(GET_CART_DETAILS_QUERY, { cartId });
    });

    await logger.step('Step 2 - Assert cart details returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();

      expect(data.cart).not.toBeNull();
      expect(data.cart).toBeDefined();

      softExpect(data.cart.id).toBe(cartId);
      softExpect(Array.isArray(data.cart.items)).toBe(true);
      softExpect(Array.isArray(data.cart.available_payment_methods)).toBe(true);
      softExpect(Array.isArray(data.cart.shipping_addresses)).toBe(true);
      softExpect(Array.isArray(data.cart.applied_gift_cards)).toBe(true);
      softExpect(data.cart.applied_qantas_points).toBeNull();
      softExpect(data.cart.applied_multiple_rewards).toBeNull();
      softExpect(data.cart.applied_coupons).toBeNull();

      const paymentMethodCodes = data.cart.available_payment_methods.map((m: PaymentMethod) => m.code);
      const expectedCodes = ['checkmo', 'braintree_applepay', 'free', 'braintree', 'braintree_paypal'];
      softExpect(paymentMethodCodes).toEqual(expect.arrayContaining(expectedCodes));

      const paymentMethodTitles = data.cart.available_payment_methods.map((m: PaymentMethod) => m.title);
      const expectedTitles = ['Check / Money order', 'Apple Pay', 'No Payment Information Required', 'Credit or Debit Card', 'PayPal'];
      softExpect(paymentMethodTitles).toEqual(expect.arrayContaining(expectedTitles));

      logger.verify('Payment method codes present', true, paymentMethodCodes.length > 0);
      logger.verify('Payment method titles present', true, paymentMethodTitles.length > 0);
    });
  });

  test('GRA_checkUserIsAuthed - return data about cartId, quantity, prices, rewards msg, and qff', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_checkUserIsAuthed return data about cartId, quantity, prices, rewards msg, and qff');

    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute checkUserIsAuthed with valid cartId', async () => {
      response = await authClient.queryWrapped(CHECK_USER_IS_AUTHED_QUERY, { cartId });
    });

    await logger.step('Step 2 - Assert cart accessible for authenticated user', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();

      expect(data.cart).not.toBeNull();
      expect(data.cart).toBeDefined();

      softExpect(data.cart.id).toBe(cartId);
      softExpect(data.cart.__typename).toBe('Cart');

      logger.verify('Cart ID', cartId, data.cart.id);
      logger.verify('Cart typename', 'Cart', data.cart.__typename);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Cart mutation operations (new coverage)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── addProductsToCart ──────────────────────────────────────────────────────

  test('TC_01 - addProductsToCart should add a product to cart', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 addProductsToCart add product');

    expect(cartId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute addProductsToCart mutation', async () => {
      logger.action('POST', `addProductsToCart (cartId=${cartId}, sku=${validSku})`);
      response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId,
        cartItems: [{ sku: validSku, quantity: CartOperationsData.initialQuantity }],
      });
    });

    await logger.step('Step 2 - Assert response has no errors and item appears in cart', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const cartData = data.addProductsToCart?.cart;
      const userErrors: UserError[] = data.addProductsToCart?.user_errors ?? [];

      logger.verify('No user_errors', 0, userErrors.length);
      expect(userErrors).toHaveLength(0);
      expect(cartData).toBeDefined();
      expect(cartData.items.length).toBeGreaterThan(0);

      const addedItem = cartData.items.find((i: CartItem) => i.product.sku === validSku);
      expect(addedItem).toBeDefined();

      cartItemId = addedItem!.id;

      logger.verify('Item SKU in cart', validSku, addedItem!.product.sku);
      softExpect(addedItem!.quantity).toBe(CartOperationsData.initialQuantity);
      softExpect(cartData.total_quantity).toBeGreaterThan(0);

      logger.action('Cart item added', `cartItemId=${cartItemId}, qty=${addedItem!.quantity}`);
    });
  });

  test('TC_02 - addProductsToCart should return user_errors for invalid SKU', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 addProductsToCart invalid SKU');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute addProductsToCart with invalid SKU', async () => {
      logger.action('POST', `addProductsToCart (sku=${CartOperationsData.invalidSku})`);
      response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId,
        cartItems: [{ sku: CartOperationsData.invalidSku, quantity: 1 }],
      });
    });

    await logger.step('Step 2 - Assert user_errors present for invalid SKU', async () => {
      await response.assertHasData();

      const data = await response.getData();
      const userErrors: UserError[] = data.addProductsToCart?.user_errors ?? [];

      logger.verify('user_errors present', true, userErrors.length > 0);
      expect(userErrors.length).toBeGreaterThan(0);
    });
  });

  test('TC_03 - addProductsToCart should return error for invalid cartId', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 addProductsToCart invalid cartId');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute addProductsToCart with invalid cartId', async () => {
      logger.action('POST', `addProductsToCart (cartId=${CartOperationsData.invalidCartId})`);
      response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId: CartOperationsData.invalidCartId,
        cartItems: [{ sku: validSku, quantity: 1 }],
      });
    });

    await logger.step('Step 2 - Assert error returned (GraphQL-level or user_errors)', async () => {
      const graphqlResponse = await response.getGraphQLResponse();
      const hasGqlErrors = (graphqlResponse.errors?.length ?? 0) > 0;
      const hasUserErrors =
        (graphqlResponse.data?.addProductsToCart?.user_errors?.length ?? 0) > 0;

      logger.verify('Error returned for invalid cartId', true, hasGqlErrors || hasUserErrors);
      expect(hasGqlErrors || hasUserErrors).toBe(true);
    });
  });

  test('TC_04 - addProductsToCart should increment quantity when same product added twice', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 addProductsToCart duplicate product quantity increment');

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Add same SKU again to cart', async () => {
      logger.action('POST', `addProductsToCart duplicate (sku=${validSku})`);
      response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId,
        cartItems: [{ sku: validSku, quantity: CartOperationsData.initialQuantity }],
      });
    });

    await logger.step('Step 2 - Assert quantity incremented to 2', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const userErrors: UserError[] = data.addProductsToCart?.user_errors ?? [];
      expect(userErrors).toHaveLength(0);

      const cartData = data.addProductsToCart?.cart;
      const item = cartData.items.find((i: CartItem) => i.product.sku === validSku);
      expect(item).toBeDefined();

      cartItemId = item!.id;

      logger.verify('Quantity is 2 after second add', 2, item!.quantity);
      softExpect(item!.quantity).toBe(2);

      logger.action('Cart item updated', `cartItemId=${cartItemId}, qty=${item!.quantity}`);
    });
  });

  // ── updateCartItems ────────────────────────────────────────────────────────

  test('TC_05 - updateCartItems should increase item quantity', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 updateCartItems increase quantity');

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Update cart item quantity to increased value', async () => {
      logger.action('POST', `updateCartItems (cartItemId=${cartItemId}, qty=${CartOperationsData.increasedQuantity})`);
      response = await authClient.mutateWrapped(UPDATE_CART_ITEMS_MUTATION, {
        input: {
          cart_id: cartId,
          cart_items: [{ cart_item_id: cartItemId, quantity: CartOperationsData.increasedQuantity }],
        },
      });
    });

    await logger.step('Step 2 - Assert quantity updated or stock constraint returned', async () => {
      const graphqlResponse = await response.getGraphQLResponse();
      const hasGqlErrors = (graphqlResponse.errors?.length ?? 0) > 0;

      if (hasGqlErrors) {
        const errMsg = graphqlResponse.errors![0]?.message ?? '';
        // Staging products may have limited stock; "qty not available" is a valid API response
        const isStockError = errMsg.toLowerCase().includes('qty') && errMsg.toLowerCase().includes('available');
        logger.verify('Stock limit reached (acceptable on staging)', true, isStockError);
        expect(isStockError, `Unexpected GQL error: ${errMsg}`).toBe(true);
        return;
      }

      await response.assertHasData();
      const data = await response.getData();
      const cartData = data.updateCartItems?.cart;
      const updatedItem = cartData?.items?.find((i: CartItem) => i.id === cartItemId);

      expect(updatedItem).toBeDefined();
      logger.verify('Quantity increased', CartOperationsData.increasedQuantity, updatedItem!.quantity);
      softExpect(updatedItem!.quantity).toBe(CartOperationsData.increasedQuantity);
      softExpect(cartData.total_quantity).toBeGreaterThanOrEqual(CartOperationsData.increasedQuantity);
    });
  });

  test('TC_06 - updateCartItems should decrease item quantity', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 updateCartItems decrease quantity');

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Update cart item quantity to decreased value', async () => {
      logger.action('POST', `updateCartItems (cartItemId=${cartItemId}, qty=${CartOperationsData.decreasedQuantity})`);
      response = await authClient.mutateWrapped(UPDATE_CART_ITEMS_MUTATION, {
        input: {
          cart_id: cartId,
          cart_items: [{ cart_item_id: cartItemId, quantity: CartOperationsData.decreasedQuantity }],
        },
      });
    });

    await logger.step('Step 2 - Assert quantity decreased', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const cartData = data.updateCartItems?.cart;
      const updatedItem = cartData?.items?.find((i: CartItem) => i.id === cartItemId);

      expect(updatedItem).toBeDefined();
      logger.verify('Quantity decreased', CartOperationsData.decreasedQuantity, updatedItem!.quantity);
      softExpect(updatedItem!.quantity).toBe(CartOperationsData.decreasedQuantity);
    });
  });

  test('TC_07 - updateCartItems with quantity 0 should remove item or return error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 updateCartItems quantity zero');

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Update cart item quantity to 0', async () => {
      logger.action('POST', `updateCartItems (cartItemId=${cartItemId}, qty=0)`);
      response = await authClient.mutateWrapped(UPDATE_CART_ITEMS_MUTATION, {
        input: {
          cart_id: cartId,
          cart_items: [{ cart_item_id: cartItemId, quantity: 0 }],
        },
      });
    });

    let graphqlResponse!: GraphQLResponse;
    let itemRemoved!: boolean;
    await logger.step('Step 2 - Assert item removed or validation error returned', async () => {
      graphqlResponse = await response.getGraphQLResponse();
      const hasGqlErrors = (graphqlResponse.errors?.length ?? 0) > 0;
      const cartItems: CartItem[] = graphqlResponse.data?.updateCartItems?.cart?.items ?? [];
      itemRemoved = !hasGqlErrors && !cartItems.find((i: CartItem) => i.id === cartItemId);

      logger.verify('Item removed or error returned for qty=0', true, hasGqlErrors || itemRemoved);
      expect(hasGqlErrors || itemRemoved).toBe(true);
    });

    // Re-add the item so TC_08 has a valid target to remove
    if (itemRemoved) {
      await logger.step('Item removed by qty=0 — re-adding for TC_08', async () => {
        const reAddResponse = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
          cartId,
          cartItems: [{ sku: validSku, quantity: CartOperationsData.initialQuantity }],
        });
        const reAddData = await reAddResponse.getData();
        const reAddedItem = reAddData.addProductsToCart?.cart?.items?.find(
          (i: CartItem) => i.product.sku === validSku
        );
        if (reAddedItem) {
          cartItemId = reAddedItem.id;
          logger.action('Re-added item', `new cartItemId=${cartItemId}`);
        }
      });
    } else {
      const errMsg = graphqlResponse.errors?.length ? graphqlResponse.errors[0]?.message ?? '' : '';
      logger.verify('GQL error for qty=0', true, errMsg.length > 0);
    }
  });

  // ── removeItemFromCart ─────────────────────────────────────────────────────

  test('TC_08 - removeItemFromCart should remove item from cart', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_08 removeItemFromCart remove item');

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute removeItemFromCart mutation', async () => {
      logger.action('POST', `removeItemFromCart (cartItemId=${cartItemId})`);
      response = await authClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
        input: { cart_id: cartId, cart_item_id: cartItemId },
      });
    });

    await logger.step('Step 2 - Assert item no longer in cart', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const cartData = data.removeItemFromCart?.cart;
      const removedItem = cartData?.items?.find((i: CartItem) => i.id === cartItemId);

      logger.verify('Item absent from cart after removal', undefined, removedItem);
      expect(removedItem).toBeUndefined();
    });
  });

  test('TC_09 - removeItemFromCart should return error for invalid cart_item_id', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_09 removeItemFromCart invalid cart_item_id');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute removeItemFromCart with non-existent cart_item_id', async () => {
      logger.action('POST', `removeItemFromCart (cartItemId=${CartOperationsData.invalidCartItemId})`);
      response = await authClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
        input: { cart_id: cartId, cart_item_id: CartOperationsData.invalidCartItemId },
      });
    });

    await logger.step('Step 2 - Assert error returned', async () => {
      await response.assertHasErrors();

      const graphqlResponse = await response.getGraphQLResponse();
      const errorMessage = graphqlResponse.errors?.length ? graphqlResponse.errors[0]?.message ?? '' : '';

      logger.verify('Error message present', true, errorMessage.length > 0);
      expect(errorMessage.length).toBeGreaterThan(0);
    });
  });

  test('TC_10 - removeItemFromCart should return authorization error when unauthenticated', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_10 removeItemFromCart unauthenticated');

    const unauthClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute removeItemFromCart without authentication', async () => {
      logger.action('POST', 'removeItemFromCart unauthenticated');
      response = await unauthClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
        input: { cart_id: cartId, cart_item_id: CartOperationsData.invalidCartItemId },
      });
    });

    await logger.step('Step 2 - Assert authorization error returned', async () => {
      await response.assertHasErrors();

      const graphqlResponse = await response.getGraphQLResponse();
      const errorMessage = graphqlResponse.errors?.length ? graphqlResponse.errors[0]?.message ?? '' : '';

      logger.verify('Auth error returned', true, errorMessage.length > 0);
      expect(errorMessage.length).toBeGreaterThan(0);
    });
  });

  // ── applyCouponToCart ──────────────────────────────────────────────────────

  test('TC_11 - applyCouponToCart should return error for invalid coupon code', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_11 applyCouponToCart invalid coupon code');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute applyCouponToCart with invalid coupon code', async () => {
      logger.action('POST', `applyCouponToCart (coupon=${CartOperationsData.invalidCouponCode})`);
      response = await authClient.mutateWrapped(APPLY_COUPON_MUTATION, {
        input: { cart_id: cartId, coupon_code: CartOperationsData.invalidCouponCode },
      });
    });

    await logger.step('Step 2 - Assert error returned for invalid coupon', async () => {
      await response.assertHasErrors();

      const graphqlResponse = await response.getGraphQLResponse();
      const errorMessage = graphqlResponse.errors?.length ? graphqlResponse.errors[0]?.message ?? '' : '';

      logger.verify('Error present for invalid coupon', true, errorMessage.length > 0);
      expect(errorMessage.length).toBeGreaterThan(0);
    });
  });

  test('TC_12 - applyCouponToCart should return authorization error when unauthenticated', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_12 applyCouponToCart unauthenticated');

    const unauthClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute applyCouponToCart without authentication', async () => {
      logger.action('POST', 'applyCouponToCart unauthenticated');
      response = await unauthClient.mutateWrapped(APPLY_COUPON_MUTATION, {
        input: { cart_id: cartId, coupon_code: CartOperationsData.invalidCouponCode },
      });
    });

    await logger.step('Step 2 - Assert authorization error returned', async () => {
      await response.assertHasErrors();

      const graphqlResponse = await response.getGraphQLResponse();
      const errorMessage = graphqlResponse.errors?.length ? graphqlResponse.errors[0]?.message ?? '' : '';

      logger.verify('Auth error returned', true, errorMessage.length > 0);
      expect(errorMessage.length).toBeGreaterThan(0);
    });
  });

});
