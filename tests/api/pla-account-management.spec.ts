/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Tests for Account Management: Create Account, Sign In, Get Customer Details
 * 
 * API Endpoint: Configured via environment (graphqlApiBaseUrl)
 */

import { apiTest as test } from '../../src/api/ApiTest';
import { expect } from '@playwright/test';
import { plaTestData, getTestEmail, plaErrorMessages, expectedCustomerData } from '../../src/data/api/pla-test-data';
import { GraphQLClient } from 'src/api/GraphQLClient';
import { GraphQLResponseWrapper } from 'src/api/GraphQLResponse';

// Get test email for assertions
const testEmail = getTestEmail();
const specialCharRegex = /[^a-zA-Z0-9._-]/;

// Shared variables across tests
let customerToken: string;
let customerId: string;

test.describe('PLA GraphQL API - Account Management', () => {

  test('PLA_CreateAccount - error message shown when input invalid data', async ({ createGraphQLClient }) => {
    // Create GraphQL client using environment configuration
    const graphqlClient = await createGraphQLClient();

    // GraphQL Mutation
    const mutation = `
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
            firstname
            lastname
            email
            __typename
          }
        }
      }
    `;

    // Variables with invalid email
    const variables = plaTestData.invalidEmail;

    // Execute mutation
    const response = await graphqlClient.mutateWrapped(mutation, variables);

    // Get the full GraphQL response (including errors)
    const graphqlResponse = await response.getGraphQLResponse();
    
    // Verify that errors exist
    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors).toHaveLength(1);
    
    // Verify the error message (using non-null assertion since we checked above)
    expect(graphqlResponse.errors![0].message).toBe(plaErrorMessages.invalidEmail);
    expect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-input');
    
    // Verify that data.createCustomer is null when there's an error
    expect(graphqlResponse.data.createCustomer).toBeNull();
    
    console.log('✅ Error validation passed: Invalid email format detected');
  });

  test('PLA_CreateAccount - should create a new customer account', async ({ createGraphQLClient }) => {
    // Create GraphQL client using environment configuration
    const graphqlClient = await createGraphQLClient();

    // GraphQL Mutation
    const mutation = `
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
            firstname
            lastname
            email
            __typename
          }
        }
      }
    `;

    // Variables
    const variables = plaTestData.validCustomer;

    // Execute mutation
    const response = await graphqlClient.mutateWrapped(mutation, variables);

    // Assertions from Postman test
    await response.assertNoErrors();
    await response.assertHasData();
    
    // Verify response structure (ID is a number in PLA API, not string)
    await response.assertDataField('createCustomer.customer.__typename', 'Customer');
    
    // Extract customer ID for potential later use
    const data = await response.getData();
    customerId = data.createCustomer.customer.id;
    
    // Validate customer data matches input
    expect(data.createCustomer.customer.id).toBeTruthy();
    expect(data.createCustomer.customer.firstname).toBe(expectedCustomerData.firstname);
    expect(data.createCustomer.customer.lastname).toBe(expectedCustomerData.lastname);
    expect(data.createCustomer.customer.email).toBe(testEmail);
    
    console.log('✅ Created customer ID:', customerId);
    console.log('Customer email:', testEmail);
  });
test('PLA_SignIn - should login fail when provide wrong email or password', async ({ createGraphQLClient }) => {
    // Create GraphQL client using environment configuration
    const graphqlClient = await createGraphQLClient();

    // GraphQL Mutation
    const mutation = `
      mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
        generateCustomerToken(email: $email, password: $password, remember: $remember) {
          token
          __typename
        }
      }
    `;

    // Variables - Using the account we just created
    const variables = plaTestData.invalidPassword;
    
    // Execute mutation
    const response = await graphqlClient.mutateWrapped(mutation, variables);

    // Get the full GraphQL response (including errors)
    const graphqlResponse = await response.getGraphQLResponse();
    
    // Verify that errors exist
    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors).toHaveLength(1);
    
    // Verify the error message (using non-null assertion since we checked above)
    expect(graphqlResponse.errors![0].message).toBe(plaErrorMessages.invalidCredentials);
    expect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-authentication');
    
    // Verify that data.createCustomer is null when there's an error
    expect(graphqlResponse.data.generateCustomerToken).toBeNull();
  });

  test('PLA_SignIn - should generate customer token for valid credentials', async ({ createGraphQLClient }) => {
    // Create GraphQL client using environment configuration
    const graphqlClient = await createGraphQLClient();

    // GraphQL Mutation
    const mutation = `
      mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
        generateCustomerToken(email: $email, password: $password, remember: $remember) {
          token
          __typename
        }
      }
    `;

    // Variables - Using the account we just created
    const variables = plaTestData.validCredentials;

    // Execute mutation
    const response = await graphqlClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();
    
    // Verify token exists
    await response.assertDataField('generateCustomerToken.token', expect.any(String));
    await response.assertDataField('generateCustomerToken.__typename', 'CustomerToken');
    
    // Extract token
    const data = await response.getData();
    customerToken = data.generateCustomerToken.token;
    
    // Verify token does NOT contain special characters (Postman assertion)
    //const specialCharRegex = /[^a-zA-Z0-9._-]/;
    expect(customerToken).not.toMatch(specialCharRegex);
    expect(customerToken).toBeTruthy();
    
    console.log('Customer token generated (first 20 chars):', customerToken.substring(0, 20) + '...');
  });

  test('PLA_GetCustomerDetails - should retrieve customer details with valid token', async ({ createGraphQLClient }) => {
    // Ensure we have a valid token from previous test
    expect(customerToken).toBeDefined();
    expect(customerToken).toBeTruthy();

    // Create authenticated GraphQL client using environment configuration
    const authClient = await createGraphQLClient({
      authType: 'bearer' as any, // Using built-in Bearer authentication
      token: customerToken // Pass the token directly
    });

    // GraphQL Query with fragments
    const query = `
      query getCustomerDetails {
        customer {
          id
          ...CustomerInformationFragment
          ...CustomerLoyaltyFragment
          __typename
        }
      }
      
      fragment CustomerInformationFragment on Customer {
        id
        firstname
        lastname
        email
        phone_number
        date_of_birth
        is_subscribed
        gender
        apparel21_id
        is_qff_member
        qff_member_number
        __typename
      }
      
      fragment CustomerLoyaltyFragment on Customer {
        id
        loyalty_program_status
        loyalty {
          level {
            accrual_points
            auto_reward_threshold
            auto_reward_value
            description
            level_id
            level_point_bonus
            name
            sequence
            __typename
          }
          points_balance
          points_to_next_reward
          program {
            apply_reward_threshold
            description
            name
            __typename
          }
          rewards {
            available
            customer_reward_id
            expiry_date
            pending
            redeemed
            status
            total
            __typename
          }
          reward_account_id
          rewards_balance
          spend_value_to_next_reward
          positive_rewards_balance_message
          __typename
        }
        __typename
      }
    `;

    // Execute query
    const response = await authClient.queryWrapped(query);

    // Assertions from Postman test
    await response.assertNoErrors();
    await response.assertHasData();
    
    // Verify customer ID exists (PLA API returns ID as Number, not String)
    await response.assertDataField('customer.id', expect.any(Number));
    
    // Extract customer data
    const data = await response.getData();
    const customer = data.customer;
    
    // Store customer ID (as in Postman collection variables)
    customerId = customer.id;
    
    // Validate customer information
    expect(customer.id).toBeTruthy();
    expect(customer.firstname).toBe(expectedCustomerData.firstname);
    expect(customer.lastname).toBe(expectedCustomerData.lastname);
    expect(customer.email).toBe(testEmail);
    expect(customer.is_subscribed).toBe(expectedCustomerData.isSubscribed);
    expect(customer.gender).toBe(expectedCustomerData.gender);
    expect(customer.__typename).toBe('Customer');
    
    console.log('Customer details retrieved:');
    console.log('  ID:', customer.id);
    console.log('  Name:', customer.firstname, customer.lastname);
    console.log('  Email:', customer.email);
    console.log('  Subscribed:', customer.is_subscribed);
    console.log('  Loyalty Status:', customer.loyalty_program_status);
  });

  test('PLA_CreateCartAfterSignIn - should create new cartId with valid token', async ({ createGraphQLClient }) => {
    // Ensure we have a valid token from previous test
    expect(customerToken).toBeDefined();
    expect(customerToken).toBeTruthy();

    // Create authenticated GraphQL client using environment configuration
    const authClient = await createGraphQLClient({
      authType: 'bearer' as any, // Using built-in Bearer authentication
      token: customerToken // Pass the token directly
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
  
    const cartId = data.cartId;

    
    // Validate customer information
    expect(cartId).toBeDefined();
    expect(response.assertStatus(200));
    
    // Verify cartId does NOT contain special characters
   expect(cartId).not.toMatch(specialCharRegex);
  console.log('Cart Id data: ', cartId);
  
  });

  test('PLA_GetItemCount - should show error with wrong cartId', async ({ createGraphQLClient }) => {
    // Ensure we have a valid token from previous test
    expect(customerToken).toBeDefined();
    expect(customerToken).toBeTruthy();



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
  expect(graphqlResponse.errors![0].message).toContain(plaErrorMessages.invalidCartId);
  expect(graphqlResponse.data?.cart).toBeNull();

      
    console.log('Cart Error details retrieved:');
    console.log('  Length:', graphqlResponse.errors?.length);
    console.log('  Message:', graphqlResponse.errors![0].message);
    console.log('  Data:', graphqlResponse.data?.cart);
 
  });
});
