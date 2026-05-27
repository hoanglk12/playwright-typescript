import { apiTest as test, expect, softExpect } from "../../src/api/ApiTest";
import { AuthType } from "../../src/api/ApiClient";
import {
  plaTestData,
} from "../../src/data/api/pla-test-data";
import { setCustomerToken, setAddressId, setCustomerId, getCustomerId, getAddressId } from './shared-state';
import { createTestLogger } from '../../src/utils/test-logger';

let customerToken: string;
export let customerId: string;
export let addressId: string;

const intRegex = /^\d+$/;

const SIGN_IN_MUTATION = `
  mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
    generateCustomerToken(email: $email, password: $password, remember: $remember) {
      token
      __typename
    }
  }
`;

const CREATE_ACCOUNT_MUTATION = `
  mutation CreateAccount(
    $email: String!, $firstname: String!, $lastname: String!,
    $password: String!, $phone_number: String!, $is_subscribed: Boolean!,
    $loyalty_program_status: Boolean, $order_number: String,
    $gender: Int, $date_of_birth: String
  ) {
    createCustomer(input: {
      email: $email, firstname: $firstname, lastname: $lastname,
      password: $password, phone_number: $phone_number,
      is_subscribed: $is_subscribed, loyalty_program_status: $loyalty_program_status,
      order_number: $order_number, gender: $gender, date_of_birth: $date_of_birth
    }) {
      customer { id email __typename }
    }
  }
`;

const GET_CUSTOMER_ID_QUERY = `
  query GetCustomerId {
    customer { id }
  }
`;

const ADD_ADDRESS_MUTATION = `
  mutation AddNewCustomerAddressToAddressBook($address: CustomerAddressInput!) {
    createCustomerAddress(input: $address) {
      id
      __typename
    }
  }
`;

const GET_ADDRESSES_QUERY = `query GetCustomerAddressesForAddressBook{customer{id addresses{id ...CustomerAddressFragment __typename}__typename}countries{id full_name_locale __typename}}fragment CustomerAddressFragment on CustomerAddress{__typename id city company country_code default_billing default_shipping firstname lastname middlename postcode region{region __typename}custom_attributes{attribute_code value __typename}street telephone}`;

const UPDATE_ADDRESS_MUTATION = `
  mutation UpdateCustomerAddressInAddressBook($addressId: Int!, $updated_address: CustomerAddressInput!) {
    updateCustomerAddress(id: $addressId, input: $updated_address) {
      id
      default_billing
      default_shipping
      __typename
    }
  }
`;

const DELETE_ADDRESS_MUTATION = `
  mutation DeleteCustomerAddressFromAddressBook($addressId: Int!) {
    deleteCustomerAddress(id: $addressId)
  }
`;

const SET_NEWSLETTER_MUTATION = `
  mutation SetNewsletterSubscription($is_subscribed: Boolean!) {
    updateCustomerV2(input: {is_subscribed: $is_subscribed}) {
      customer {
        id
        is_subscribed
        __typename
      }
      __typename
    }
  }
`;

const SET_LOYALTY_NEWSLETTER_MUTATION = `
  mutation SetLoyaltyAndNewsletterSubscription($is_subscribed: Boolean!, $loyalty_program_status: Boolean) {
    updateCustomerV2(input: {is_subscribed: $is_subscribed, loyalty_program_status: $loyalty_program_status}) {
      customer {
        id
        is_subscribed
        loyalty_program_status
        __typename
      }
      __typename
    }
  }
`;

const LOYALTY_QUERY = `query loyalty{multiplerewards_loyalty_newsletter_subscription_messages multiplerewards_loyalty_newsletter_subscription_banner_messages}`;

test.describe.configure({ mode: 'serial' });

test.describe("PLA GraphQL API - My Details apis", () => {

  test.beforeAll(async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA My Details - Setup');
    addressId = getAddressId();

    const client = await createGraphQLClient();

    // Always sign in fresh — Magento 2 may invalidate earlier tokens when
    // other spec files generate new tokens for the same account (e.g. pla-authentication.spec.ts).
    // Reusing a stale token from shared-state causes graphql-authorization errors in CI.
    logger.step('Sign in fresh to obtain a valid token');
    const signInResponse = await client.mutateWrapped(SIGN_IN_MUTATION, plaTestData.validCredentials);
    const signInGql = await signInResponse.getGraphQLResponse();

    if (!signInGql.errors) {
      const token = signInGql.data?.generateCustomerToken?.token;
      if (!token) throw new Error('Sign-in succeeded but token was missing from response');
      customerToken = token;
      setCustomerToken(customerToken);
      logger.action('Fresh token acquired', '');
    } else {
      // Account may not exist yet (standalone run) — create it, then sign in
      logger.step('Sign-in failed — creating account first');
      const createResponse = await client.mutateWrapped(CREATE_ACCOUNT_MUTATION, plaTestData.validCustomer);
      const createGql = await createResponse.getGraphQLResponse();

      if (createGql.errors) {
        const errorMsg = createGql.errors[0]?.message ?? '';
        if (!errorMsg.toLowerCase().includes('already') && !errorMsg.toLowerCase().includes('exists')) {
          throw new Error(`Account creation failed: ${errorMsg}`);
        }
        logger.action('Account already exists — proceeding to sign in', '');
      } else {
        customerId = createGql.data?.createCustomer?.customer?.id;
        setCustomerId(customerId);
        logger.action('Account created', '');
      }

      const signIn2Response = await client.mutateWrapped(SIGN_IN_MUTATION, plaTestData.validCredentials);
      const signIn2Gql = await signIn2Response.getGraphQLResponse();
      if (signIn2Gql.errors) {
        throw new Error(`Sign-in failed after account creation: ${signIn2Gql.errors[0]?.message}`);
      }
      const token2 = signIn2Gql.data?.generateCustomerToken?.token;
      if (!token2) throw new Error('Sign-in after account creation returned no token');
      customerToken = token2;
      setCustomerToken(customerToken);
      logger.action('Token acquired after account creation', '');
    }

    // Fetch customer ID from API if not available from shared-state
    customerId = getCustomerId();
    if (!customerId) {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      const idResponse = await authClient.queryWrapped(GET_CUSTOMER_ID_QUERY);
      const idGql = await idResponse.getGraphQLResponse();
      customerId = idGql.data?.customer?.id;
      if (customerId) {
        setCustomerId(customerId);
      }
    }

    logger.action('Setup complete', `customerId=${customerId}`);
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

    const variables = plaTestData.addNewCustomerAddressForAddressBook;
    logger.action('Mutation variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(ADD_ADDRESS_MUTATION, variables);

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

    // Magento 2 staging eventual consistency: createCustomerAddress write may not be
    // immediately visible. Retry up to 3x with 1s delay before asserting on address count.
    let data: Record<string, any> = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await authClient.queryWrapped(GET_ADDRESSES_QUERY);
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData() ?? {};
      if ((data.customer?.addresses?.length ?? 0) > 0) break;
      if (attempt < 2) await new Promise<void>((r) => setTimeout(r, 1000));
    }

    logger.step('Step 2 - Assert response');

    const addresses = data.customer.addresses;
    expect(
      addresses && addresses.length > 0,
      'Expected at least one address in address book'
    ).toBe(true);

    addressId = addresses![0].id;
    logger.action('Address ID from response', addressId);
    setAddressId(addressId);

    softExpect(data.customer.id).toBe(customerId);
    softExpect(addresses![0].id).toBe(addressId);
    softExpect(addresses![0].__typename).toBe('CustomerAddress');
    softExpect(addresses![0].city).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.city);
    softExpect(addresses![0].company).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.company);
    softExpect(addresses![0].country_code).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.country_code);
    softExpect(addresses![0].default_billing).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.default_billing);
    softExpect(addresses![0].default_shipping).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.default_shipping);
    softExpect(addresses![0].firstname).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.firstname);
    softExpect(addresses![0].lastname).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.lastname);
    softExpect(addresses![0].middlename).toBeNull();
    softExpect(addresses![0].postcode).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.postcode);
    softExpect(addresses![0].region.region).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.region.region);
    softExpect(addresses![0].region.__typename).toBe('CustomerAddressRegion');
    softExpect(addresses![0].custom_attributes![0].attribute_code).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.attribute_code);
    softExpect(addresses![0].custom_attributes![0].value).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.value);
    softExpect(addresses![0].custom_attributes![0].__typename).toBe('CustomerAddressAttribute');
    softExpect(addresses![0].street[0]).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.street);
    softExpect(addresses![0].telephone).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.telephone);
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

    expect(addressId, 'addressId must be set by PLA_AddNewCustomerAddressToAddressBook').toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const variables = {
      addressId: addressId,
      updated_address: plaTestData.updateCustomerAddressTemplate
    };

    logger.step('Step 2 - Send UpdateCustomerAddress mutation');
    logger.action('Update variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(UPDATE_ADDRESS_MUTATION, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 3 - Assert response');

    expect(data.updateCustomerAddress).toBeDefined();
    softExpect(data.updateCustomerAddress.id).toBe(parseInt(addressId));
    softExpect(data.updateCustomerAddress.default_billing).toBe(false);
    softExpect(data.updateCustomerAddress.default_shipping).toBe(false);

    logger.action('Address updated successfully', addressId);
  });

  test("PLA_DeleteCustomerAddressFromAddressBook - should delete customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('PLA_DeleteCustomerAddressFromAddressBook');
    logger.step('Step 1 - Verify prerequisites');
    logger.action('Address ID to delete', addressId);

    expect(addressId, 'addressId must be set by earlier address tests').toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const variables = {
      addressId: addressId,
    };

    logger.step('Step 2 - Send DeleteCustomerAddress mutation');

    const response = await authClient.mutateWrapped(DELETE_ADDRESS_MUTATION, variables);

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

    const variables = {
      is_subscribed: plaTestData.subscribeNewsletterData.isSubscribed[0]
    };

    const response = await authClient.mutateWrapped(SET_NEWSLETTER_MUTATION, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2?.customer).toBeDefined();
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

    const variables = {
      is_subscribed: plaTestData.subscribeNewsletterData.isSubscribed[1]
    };

    const response = await authClient.mutateWrapped(SET_NEWSLETTER_MUTATION, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2?.customer).toBeDefined();
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

    const variables = {
      is_subscribed: plaTestData.subscribeNewsletterData.isSubscribed[1],
      loyalty_program_status: plaTestData.loyaltyProgramData.status[1]
    };

    logger.action('Mutation variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(SET_LOYALTY_NEWSLETTER_MUTATION, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2?.customer).toBeDefined();
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

    const response = await authClient.queryWrapped(LOYALTY_QUERY);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    softExpect(data.multiplerewards_loyalty_newsletter_subscription_messages).toBeDefined();
    softExpect(data.multiplerewards_loyalty_newsletter_subscription_banner_messages).toBeDefined();
  });
});
