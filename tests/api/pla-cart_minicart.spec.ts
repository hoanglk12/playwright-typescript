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

import { apiTest as test, expect, softExpect } from "../../src/api/ApiTest";
import {
  plaTestData,
  plaErrorMessages,
  getTestEmail,
} from "../../src/data/api/pla-test-data";
import { CartOperationsData } from "../../src/data/api/pla-cart-operations-data";
import { getCustomerToken, setCartId, setCustomerToken } from "./shared-state";

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string;
export let cartId: string;
let validSku: string;       // discovered in beforeAll; used by addProductsToCart tests
let cartItemId: number;     // set by TC_01; used by TC_04–TC_08

const testEmail = getTestEmail();
const specialCharRegex = /[^a-zA-Z0-9._-]/;

// ── Reusable mutation strings ─────────────────────────────────────────────────
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

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial("PLA GraphQL API - Cart & MiniCart @api @graphql", () => {

  test.beforeAll(async ({ createGraphQLClient }) => {
    // ── 1. Authentication ──────────────────────────────────────────────────
    customerToken = getCustomerToken();

    if (!customerToken) {
      console.log("No shared token found. Creating account and signing in...");
      const client = await createGraphQLClient();

      const createAccountMutation = `
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
        }`;

      const createResponse = await client.mutateWrapped(
        createAccountMutation,
        plaTestData.validCustomer
      );
      const createData = await createResponse.getGraphQLResponse();

      if (createData.errors) {
        const msg = createData.errors[0]?.message ?? "";
        if (!msg.includes("already") && !msg.includes("exists")) {
          throw new Error(`Account creation failed: ${msg}`);
        }
        console.log("⚠️  Account already exists, proceeding to sign in...");
      } else {
        console.log("✅ Account created with email:", testEmail);
      }

      const signInMutation = `
        mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
          generateCustomerToken(email: $email, password: $password, remember: $remember) {
            token
            __typename
          }
        }`;

      const signInResponse = await client.mutateWrapped(
        signInMutation,
        plaTestData.validCredentials
      );
      const signInData = await signInResponse.getGraphQLResponse();

      if (signInData.errors) {
        throw new Error(`Sign-in failed: ${signInData.errors[0]?.message}`);
      }

      customerToken = signInData.data.generateCustomerToken.token;
      setCustomerToken(customerToken);
      console.log("✅ Token acquired for cart tests");
    } else {
      console.log("✅ Using existing shared token from test suite");
    }

    // ── 2. Discover a valid in-stock product SKU ───────────────────────────
    // Magento 2 requires `search` or `filter` to return product results.
    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const searchTerms = ["", "shoe", "nike", "a"];
    for (const term of searchTerms) {
      const productsResponse = await authClient.queryWrapped(
        `query GetTestProducts($search: String!) {
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
        }`,
        { search: term }
      );

      const productsData = await productsResponse.getData();
      const items: any[] = productsData?.products?.items ?? [];

      for (const item of items) {
        if (item.stock_status === "IN_STOCK" && item.__typename === "SimpleProduct") {
          validSku = item.sku;
          break;
        }
        if (item.__typename === "ConfigurableProduct" && Array.isArray(item.variants)) {
          const inStockVariant = item.variants.find(
            (v: any) => v.product?.stock_status === "IN_STOCK"
          );
          if (inStockVariant) {
            validSku = inStockVariant.product.sku;
            break;
          }
        }
        if (!validSku && item.sku) {
          validSku = item.sku; // fallback: any product
        }
      }

      if (validSku) break;
      console.log(`beforeAll: no products with search="${term}", trying next term`);
    }

    if (!validSku) {
      throw new Error("beforeAll: no in-stock product found — cannot run cart operation tests");
    }

    console.log(`beforeAll ready — validSku=${validSku}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Cart creation & read queries (existing coverage)
  // ═══════════════════════════════════════════════════════════════════════════

  test("PLA_CreateCartAfterSignIn - should create new cartId with valid token", async ({
    createGraphQLClient,
  }) => {
    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `mutation CreateCartAfterSignIn { cartId: createEmptyCart }`;
    const response = await authClient.queryWrapped(query);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    cartId = data.cartId;
    setCartId(cartId);

    expect(cartId).toBeDefined();
    expect(response.assertStatus(200));
    softExpect(cartId).not.toMatch(specialCharRegex);

    console.log("Cart Id data: ", cartId);
  });

  test("PLA_GetItemCount - should show error with wrong cartId", async ({
    createGraphQLClient,
  }) => {
    const query = `query getItemCount($cartId:String!){cart(cart_id:$cartId){id ...CartTriggerFragment __typename}}fragment CartTriggerFragment on Cart{id total_quantity shipping_addresses{street selected_shipping_method{method_code __typename}__typename}__typename}`;
    const variables = { cartId: plaTestData.invalidCartId };
    const graphQLClient = await createGraphQLClient();

    const response = await graphQLClient.queryWrapped(query, variables);
    const graphqlResponse = await response.getGraphQLResponse();

    await response.assertHasErrors();
    await response.assertHasData();

    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors?.length).toBeGreaterThan(0);
    softExpect(graphqlResponse.errors![0].message).toContain(plaErrorMessages.invalidCartId);
    softExpect(graphqlResponse.data?.cart).toBeNull();

    console.log("Cart Error details retrieved:");
    console.log("  Length:", graphqlResponse.errors?.length);
    console.log("  Message:", graphqlResponse.errors![0].message);
    console.log("  Data:", graphqlResponse.data?.cart);
  });

  test("PLA_GetItemCount - should return data about cartId, quantity and shipping address", async ({
    createGraphQLClient,
  }) => {
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `query getItemCount($cartId:String!){cart(cart_id:$cartId){id ...CartTriggerFragment __typename}}fragment CartTriggerFragment on Cart{id total_quantity shipping_addresses{street selected_shipping_method{method_code __typename}__typename}__typename}`;
    const variables = { cartId: cartId };

    const response = await authClient.queryWrapped(query, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("GetItemCount response data: ", data);

    expect(data.cart).not.toBeNull();
    expect(data.cart).toBeDefined();

    softExpect(data.cart.id).toBe(cartId);
    softExpect(data.cart.total_quantity).toBeDefined();
    softExpect(Array.isArray(data.cart.shipping_addresses)).toBe(true);
    softExpect(data.cart.__typename).toBe("Cart");

    console.log("GetItemCount details retrieved:");
    console.log("  Id:", data.cart.id);
    console.log("  Total Quantity:", data.cart.total_quantity);
    console.log("  Shipping Address:", data.cart.shipping_addresses);
    console.log("  Type Name:", data.cart.__typename);
  });

  test("PLA_MiniCartQuery - should show error with wrong cartId", async ({
    createGraphQLClient,
  }) => {
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const query = `query MiniCartQuery($cartId:String!){cart(cart_id:$cartId){id ...MiniCartFragment __typename}}fragment MiniCartFragment on Cart{id total_quantity prices{subtotal_including_tax{currency value __typename}grand_total{value currency __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}...ProductListFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment ...AppliedQantasPointsFragment __typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}`;
    const variables = { cartId: plaTestData.invalidCartId };
    const graphQLClient = await createGraphQLClient();

    const response = await graphQLClient.queryWrapped(query, variables);
    const graphqlResponse = await response.getGraphQLResponse();

    await response.assertHasErrors();
    await response.assertHasData();

    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors?.length).toBeGreaterThan(0);
    softExpect(graphqlResponse.errors![0].message).toContain(plaErrorMessages.invalidCartId);
    softExpect(graphqlResponse.data?.cart).toBeNull();
  });

  test("PLA_MiniCartQuery - return data about cartId, quantity, prices, rewards msg, and qff", async ({
    createGraphQLClient,
  }) => {
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `query MiniCartQuery($cartId:String!){cart(cart_id:$cartId){id ...MiniCartFragment __typename}}fragment MiniCartFragment on Cart{id total_quantity prices{subtotal_including_tax{currency value __typename}grand_total{value currency __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}...ProductListFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment ...AppliedQantasPointsFragment __typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}`;
    const variables = { cartId: cartId };

    const response = await authClient.queryWrapped(query, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("MiniCartQuery response data: ", data);

    expect(data.cart).not.toBeNull();
    expect(data.cart).toBeDefined();

    softExpect(data.cart.id).toBe(cartId);
    softExpect(data.cart.total_quantity).toBeDefined();
    softExpect(data.cart.prices.subtotal_including_tax).toBeDefined();
    softExpect(data.cart.prices.grand_total).toBeDefined();
    softExpect(data.cart.prices.special_price_discount).toBeDefined();
    softExpect(data.cart.prices.discounts).toBeNull();
    softExpect(data.cart.prices.__typename).toBe("CartPrices");
    softExpect(data.cart.multiple_rewards_message).toBe(
      "Spend $100 to earn a $10 voucher on your next shop! Join Kicks Club at checkout."
    );
    softExpect(data.cart.qff_reward.is_qff_member).toBe(false);
    softExpect(data.cart.qff_reward.qff_points).toBe(0);
    softExpect(data.cart.qff_reward.qff_reward_message).toBe(
      "Earn 0 Qantas Points with this purchase"
    );
    softExpect(data.cart.qff_reward.__typename).toBe("QffReward");
    softExpect(data.cart.__typename).toBe("Cart");
    softExpect(data.cart.applied_qantas_points).toBeNull();
  });

  test("PLA_GetCartDetailsAfterSignIn - return data about cartId, quantity, prices, rewards msg, and qff", async ({
    createGraphQLClient,
  }) => {
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `query GetCartDetailsAfterSignIn($cartId:String!){cart(cart_id:$cartId){id items{id product{id name sku small_image{url label __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}__typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}__typename}__typename}prices{grand_total{value currency __typename}__typename}...CartPageFragment __typename}}fragment CartPageFragment on Cart{...ProductListFragment id total_quantity prices{grand_total{value currency __typename}subtotal_including_tax{currency value __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}available_payment_methods{code title __typename}...ShippingAddressFragment ...PriceMainFragment ...AppliedCouponsFragment ...GiftCardFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment __typename}fragment ShippingAddressFragment on Cart{shipping_addresses{address_name firstname lastname telephone street postcode country{label __typename}city region{label __typename}customer_notes available_shipping_methods{method_code method_title carrier_code carrier_title alternative_title available amount{value currency __typename}__typename}selected_shipping_method{method_code method_title carrier_code carrier_title amount{currency value __typename}__typename}__typename}__typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment PriceMainFragment on Cart{id items{id quantity __typename}total_quantity ...ShippingMainFragment prices{...TaxSummaryFragment ...GrandTotalFragment ...CouponCodePriceSummaryFragment subtotal_including_tax{currency value __typename}special_price_discount{value currency __typename}__typename}...AppliedQantasPointsFragment ...GiftCardMainFragment ...PlatyPointsSummaryFragment __typename}fragment GiftCardMainFragment on Cart{id applied_gift_cards{code applied_balance{value currency __typename}__typename}__typename}fragment GrandTotalFragment on CartPrices{grand_total{currency value __typename}__typename}fragment ShippingMainFragment on Cart{id shipping_addresses{selected_shipping_method{method_code method_title amount{currency value __typename}__typename}available_shipping_methods{method_code method_title carrier_code carrier_title alternative_title available amount{value currency __typename}__typename}street __typename}__typename}fragment TaxSummaryFragment on CartPrices{applied_taxes{amount{currency value __typename}__typename}__typename}fragment PlatyPointsSummaryFragment on Cart{applied_multiple_rewards{applied_amount applied_rewards{applied left reward_id __typename}__typename}__typename}fragment CouponCodePriceSummaryFragment on CartPrices{discounts{amount{currency value __typename}coupon_code description label gst __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}fragment AppliedCouponsFragment on Cart{id applied_coupons{code __typename}__typename}fragment GiftCardFragment on Cart{__typename id}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}`;
    const variables = { cartId: cartId };

    const response = await authClient.queryWrapped(query, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("GetCartDetailsAfterSignIn response data: ", data);

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

    const paymentMethodCodes = data.cart.available_payment_methods.map((m: any) => m.code);
    const expectedCodes = ["checkmo", "braintree_applepay", "free", "braintree", "braintree_paypal"];
    console.log("Available payment method codes: ", paymentMethodCodes);
    softExpect(paymentMethodCodes).toEqual(expect.arrayContaining(expectedCodes));

    const paymentMethodTitles = data.cart.available_payment_methods.map((m: any) => m.title);
    const expectedTitles = ["Check / Money order", "Apple Pay", "No Payment Information Required", "Credit or Debit Card", "PayPal"];
    console.log("Available payment method titles: ", paymentMethodTitles);
    softExpect(paymentMethodTitles).toEqual(expect.arrayContaining(expectedTitles));
  });

  test("PLA_checkUserIsAuthed - return data about cartId, quantity, prices, rewards msg, and qff", async ({
    createGraphQLClient,
  }) => {
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `query checkUserIsAuthed($cartId:String!){cart(cart_id:$cartId){id __typename}}`;
    const variables = { cartId: cartId };

    const response = await authClient.queryWrapped(query, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("checkUserIsAuthed response data: ", data);

    expect(data.cart).not.toBeNull();
    expect(data.cart).toBeDefined();

    softExpect(data.cart.id).toBe(cartId);
    softExpect(data.cart.__typename).toBe("Cart");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Cart mutation operations (new coverage)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── addProductsToCart ──────────────────────────────────────────────────────

  test("TC_01 - addProductsToCart should add a product to cart", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_01 addProductsToCart add product"
    );

    expect(cartId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Execute addProductsToCart mutation");
    logger.action("POST", `addProductsToCart (cartId=${cartId}, sku=${validSku})`);
    const response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
      cartId,
      cartItems: [{ sku: validSku, quantity: CartOperationsData.initialQuantity }],
    });

    logger.step("Step 2 - Assert response has no errors and item appears in cart");
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const cartData = data.addProductsToCart?.cart;
    const userErrors: any[] = data.addProductsToCart?.user_errors ?? [];

    logger.verify("No user_errors", 0, userErrors.length);
    expect(userErrors).toHaveLength(0);
    expect(cartData).toBeDefined();
    expect(cartData.items.length).toBeGreaterThan(0);

    const addedItem = cartData.items.find((i: any) => i.product.sku === validSku);
    expect(addedItem).toBeDefined();

    cartItemId = addedItem.id;

    logger.verify("Item SKU in cart", validSku, addedItem.product.sku);
    softExpect(addedItem.quantity).toBe(CartOperationsData.initialQuantity);
    softExpect(cartData.total_quantity).toBeGreaterThan(0);

    console.log(`TC_01 — cartItemId=${cartItemId}, qty=${addedItem.quantity}`);
  });

  test("TC_02 - addProductsToCart should return user_errors for invalid SKU", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_02 addProductsToCart invalid SKU"
    );

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Execute addProductsToCart with invalid SKU");
    logger.action("POST", `addProductsToCart (sku=${CartOperationsData.invalidSku})`);
    const response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
      cartId,
      cartItems: [{ sku: CartOperationsData.invalidSku, quantity: 1 }],
    });

    logger.step("Step 2 - Assert user_errors present for invalid SKU");
    await response.assertHasData();

    const data = await response.getData();
    const userErrors: any[] = data.addProductsToCart?.user_errors ?? [];

    logger.verify("user_errors present", true, userErrors.length > 0);
    expect(userErrors.length).toBeGreaterThan(0);

    console.log(`TC_02 — user_errors:`, userErrors.map((e: any) => e.message));
  });

  test("TC_03 - addProductsToCart should return error for invalid cartId", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_03 addProductsToCart invalid cartId"
    );

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Execute addProductsToCart with invalid cartId");
    logger.action("POST", `addProductsToCart (cartId=${CartOperationsData.invalidCartId})`);
    const response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
      cartId: CartOperationsData.invalidCartId,
      cartItems: [{ sku: validSku, quantity: 1 }],
    });

    logger.step("Step 2 - Assert error returned (GraphQL-level or user_errors)");
    const graphqlResponse = await response.getGraphQLResponse();
    const hasGqlErrors = (graphqlResponse.errors?.length ?? 0) > 0;
    const hasUserErrors =
      (graphqlResponse.data?.addProductsToCart?.user_errors?.length ?? 0) > 0;

    logger.verify("Error returned for invalid cartId", true, hasGqlErrors || hasUserErrors);
    expect(hasGqlErrors || hasUserErrors).toBe(true);

    console.log(`TC_03 — gqlErrors=${hasGqlErrors}, userErrors=${hasUserErrors}`);
  });

  test("TC_04 - addProductsToCart should increment quantity when same product added twice", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_04 addProductsToCart duplicate product quantity increment"
    );

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Add same SKU again to cart");
    logger.action("POST", `addProductsToCart duplicate (sku=${validSku})`);
    const response = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
      cartId,
      cartItems: [{ sku: validSku, quantity: CartOperationsData.initialQuantity }],
    });

    logger.step("Step 2 - Assert quantity incremented to 2");
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const userErrors: any[] = data.addProductsToCart?.user_errors ?? [];
    expect(userErrors).toHaveLength(0);

    const cartData = data.addProductsToCart?.cart;
    const item = cartData.items.find((i: any) => i.product.sku === validSku);
    expect(item).toBeDefined();

    cartItemId = item.id;

    logger.verify("Quantity is 2 after second add", 2, item.quantity);
    softExpect(item.quantity).toBe(2);

    console.log(`TC_04 — cartItemId=${cartItemId}, qty=${item.quantity}`);
  });

  // ── updateCartItems ────────────────────────────────────────────────────────

  test("TC_05 - updateCartItems should increase item quantity", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_05 updateCartItems increase quantity"
    );

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Update cart item quantity to increased value");
    logger.action("POST", `updateCartItems (cartItemId=${cartItemId}, qty=${CartOperationsData.increasedQuantity})`);
    const response = await authClient.mutateWrapped(UPDATE_CART_ITEMS_MUTATION, {
      input: {
        cart_id: cartId,
        cart_items: [{ cart_item_id: cartItemId, quantity: CartOperationsData.increasedQuantity }],
      },
    });

    logger.step("Step 2 - Assert quantity updated");
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const cartData = data.updateCartItems?.cart;
    const updatedItem = cartData?.items?.find((i: any) => i.id === cartItemId);

    expect(updatedItem).toBeDefined();
    logger.verify("Quantity increased", CartOperationsData.increasedQuantity, updatedItem.quantity);
    softExpect(updatedItem.quantity).toBe(CartOperationsData.increasedQuantity);
    softExpect(cartData.total_quantity).toBeGreaterThanOrEqual(CartOperationsData.increasedQuantity);

    console.log(`TC_05 — qty updated to ${updatedItem.quantity}`);
  });

  test("TC_06 - updateCartItems should decrease item quantity", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_06 updateCartItems decrease quantity"
    );

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Update cart item quantity to decreased value");
    logger.action("POST", `updateCartItems (cartItemId=${cartItemId}, qty=${CartOperationsData.decreasedQuantity})`);
    const response = await authClient.mutateWrapped(UPDATE_CART_ITEMS_MUTATION, {
      input: {
        cart_id: cartId,
        cart_items: [{ cart_item_id: cartItemId, quantity: CartOperationsData.decreasedQuantity }],
      },
    });

    logger.step("Step 2 - Assert quantity decreased");
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const cartData = data.updateCartItems?.cart;
    const updatedItem = cartData?.items?.find((i: any) => i.id === cartItemId);

    expect(updatedItem).toBeDefined();
    logger.verify("Quantity decreased", CartOperationsData.decreasedQuantity, updatedItem.quantity);
    softExpect(updatedItem.quantity).toBe(CartOperationsData.decreasedQuantity);

    console.log(`TC_06 — qty updated to ${updatedItem.quantity}`);
  });

  test("TC_07 - updateCartItems with quantity 0 should remove item or return error", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_07 updateCartItems quantity zero"
    );

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Update cart item quantity to 0");
    logger.action("POST", `updateCartItems (cartItemId=${cartItemId}, qty=0)`);
    const response = await authClient.mutateWrapped(UPDATE_CART_ITEMS_MUTATION, {
      input: {
        cart_id: cartId,
        cart_items: [{ cart_item_id: cartItemId, quantity: 0 }],
      },
    });

    logger.step("Step 2 - Assert item removed or validation error returned");
    const graphqlResponse = await response.getGraphQLResponse();
    const hasGqlErrors = (graphqlResponse.errors?.length ?? 0) > 0;
    const cartItems: any[] = graphqlResponse.data?.updateCartItems?.cart?.items ?? [];
    const itemRemoved = !hasGqlErrors && !cartItems.find((i: any) => i.id === cartItemId);

    logger.verify("Item removed or error returned for qty=0", true, hasGqlErrors || itemRemoved);
    expect(hasGqlErrors || itemRemoved).toBe(true);

    // Re-add the item so TC_08 has a valid target to remove
    if (itemRemoved) {
      console.log("TC_07 — item removed by qty=0; re-adding for TC_08");
      const reAddResponse = await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId,
        cartItems: [{ sku: validSku, quantity: CartOperationsData.initialQuantity }],
      });
      const reAddData = await reAddResponse.getData();
      const reAddedItem = reAddData.addProductsToCart?.cart?.items?.find(
        (i: any) => i.product.sku === validSku
      );
      if (reAddedItem) {
        cartItemId = reAddedItem.id;
        console.log(`TC_07 — re-added; new cartItemId=${cartItemId}`);
      }
    } else {
      console.log("TC_07 — gql error for qty=0:", graphqlResponse.errors?.[0]?.message);
    }
  });

  // ── removeItemFromCart ─────────────────────────────────────────────────────

  test("TC_08 - removeItemFromCart should remove item from cart", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_08 removeItemFromCart remove item"
    );

    expect(cartItemId).toBeDefined();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Execute removeItemFromCart mutation");
    logger.action("POST", `removeItemFromCart (cartItemId=${cartItemId})`);
    const response = await authClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
      input: { cart_id: cartId, cart_item_id: cartItemId },
    });

    logger.step("Step 2 - Assert item no longer in cart");
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const cartData = data.removeItemFromCart?.cart;
    const removedItem = cartData?.items?.find((i: any) => i.id === cartItemId);

    logger.verify("Item absent from cart after removal", undefined, removedItem);
    expect(removedItem).toBeUndefined();

    console.log(`TC_08 — item ${cartItemId} removed; remaining items=${cartData?.items?.length ?? 0}`);
  });

  test("TC_09 - removeItemFromCart should return error for invalid cart_item_id", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_09 removeItemFromCart invalid cart_item_id"
    );

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Execute removeItemFromCart with non-existent cart_item_id");
    logger.action("POST", `removeItemFromCart (cartItemId=${CartOperationsData.invalidCartItemId})`);
    const response = await authClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
      input: { cart_id: cartId, cart_item_id: CartOperationsData.invalidCartItemId },
    });

    logger.step("Step 2 - Assert error returned");
    await response.assertHasErrors();

    const graphqlResponse = await response.getGraphQLResponse();
    const errorMessage = graphqlResponse.errors?.[0]?.message ?? "";

    logger.verify("Error message present", true, errorMessage.length > 0);
    expect(errorMessage.length).toBeGreaterThan(0);

    console.log(`TC_09 — error: ${errorMessage}`);
  });

  test("TC_10 - removeItemFromCart should return authorization error when unauthenticated", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_10 removeItemFromCart unauthenticated"
    );

    const unauthClient = await createGraphQLClient();

    logger.step("Step 1 - Execute removeItemFromCart without authentication");
    logger.action("POST", "removeItemFromCart unauthenticated");
    const response = await unauthClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
      input: { cart_id: cartId, cart_item_id: CartOperationsData.invalidCartItemId },
    });

    logger.step("Step 2 - Assert authorization error returned");
    await response.assertHasErrors();

    const graphqlResponse = await response.getGraphQLResponse();
    const errorMessage = graphqlResponse.errors?.[0]?.message ?? "";

    logger.verify("Auth error returned", true, errorMessage.length > 0);
    expect(errorMessage.length).toBeGreaterThan(0);

    console.log(`TC_10 — unauthenticated error: ${errorMessage}`);
  });

  // ── applyCouponToCart ──────────────────────────────────────────────────────

  test("TC_11 - applyCouponToCart should return error for invalid coupon code", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_11 applyCouponToCart invalid coupon code"
    );

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    logger.step("Step 1 - Execute applyCouponToCart with invalid coupon code");
    logger.action("POST", `applyCouponToCart (coupon=${CartOperationsData.invalidCouponCode})`);
    const response = await authClient.mutateWrapped(APPLY_COUPON_MUTATION, {
      input: { cart_id: cartId, coupon_code: CartOperationsData.invalidCouponCode },
    });

    logger.step("Step 2 - Assert error returned for invalid coupon");
    await response.assertHasErrors();

    const graphqlResponse = await response.getGraphQLResponse();
    const errorMessage = graphqlResponse.errors?.[0]?.message ?? "";

    logger.verify("Error present for invalid coupon", true, errorMessage.length > 0);
    expect(errorMessage.length).toBeGreaterThan(0);

    console.log(`TC_11 — invalid coupon error: ${errorMessage}`);
  });

  test("TC_12 - applyCouponToCart should return authorization error when unauthenticated", async ({ createGraphQLClient }) => {
    const logger = require("../../src/utils/test-logger").createTestLogger(
      "TC_12 applyCouponToCart unauthenticated"
    );

    const unauthClient = await createGraphQLClient();

    logger.step("Step 1 - Execute applyCouponToCart without authentication");
    logger.action("POST", "applyCouponToCart unauthenticated");
    const response = await unauthClient.mutateWrapped(APPLY_COUPON_MUTATION, {
      input: { cart_id: cartId, coupon_code: CartOperationsData.invalidCouponCode },
    });

    logger.step("Step 2 - Assert authorization error returned");
    await response.assertHasErrors();

    const graphqlResponse = await response.getGraphQLResponse();
    const errorMessage = graphqlResponse.errors?.[0]?.message ?? "";

    logger.verify("Auth error returned", true, errorMessage.length > 0);
    expect(errorMessage.length).toBeGreaterThan(0);

    console.log(`TC_12 — unauthenticated error: ${errorMessage}`);
  });

});
