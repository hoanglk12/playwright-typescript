import { apiTest as test, expect, softExpect } from "../../src/api/ApiTest";
import { AuthType } from "../../src/api/ApiClient";
import {
  plaTestData,
  getTestEmail,
  // plaErrorMessages,
  // expectedCustomerData,
} from "../../src/data/api/pla-test-data";
import { getCustomerToken, setCustomerToken, setAddressId, setCustomerId, getCustomerId, getAddressId } from './shared-state';
import { createTestLogger } from '../../src/utils/test-logger';

let customerToken: string;
export let customerId: string;
export let addressId: string;
// Reuse the SAME test email generator as pla-account-creation-signin.spec.ts
const testEmail = getTestEmail();

const intRegex = /^\d+$/;

test.describe.configure({ mode: 'serial' });

test.describe("PLA GraphQL API - My Details apis", () => {

  test.beforeAll(async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA My Details - Setup');
    customerToken = getCustomerToken();
    customerId = getCustomerId();
    addressId = getAddressId();

    if (!customerToken) {
      logger.step('No shared token found — creating account and signing in');

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
            customer {
              id
              email
              __typename
            }
          }
        }`;

      const createAccountVariables = plaTestData.validCustomer;

      const createResponse = await client.mutateWrapped(createAccountMutation, createAccountVariables);
      const createGraphqlResponse = await createResponse.getGraphQLResponse();

      customerId = createGraphqlResponse.data?.createCustomer?.customer?.id;
      logger.action('Customer ID retrieved', customerId);

      setCustomerId(customerId);

      if (createGraphqlResponse.errors) {
        const errorMessage = createGraphqlResponse.errors[0]?.message || '';
        if (errorMessage.includes('already') || errorMessage.includes('exists')) {
          logger.action('Account already exists — skipping to sign in', '');
        } else {
          logger.error('Account creation failed', errorMessage);
          throw new Error(`Account creation failed: ${errorMessage}`);
        }
      } else {
        logger.action('Account created', testEmail);
      }

      const signInMutation = `
        mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
          generateCustomerToken(email: $email, password: $password, remember: $remember) {
            token
            __typename
          }
        }`;

      const signInVariables = plaTestData.validCredentials;

      const signInResponse = await client.mutateWrapped(signInMutation, signInVariables);
      const signInGraphqlResponse = await signInResponse.getGraphQLResponse();

      if (signInGraphqlResponse.errors) {
        const signInError = signInGraphqlResponse.errors[0]?.message || '';
        logger.error(
          'Sign-in failed — account may exist with a different password. Delete test account or use a fresh environment.',
          signInError
        );
        throw new Error(`Sign-in failed: ${signInError}`);
      }

      customerToken = signInGraphqlResponse.data.generateCustomerToken.token;

      setCustomerToken(customerToken);

      logger.action('Token acquired for my-details tests', '');
    } else {
      logger.action('Using shared token from test suite', '');
    }
  });

  test("PLA_AddNewCustomerAddressToAddressBook - should add new customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_AddNewCustomerAddressToAddressBook');
    logger.step('Step 1 - Send AddNewCustomerAddress mutation with bearer token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const mutation = `mutation AddNewCustomerAddressToAddressBook($address: CustomerAddressInput!) {
  createCustomerAddress(input: $address) {
    id
    __typename
  }
}`;
    const variables = plaTestData.addNewCustomerAddressForAddressBook;
    logger.action('Mutation variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    addressId = data.createCustomerAddress.id;
    logger.action('New address ID', addressId);

    setAddressId(addressId);

    expect(data.createCustomerAddress).toBeDefined();
    softExpect(data.createCustomerAddress.id.toString()).toMatch(intRegex);
    softExpect(data.createCustomerAddress.__typename).toBe('CustomerAddress');
  });

  test("PLA_GetCustomerAddressesForAddressBook - should retrieve customer addresses with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_GetCustomerAddressesForAddressBook');
    expect(customerId).toBeDefined();
    logger.step('Step 1 - Send GetCustomerAddressesForAddressBook query with bearer token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const query = `query GetCustomerAddressesForAddressBook{customer{id addresses{id ...CustomerAddressFragment __typename}__typename}countries{id full_name_locale __typename}}fragment CustomerAddressFragment on CustomerAddress{__typename id city company country_code default_billing default_shipping firstname lastname middlename postcode region{region __typename}custom_attributes{attribute_code value __typename}street telephone}`;

    const response = await authClient.queryWrapped(query);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    addressId = data.customer.addresses![0].id;
    logger.action('Address ID from response', addressId);
    setAddressId(addressId);

    softExpect(data.customer.id).toBe(customerId);
    softExpect(data.customer.addresses![0].id).toBe(addressId);
    softExpect(data.customer.addresses![0].__typename).toBe('CustomerAddress');
    softExpect(data.customer.addresses![0].city).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.city);
    softExpect(data.customer.addresses![0].company).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.company);
    softExpect(data.customer.addresses![0].country_code).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.country_code);
    softExpect(data.customer.addresses![0].default_billing).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.default_billing);
    softExpect(data.customer.addresses![0].default_shipping).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.default_shipping);
    softExpect(data.customer.addresses![0].firstname).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.firstname);
    softExpect(data.customer.addresses![0].lastname).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.lastname);
    softExpect(data.customer.addresses![0].middlename).toBeNull();
    softExpect(data.customer.addresses![0].postcode).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.postcode);
    softExpect(data.customer.addresses![0].region.region).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.region.region);
    softExpect(data.customer.addresses![0].region.__typename).toBe('CustomerAddressRegion');
    softExpect(data.customer.addresses![0].custom_attributes![0].attribute_code).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.attribute_code);
    softExpect(data.customer.addresses![0].custom_attributes![0].value).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.value);
    softExpect(data.customer.addresses![0].custom_attributes![0].__typename).toBe('CustomerAddressAttribute');
    softExpect(data.customer.addresses![0].street[0]).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.street);
    softExpect(data.customer.addresses![0].telephone).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.telephone);
    softExpect(data.customer.__typename).toBe('Customer');
    softExpect(data.countries![0].id).toBe('AU');
    softExpect(data.countries![0].full_name_locale).toBe('Australia');
    softExpect(data.countries![0].__typename).toBe('Country');
  });

  test("PLA_UpdateCustomerAddressInAddressBook - should update customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_UpdateCustomerAddressInAddressBook');
    logger.step('Step 1 - Verify prerequisites');
    logger.action('Address ID to update', addressId);

    expect(addressId).toBeDefined();
    expect(addressId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const mutation = `mutation UpdateCustomerAddressInAddressBook($addressId: Int!, $updated_address: CustomerAddressInput!) {
  updateCustomerAddress(id: $addressId, input: $updated_address) {
    id
    __typename
  }
}`;

    const variables = {
      addressId: addressId,
      updated_address: plaTestData.updateCustomerAddressTemplate
    };

    logger.step('Step 2 - Send UpdateCustomerAddress mutation');
    logger.action('Update variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 3 - Assert response');

    expect(data.updateCustomerAddress).toBeDefined();
    softExpect(data.updateCustomerAddress.id).toBe(parseInt(addressId));
    softExpect(data.updateCustomerAddress.default_billing).toBeFalsy();
    softExpect(data.updateCustomerAddress.default_shipping).toBeFalsy();

    logger.action('Address updated successfully', addressId);
  });

  test("PLA_DeleteCustomerAddressFromAddressBook - should delete customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_DeleteCustomerAddressFromAddressBook');
    logger.step('Step 1 - Verify prerequisites');
    logger.action('Address ID to delete', addressId);

    expect(addressId).toBeDefined();
    expect(addressId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const mutation = `mutation DeleteCustomerAddressFromAddressBook($addressId: Int!) {
  deleteCustomerAddress(id: $addressId)
}`;

    const variables = {
      addressId: addressId,
    };

    logger.step('Step 2 - Send DeleteCustomerAddress mutation');

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 3 - Assert response');

    expect(data.deleteCustomerAddress).toBeDefined();
    softExpect(data.deleteCustomerAddress).toBe(true);

    logger.action('Address deleted successfully', addressId);
  });

  test("PLA_SetNewsletterSubscription - user is subscribed to newsletter with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_SetNewsletterSubscription - subscribe');
    logger.step('Step 1 - Send SetNewsletterSubscription mutation (subscribe)');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const mutation = `mutation SetNewsletterSubscription($is_subscribed: Boolean!) {
  updateCustomerV2(input: {is_subscribed: $is_subscribed}) {
    customer {
      id
      is_subscribed
      __typename
    }
    __typename
  }
}`;

    const variables = {
      is_subscribed: plaTestData.subscribeNewsletterData.isSubscribed[0]
    };

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2.customer).toBeDefined();
    softExpect(data.updateCustomerV2.customer.id).toBe(customerId);
    softExpect(data.updateCustomerV2.customer.is_subscribed).toBe(true);

    logger.action('Newsletter subscription set', 'true');
  });

  test("PLA_SetNewsletterSubscription - user is unsubscribed to newsletter with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_SetNewsletterSubscription - unsubscribe');
    logger.step('Step 1 - Send SetNewsletterSubscription mutation (unsubscribe)');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const mutation = `mutation SetNewsletterSubscription($is_subscribed: Boolean!) {
  updateCustomerV2(input: {is_subscribed: $is_subscribed}) {
    customer {
      id
      is_subscribed
      __typename
    }
    __typename
  }
}`;

    const variables = {
      is_subscribed: plaTestData.subscribeNewsletterData.isSubscribed[1]
    };

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2.customer).toBeDefined();
    softExpect(data.updateCustomerV2.customer.id).toBe(customerId);
    softExpect(data.updateCustomerV2.customer.is_subscribed).toBe(false);

    logger.action('Newsletter subscription set', 'false');
  });

  test("PLA_SetLoyaltyAndNewsletterSubscription - user is unsubscribed to newsletter and not a loyalty member with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_SetLoyaltyAndNewsletterSubscription');
    logger.step('Step 1 - Send SetLoyaltyAndNewsletterSubscription mutation');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const mutation = `mutation SetLoyaltyAndNewsletterSubscription($is_subscribed: Boolean!, $loyalty_program_status: Boolean) {
  updateCustomerV2(input: {is_subscribed: $is_subscribed, loyalty_program_status: $loyalty_program_status}) {
    customer {
      id
      is_subscribed
      loyalty_program_status
      __typename
    }
    __typename
  }
}`;

    const variables = {
      is_subscribed: plaTestData.subscribeNewsletterData.isSubscribed[1],
      loyalty_program_status: plaTestData.loyaltyProgramData.status[1]
    };

    logger.action('Mutation variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2.customer).toBeDefined();
    softExpect(data.updateCustomerV2.customer.id).toBe(customerId);
    softExpect(data.updateCustomerV2.customer.is_subscribed).toBe(false);
    softExpect(data.updateCustomerV2.customer.loyalty_program_status).toBe(false);

    logger.action('Loyalty and newsletter preferences updated', 'unsubscribed, not a loyalty member');
  });

  test("PLA_loyalty - retrieve loyalty newsletter subscription message with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_loyalty');
    logger.step('Step 1 - Send loyalty query with bearer token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const query = `query loyalty{multiplerewards_loyalty_newsletter_subscription_messages multiplerewards_loyalty_newsletter_subscription_banner_messages}`;

    const response = await authClient.queryWrapped(query);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    softExpect(data.multiplerewards_loyalty_newsletter_subscription_messages).toBeDefined();
    softExpect(data.multiplerewards_loyalty_newsletter_subscription_banner_messages).toBeDefined();
  });
});
