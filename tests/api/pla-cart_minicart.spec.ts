/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Tests for Cart & Minicart Management
 * 
 * DEPENDENCY: This file depends on pla-account-management.spec.ts running first
 * to set the customerToken in shared-state.ts
 * 
 * File naming ensures correct order: "pla-account-management" runs before "pla-cart_minicart" alphabetically
 * 
 * API Endpoint: Configured via environment (graphqlApiBaseUrl)
 */

import { apiTest as test } from "../../src/api/ApiTest";
import { expect } from "@playwright/test";
import {
  plaTestData,
  plaErrorMessages,
  getTestEmail
  } from "../../src/data/api/pla-test-data";
  
import { getCustomerToken, setCartId, setCustomerToken } from './shared-state';

// Shared state
let customerToken: string;
export let cartId: string;

// Reuse the SAME test email generator as pla-account-creation-signin.spec.ts
const testEmail = getTestEmail();

// Regex to detect special characters in strings
const specialCharRegex = /[^a-zA-Z0-9._-]/;

test.describe.serial("PLA GraphQL API - Cart & MiniCart apis", () => {
  test.beforeAll(async ({ createGraphQLClient }) => {
    // Try to get token from shared state first (if running after account creation tests)
    customerToken = getCustomerToken();
    
    // If no token exists (running standalone), create account and sign in
    if (!customerToken) {
      console.log('No shared token found. Creating account and signing in...');
      
      const client = await createGraphQLClient();
      
      // Step 1: Create account with the SAME credentials as pla-account-creation-signin.spec.ts
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
            customer {
              id
              email
              __typename
            }
          }
        }`;
      
      // Use the SAME test data structure as pla-account-creation-signin.spec.ts
      const createAccountVariables = plaTestData.validCustomer;
      
      const createResponse = await client.mutateWrapped(createAccountMutation, createAccountVariables);
      const createData = await createResponse.getData();
      
      console.log('✅ Account created with email:', testEmail);
      console.log('✅ Account created with data:', createData);
      
      // Step 2: Sign in with the SAME credentials
      const signInMutation = `
        mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
          generateCustomerToken(email: $email, password: $password, remember: $remember) {
            token
            __typename
          }
        }`;
      
      // Use the SAME credentials structure as pla-account-creation-signin.spec.ts
      const signInVariables = plaTestData.validCredentials;
      
      const signInResponse = await client.mutateWrapped(signInMutation, signInVariables);
      const signInData = await signInResponse.getData();
      customerToken = signInData.generateCustomerToken.token;
      
      // Save to shared state for potential reuse
      setCustomerToken(customerToken);

      console.log('✅ Token acquired for cart tests with value: ', customerToken);
    } else {
      console.log('✅ Using existing shared token from test suite');
    }
  });
  test("PLA_CreateCartAfterSignIn - should create new cartId with valid token", async ({
    createGraphQLClient,
  }) => {
    // Create authenticated GraphQL client using environment configuration
    const authClient = await createGraphQLClient({
      authType: "bearer" as any, // Using built-in Bearer authentication
      token: customerToken, // Pass the token directly
    });

    // GraphQL Query with fragments
    const query = `
      mutation CreateCartAfterSignIn { cartId: createEmptyCart }`;

    // Execute query
    const response = await authClient.queryWrapped(query);

    // Assertions from Postman test
    await response.assertNoErrors();
    await response.assertHasData();

    // Verify customer ID exists (PLA API returns ID as Number, not String)
    //await response.assertDataField('data.id', expect.any(Number));

    // Extract customer data
    const data = await response.getData();

    cartId = data.cartId;
    setCartId(cartId); // Update shared state

    // Validate customer information
    expect(cartId).toBeDefined();
    expect(response.assertStatus(200));

    // Verify cartId does NOT contain special characters
    expect(cartId).not.toMatch(specialCharRegex);
    console.log("Cart Id data: ", cartId);
  });

  test("PLA_GetItemCount - should show error with wrong cartId", async ({
    createGraphQLClient,
  }) => {
    // GraphQL Query with fragments
    const query = `query getItemCount($cartId:String!){cart(cart_id:$cartId){id ...CartTriggerFragment __typename}}fragment CartTriggerFragment on Cart{id total_quantity shipping_addresses{street selected_shipping_method{method_code __typename}__typename}__typename}`;
    const variables = { cartId: plaTestData.invalidCartId };
    // Execute query
    const graphQLClient = await createGraphQLClient();

    const response = await graphQLClient.queryWrapped(query, variables);
    const graphqlResponse = await response.getGraphQLResponse();
    // Assertions from Postman test
    await response.assertHasErrors();
    await response.assertHasData();

    // Verify that errors exist
    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors?.length).toBeGreaterThan(0);
    expect(graphqlResponse.errors![0].message).toContain(
      plaErrorMessages.invalidCartId
    );
    expect(graphqlResponse.data?.cart).toBeNull();

    console.log("Cart Error details retrieved:");
    console.log("  Length:", graphqlResponse.errors?.length);
    console.log("  Message:", graphqlResponse.errors![0].message);
    console.log("  Data:", graphqlResponse.data?.cart);
  });
  test("PLA_GetItemCount - should return data about cartId, quantity and shipping address", async ({
    createGraphQLClient,
  }) => {
    // Ensure we have a valid cartId from previous test
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    // CRITICAL FIX: Use authenticated client - cart data requires authentication
    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    // GraphQL Query with fragments
    const query = `query getItemCount($cartId:String!){cart(cart_id:$cartId){id ...CartTriggerFragment __typename}}fragment CartTriggerFragment on Cart{id total_quantity shipping_addresses{street selected_shipping_method{method_code __typename}__typename}__typename}`;
    const variables = { cartId: cartId };

    // Execute query with authenticated client
    const response = await authClient.queryWrapped(query, variables);

    // This test should succeed (no errors expected)
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("GetItemCount response data: ", data);

    // Add null check before accessing properties
    expect(data.cart).not.toBeNull();
    expect(data.cart).toBeDefined();

    // Verify cart data
    expect(data.cart.id).toBe(cartId);
    expect(data.cart.total_quantity).toBeDefined();
    expect(Array.isArray(data.cart.shipping_addresses)).toBe(true);
    expect(data.cart.__typename).toBe("Cart");

    console.log("GetItemCount details retrieved:");
    console.log("  Id:", data.cart.id);
    console.log("  Total Quantity:", data.cart.total_quantity);
    console.log("  Shipping Address:", data.cart.shipping_addresses);
    console.log("  Type Name:", data.cart.__typename);
  });

  test("PLA_MiniCartQuery - should show error with wrong cartId", async ({
    createGraphQLClient,
  }) => {
    // Ensure we have a valid cartId from previous test
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    // GraphQL Query with fragments
    const query = `query MiniCartQuery($cartId:String!){cart(cart_id:$cartId){id ...MiniCartFragment __typename}}fragment MiniCartFragment on Cart{id total_quantity prices{subtotal_including_tax{currency value __typename}grand_total{value currency __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}...ProductListFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment ...AppliedQantasPointsFragment __typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}`;
    const variables = { cartId: plaTestData.invalidCartId };
    // Execute query
    const graphQLClient = await createGraphQLClient();

    const response = await graphQLClient.queryWrapped(query, variables);
    const graphqlResponse = await response.getGraphQLResponse();
    // Assertions from Postman test
    await response.assertHasErrors();
    await response.assertHasData();

    // Verify that errors exist
    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors?.length).toBeGreaterThan(0);
    expect(graphqlResponse.errors![0].message).toContain(
      plaErrorMessages.invalidCartId
    );
    expect(graphqlResponse.data?.cart).toBeNull();
  });

  test("PLA_MiniCartQuery - return data about cartId, quantity, prices, rewards msg, and qff", async ({
    createGraphQLClient,
  }) => {
    // Ensure we have a valid token from previous test
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

    // Create authenticated GraphQL client using environment configuration
    const authClient = await createGraphQLClient({
      authType: "bearer" as any, // Using built-in Bearer authentication
      token: customerToken, // Pass the token directly
    });

    const query = `query MiniCartQuery($cartId:String!){cart(cart_id:$cartId){id ...MiniCartFragment __typename}}fragment MiniCartFragment on Cart{id total_quantity prices{subtotal_including_tax{currency value __typename}grand_total{value currency __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}...ProductListFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment ...AppliedQantasPointsFragment __typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}`;
    const variables = { cartId: cartId };

    const response = await authClient.queryWrapped(query, variables);

    // This test should succeed (no errors expected)
    await response.assertNoErrors();
    await response.assertHasData();

    //Get response data
    const data = await response.getData();
    console.log("MiniCartQuery response data: ", data);

    // Add null check before accessing properties
    expect(data.cart).not.toBeNull();
    expect(data.cart).toBeDefined();

    // Verify cart data
    expect(data.cart.id).toBe(cartId);
    expect(data.cart.total_quantity).toBeDefined();
    expect(data.cart.prices.subtotal_including_tax).toBeDefined();
    expect(data.cart.prices.grand_total).toBeDefined();
    expect(data.cart.prices.special_price_discount).toBeDefined();
    expect(data.cart.prices.discounts).toBeNull();
    expect(data.cart.prices.__typename).toBe("CartPrices");
    expect(data.cart.multiple_rewards_message).toBe(
      "Spend $100 to earn a $10 voucher on your next shop! Join Kicks Club at checkout."
    );
    expect(data.cart.qff_reward.is_qff_member).toBe(false);
    expect(data.cart.qff_reward.qff_points).toBe(0);
    expect(data.cart.qff_reward.qff_reward_message).toBe(
      "Earn 0 Qantas Points with this purchase"
    );
    expect(data.cart.qff_reward.__typename).toBe("QffReward");
    expect(data.cart.__typename).toBe("Cart");
    expect(data.cart.applied_qantas_points).toBeNull();
  });

  test("PLA_GetCartDetailsAfterSignIn - return data about cartId, quantity, prices, rewards msg, and qff", async ({
    createGraphQLClient,
  }) => {
    // Ensure we have a valid cartId from previous test
    expect(cartId).toBeDefined();
    expect(cartId).toBeTruthy();

  // Create authenticated GraphQL client using environment configuration
    const authClient = await createGraphQLClient({
      authType: "bearer" as any, // Using built-in Bearer authentication
      token: customerToken, // Pass the token directly
    });
    const query =`query GetCartDetailsAfterSignIn($cartId:String!){cart(cart_id:$cartId){id items{id product{id name sku small_image{url label __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}__typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}__typename}__typename}prices{grand_total{value currency __typename}__typename}...CartPageFragment __typename}}fragment CartPageFragment on Cart{...ProductListFragment id total_quantity prices{grand_total{value currency __typename}subtotal_including_tax{currency value __typename}special_price_discount{value currency __typename}discounts{amount{currency value __typename}description label __typename}__typename}available_payment_methods{code title __typename}...ShippingAddressFragment ...PriceMainFragment ...AppliedCouponsFragment ...GiftCardFragment ...MultipleRewardsMessageFragment ...QantasMessageFragment __typename}fragment ShippingAddressFragment on Cart{shipping_addresses{address_name firstname lastname telephone street postcode country{label __typename}city region{label __typename}customer_notes available_shipping_methods{method_code method_title carrier_code carrier_title alternative_title available amount{value currency __typename}__typename}selected_shipping_method{method_code method_title carrier_code carrier_title amount{currency value __typename}__typename}__typename}__typename}fragment ProductListFragment on Cart{id items{id prices{row_total_including_tax{value __typename}row_total{value __typename}__typename}custom_options{option_name option_value __typename}product{id name url_key url_suffix sku apparel21_brand_id{id attributes{attribute_value attribute_code __typename}__typename}gender{option_label __typename}thumbnail{url __typename}price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}rating_summary attribute_set_label feature{option_label __typename}stock_status color_name __typename}quantity ...on ConfigurableCartItem{configurable_options{id option_label value_id value_label __typename}selected_simple{id sku stock_status color_name apparel21_gender_id{option_label __typename}thumbnail{url __typename}special_price price{regularPrice{amount{currency value __typename}__typename}minimalPrice{amount{value currency __typename}__typename}__typename}price_range{maximum_price{regular_price{value currency __typename}__typename}minimum_price{final_price{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}fragment PriceMainFragment on Cart{id items{id quantity __typename}total_quantity ...ShippingMainFragment prices{...TaxSummaryFragment ...GrandTotalFragment ...CouponCodePriceSummaryFragment subtotal_including_tax{currency value __typename}special_price_discount{value currency __typename}__typename}...AppliedQantasPointsFragment ...GiftCardMainFragment ...PlatyPointsSummaryFragment __typename}fragment GiftCardMainFragment on Cart{id applied_gift_cards{code applied_balance{value currency __typename}__typename}__typename}fragment GrandTotalFragment on CartPrices{grand_total{currency value __typename}__typename}fragment ShippingMainFragment on Cart{id shipping_addresses{selected_shipping_method{method_code method_title amount{currency value __typename}__typename}available_shipping_methods{method_code method_title carrier_code carrier_title alternative_title available amount{value currency __typename}__typename}street __typename}__typename}fragment TaxSummaryFragment on CartPrices{applied_taxes{amount{currency value __typename}__typename}__typename}fragment PlatyPointsSummaryFragment on Cart{applied_multiple_rewards{applied_amount applied_rewards{applied left reward_id __typename}__typename}__typename}fragment CouponCodePriceSummaryFragment on CartPrices{discounts{amount{currency value __typename}coupon_code description label gst __typename}__typename}fragment AppliedQantasPointsFragment on Cart{applied_qantas_points{points_burned dollar_value member_number __typename}__typename}fragment AppliedCouponsFragment on Cart{id applied_coupons{code __typename}__typename}fragment GiftCardFragment on Cart{__typename id}fragment MultipleRewardsMessageFragment on Cart{id multiple_rewards_message __typename}fragment QantasMessageFragment on Cart{id qff_reward{is_qff_member qff_points qff_reward_message __typename}__typename}`;
    const variables = { cartId: cartId };

    const response = await authClient.queryWrapped(query, variables);

    // This test should succeed (no errors expected)
    await response.assertNoErrors();
    await response.assertHasData();

    
    //Get response data
    const data = await response.getData();
    console.log("GetCartDetailsAfterSignIn response data: ", data);

    // Add null check before accessing properties
    expect(data.cart).not.toBeNull();
    expect(data.cart).toBeDefined();


    // Verify cart data
    expect(data.cart.id).toBe(cartId);
    expect(Array.isArray(data.cart.items)).toBe(true);
    expect(Array.isArray(data.cart.available_payment_methods)).toBe(true);
    expect(Array.isArray(data.cart.shipping_addresses)).toBe(true);
    expect(Array.isArray(data.cart.applied_gift_cards)).toBe(true);
    expect(data.cart.applied_qantas_points).toBeNull();
    expect(data.cart.applied_multiple_rewards).toBeNull();
    expect(data.cart.applied_coupons).toBeNull();

    
    // Check if payment methods contain expected codes
    const paymentMethodCodes = data.cart.available_payment_methods.map((method: any) => method.code);
    const expectedCodes = ["checkmo", "braintree_applepay", "free", "braintree", "braintree_paypal"];
    console.log("Available payment method codes: ", paymentMethodCodes);
    console.log("Expected payment method codes: ", expectedCodes);
    expect(paymentMethodCodes).toEqual(expect.arrayContaining(expectedCodes));

   // Check if payment methods contain expected codes
    const paymentMethodTitles = data.cart.available_payment_methods.map((method: any) => method.title);
    const expectedTitles = ["Check / Money order", "Apple Pay", "No Payment Information Required", "Credit or Debit Card", "PayPal"];
    console.log("Available payment method titles: ", paymentMethodTitles);
    console.log("Expected payment method titles: ", expectedTitles);
    expect(paymentMethodTitles).toEqual(expect.arrayContaining(expectedTitles));
  });
});
