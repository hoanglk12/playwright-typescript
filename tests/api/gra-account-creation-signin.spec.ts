/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Tests for Account Management: Create Account, Sign In, Get Customer Details
 *
 * API Endpoint: Configured via environment (graphqlApiBaseUrl)
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { graErrorMessages } from '../../src/data/api/gra-test-data';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { SIGN_IN_MUTATION, CREATE_ACCOUNT_MUTATION } from '../../src/data/api/gra-graphql-operations';
import { assertNoCriticalErrors } from './api-test-helpers';

let customerToken: string = '';
let customerId: string = '';

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

test.describe('GRA GraphQL API - Account Management', () => {

  test('GRA_CreateAccount - error message shown when input invalid data', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('PLA_CreateAccount error message shown when input invalid data');
    const graphqlClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute CreateAccount mutation with invalid email', async () => {
      response = await graphqlClient.mutateWrapped(CREATE_ACCOUNT_MUTATION, site.testData.invalidEmail);
    });

    await logger.step('Step 2 - Assert error response', async () => {
      const graphqlResponse = await response.getGraphQLResponse();

      expect(graphqlResponse.errors).toBeDefined();
      expect(graphqlResponse.errors).toHaveLength(1);

      softExpect(graphqlResponse.errors![0].message).toContain(graErrorMessages.invalidEmail);
      softExpect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-input');
      softExpect(graphqlResponse.data.createCustomer).toBeNull();

      logger.verify('Error category', 'graphql-input', graphqlResponse.errors![0].extensions?.category);
    });
  });

  test('GRA_CreateAccount - should create a new customer account', async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA_CreateAccount should create a new customer account');
    const graphqlClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute CreateAccount mutation with valid data', async () => {
      response = await graphqlClient.mutateWrapped(CREATE_ACCOUNT_MUTATION, site.testData.validCustomer);
    });

    await logger.step('Step 2 - Assert account created', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      await response.assertDataField('createCustomer.customer.__typename', 'Customer');

      const data = await response.getData();
      customerId = data.createCustomer.customer.id;
      siteState.setCustomerId(customerId);

      const testEmail = site.testData.validCredentials.email;
      softExpect(data.createCustomer.customer.id).toBeDefined();
      softExpect(data.createCustomer.customer.firstname).toBe(site.testData.validCustomer.firstname);
      softExpect(data.createCustomer.customer.lastname).toBe(site.testData.validCustomer.lastname);
      softExpect(data.createCustomer.customer.email).toBe(testEmail);

      logger.verify('Customer email', testEmail, data.createCustomer.customer.email);
      logger.action('Stored', `customerId=${customerId}`);
    });
  });

  test('GRA_SignIn - should login fail when provide wrong email or password', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('PLA_SignIn should login fail when provide wrong email or password');
    const graphqlClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute SignIn mutation with invalid password', async () => {
      response = await graphqlClient.mutateWrapped(SIGN_IN_MUTATION, site.testData.invalidPassword);
    });

    await logger.step('Step 2 - Assert error response', async () => {
      const graphqlResponse = await response.getGraphQLResponse();

      expect(graphqlResponse.errors).toBeDefined();
      expect(graphqlResponse.errors).toHaveLength(1);

      softExpect(graphqlResponse.errors![0].message).toBe(graErrorMessages.invalidCredentials);
      softExpect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-authentication');
      softExpect(graphqlResponse.data.generateCustomerToken).toBeNull();

      logger.verify('Error category', 'graphql-authentication', graphqlResponse.errors![0].extensions?.category);
    });
  });

  test('GRA_SignIn - should generate customer token for valid credentials', async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA_SignIn should generate customer token for valid credentials');
    const graphqlClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute SignIn mutation with valid credentials', async () => {
      const { email, password, remember } = site.testData.validCredentials;
      response = await graphqlClient.mutateWrapped(SIGN_IN_MUTATION, { email, password, remember });
    });

    await logger.step('Step 2 - Assert token generated', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      await response.assertDataField('generateCustomerToken.token', expect.any(String));
      await response.assertDataField('generateCustomerToken.__typename', 'CustomerToken');

      const data = await response.getData();
      customerToken = data.generateCustomerToken.token;
      siteState.setCustomerToken(customerToken);

      const specialCharRegex = /[^a-zA-Z0-9._-]/;
      softExpect(customerToken).not.toMatch(specialCharRegex);
      softExpect(customerToken).toBeTruthy();

      logger.verify('Token generated', true, customerToken.length > 0);
      logger.action('Stored', 'customerToken set in shared-state');
    });
  });

  test('GRA_GetCustomerDetails - should retrieve customer details with valid token', async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA_GetCustomerDetails should retrieve customer details with valid token');

    expect(customerToken).toBeDefined();
    expect(customerToken).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute getCustomerDetails query with auth token', async () => {
      response = await authClient.queryWrapped(GET_CUSTOMER_DETAILS_QUERY);
    });

    await logger.step('Step 2 - Assert customer details returned', async () => {
      // Non-loyalty brands (drm-au, van-au) return a partial error on the loyalty path —
      // filter it out so the rest of the customer data can still be verified
      const gql = await response.getGraphQLResponse();
      assertNoCriticalErrors(gql, ['loyalty', 'loyalty_program_status']);
      await response.assertHasData();
      await response.assertDataField('customer.id', expect.any(Number));

      const data = await response.getData();
      const customer = data.customer;

      customerId = customer.id;
      siteState.setCustomerId(customerId);

      const testEmail = site.testData.validCredentials.email;
      softExpect(customer.id).toBeDefined();
      softExpect(customer.firstname).toBe(site.testData.validCustomer.firstname);
      softExpect(customer.lastname).toBe(site.testData.validCustomer.lastname);
      softExpect(customer.email).toBe(testEmail);
      softExpect(customer.is_subscribed).toBe(false);
      softExpect(customer.gender).toBe(site.testData.validCustomer.gender);
      softExpect(customer.__typename).toBe('Customer');

      logger.verify('Customer email', testEmail, customer.email);
      logger.verify('Customer typename', 'Customer', customer.__typename);
    });
  });
});
