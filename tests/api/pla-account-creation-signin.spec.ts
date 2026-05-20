/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Tests for Account Management: Create Account, Sign In, Get Customer Details
 *
 * API Endpoint: Configured via environment (graphqlApiBaseUrl)
 */

import { apiTest as test, expect, softExpect } from '../../src/api/ApiTest';
import { plaTestData, getTestEmail, plaErrorMessages, expectedCustomerData } from '../../src/data/api/pla-test-data';
import { setCustomerToken, setCustomerId } from './shared-state';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';

const testEmail = getTestEmail();

let customerToken: string = '';
let customerId: string = '';

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

const SIGN_IN_MUTATION = `
  mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
    generateCustomerToken(email: $email, password: $password, remember: $remember) {
      token
      __typename
    }
  }
`;

const GET_CUSTOMER_DETAILS_QUERY = `
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

test.describe.configure({ mode: 'serial' });

test.describe('PLA GraphQL API - Account Management', () => {

  test('PLA_CreateAccount - error message shown when input invalid data', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA_CreateAccount error message shown when input invalid data');
    const graphqlClient = await createGraphQLClient();

    logger.step('Step 1 - Execute CreateAccount mutation with invalid email');
    const response = await graphqlClient.mutateWrapped(CREATE_ACCOUNT_MUTATION, plaTestData.invalidEmail);

    logger.step('Step 2 - Assert error response');
    const graphqlResponse = await response.getGraphQLResponse();

    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors).toHaveLength(1);

    softExpect(graphqlResponse.errors![0].message).toContain(plaErrorMessages.invalidEmail);
    softExpect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-input');
    softExpect(graphqlResponse.data.createCustomer).toBeNull();

    logger.verify('Error category', 'graphql-input', graphqlResponse.errors![0].extensions?.category);
  });

  test('PLA_CreateAccount - should create a new customer account', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA_CreateAccount should create a new customer account');
    const graphqlClient = await createGraphQLClient();

    logger.step('Step 1 - Execute CreateAccount mutation with valid data');
    const response = await graphqlClient.mutateWrapped(CREATE_ACCOUNT_MUTATION, plaTestData.validCustomer);

    logger.step('Step 2 - Assert account created');
    await response.assertNoErrors();
    await response.assertHasData();
    await response.assertDataField('createCustomer.customer.__typename', 'Customer');

    const data = await response.getData();
    customerId = data.createCustomer.customer.id;
    setCustomerId(customerId);

    softExpect(data.createCustomer.customer.id).toBeDefined();
    softExpect(data.createCustomer.customer.firstname).toBe(expectedCustomerData.firstname);
    softExpect(data.createCustomer.customer.lastname).toBe(expectedCustomerData.lastname);
    softExpect(data.createCustomer.customer.email).toBe(testEmail);

    logger.verify('Customer email', testEmail, data.createCustomer.customer.email);
    logger.action('Stored', `customerId=${customerId}`);
  });

  test('PLA_SignIn - should login fail when provide wrong email or password', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA_SignIn should login fail when provide wrong email or password');
    const graphqlClient = await createGraphQLClient();

    logger.step('Step 1 - Execute SignIn mutation with invalid password');
    const response = await graphqlClient.mutateWrapped(SIGN_IN_MUTATION, plaTestData.invalidPassword);

    logger.step('Step 2 - Assert error response');
    const graphqlResponse = await response.getGraphQLResponse();

    expect(graphqlResponse.errors).toBeDefined();
    expect(graphqlResponse.errors).toHaveLength(1);

    softExpect(graphqlResponse.errors![0].message).toBe(plaErrorMessages.invalidCredentials);
    softExpect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-authentication');
    softExpect(graphqlResponse.data.generateCustomerToken).toBeNull();

    logger.verify('Error category', 'graphql-authentication', graphqlResponse.errors![0].extensions?.category);
  });

  test('PLA_SignIn - should generate customer token for valid credentials', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA_SignIn should generate customer token for valid credentials');
    const graphqlClient = await createGraphQLClient();

    logger.step('Step 1 - Execute SignIn mutation with valid credentials');
    const { email, password, remember } = plaTestData.validCredentials;
    const response = await graphqlClient.mutateWrapped(SIGN_IN_MUTATION, { email, password, remember });

    logger.step('Step 2 - Assert token generated');
    await response.assertNoErrors();
    await response.assertHasData();
    await response.assertDataField('generateCustomerToken.token', expect.any(String));
    await response.assertDataField('generateCustomerToken.__typename', 'CustomerToken');

    const data = await response.getData();
    customerToken = data.generateCustomerToken.token;
    setCustomerToken(customerToken);

    const specialCharRegex = /[^a-zA-Z0-9._-]/;
    softExpect(customerToken).not.toMatch(specialCharRegex);
    softExpect(customerToken).toBeTruthy();

    logger.verify('Token generated', true, customerToken.length > 0);
    logger.action('Stored', 'customerToken set in shared-state');
  });

  test('PLA_GetCustomerDetails - should retrieve customer details with valid token', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA_GetCustomerDetails should retrieve customer details with valid token');

    expect(customerToken).toBeDefined();
    expect(customerToken).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    logger.step('Step 1 - Execute getCustomerDetails query with auth token');
    const response = await authClient.queryWrapped(GET_CUSTOMER_DETAILS_QUERY);

    logger.step('Step 2 - Assert customer details returned');
    await response.assertNoErrors();
    await response.assertHasData();
    await response.assertDataField('customer.id', expect.any(Number));

    const data = await response.getData();
    const customer = data.customer;

    customerId = customer.id;
    setCustomerId(customerId);

    softExpect(customer.id).toBeDefined();
    softExpect(customer.firstname).toBe(expectedCustomerData.firstname);
    softExpect(customer.lastname).toBe(expectedCustomerData.lastname);
    softExpect(customer.email).toBe(testEmail);
    softExpect(customer.is_subscribed).toBe(expectedCustomerData.isSubscribed);
    softExpect(customer.gender).toBe(expectedCustomerData.gender);
    softExpect(customer.__typename).toBe('Customer');

    logger.verify('Customer email', testEmail, customer.email);
    logger.verify('Customer typename', 'Customer', customer.__typename);
  });
});
