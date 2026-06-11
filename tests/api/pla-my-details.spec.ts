import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from "../../src/api/ApiClient";
import { signInAndStoreToken } from './api-test-helpers';
import { createTestLogger } from '../../src/utils/test-logger';

let customerToken: string = '';
let customerId: string = '';
let addressId: string = '';

const intRegex = /^\d+$/;

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

test.describe("PLA GraphQL API - My Details apis", () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA My Details - Setup');
    addressId = siteState.getAddressId();

    const client = await createGraphQLClient();
    customerToken = await signInAndStoreToken(client, logger, site, siteState);

    // Fetch customer ID from API if not available from shared-state
    customerId = siteState.getCustomerId();
    if (!customerId) {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      const idResponse = await authClient.queryWrapped(GET_CUSTOMER_ID_QUERY);
      const idGql = await idResponse.getGraphQLResponse();
      customerId = idGql.data?.customer?.id;
      if (customerId) {
        siteState.setCustomerId(customerId);
      }
    }

    logger.action('Setup complete', `customerId=${customerId}`);
  });

  test("PLA_AddNewCustomerAddressToAddressBook - should add new customer address with valid token", async ({
    createGraphQLClient, site, siteState,
  }) => {
    const logger = createTestLogger('PLA_AddNewCustomerAddressToAddressBook');
    logger.step('Step 1 - Send AddNewCustomerAddress mutation with bearer token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const variables = site.testData.addNewCustomerAddressForAddressBook;
    logger.action('Mutation variables', JSON.stringify(variables));

    const response = await authClient.mutateWrapped(ADD_ADDRESS_MUTATION, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    addressId = data.createCustomerAddress.id;
    logger.action('New address ID', addressId);

    siteState.setAddressId(addressId);

    expect(data.createCustomerAddress).toBeDefined();
    softExpect(data.createCustomerAddress.id.toString()).toMatch(intRegex);
    softExpect(data.createCustomerAddress.__typename).toBe('CustomerAddress');
  });

  test("PLA_GetCustomerAddressesForAddressBook - should retrieve customer addresses with valid token", async ({
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('PLA_GetCustomerAddressesForAddressBook');
    expect(customerId).toBeDefined();
    logger.step('Step 1 - Send GetCustomerAddressesForAddressBook query with bearer token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const response = await authClient.queryWrapped(GET_ADDRESSES_QUERY);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    const addresses = data.customer.addresses;
    expect(
      addresses && addresses.length > 0,
      'Expected at least one address in address book'
    ).toBe(true);

    // Find the address created by the previous test — do not assume it's at index 0
    // (the account may have older addresses that appear first in the list)
    const targetAddress = addresses!.find((addr: { id: unknown }) => String(addr.id) === String(addressId));
    expect(targetAddress, `Expected address with id=${addressId} to exist in address book`).toBeDefined();
    logger.action('Address ID from response', addressId);

    softExpect(data.customer.id).toBe(customerId);
    softExpect(targetAddress!.id).toBe(addressId);
    softExpect(targetAddress!.__typename).toBe('CustomerAddress');
    softExpect(targetAddress!.city).toBe(site.testData.addNewCustomerAddressForAddressBook.address.city);
    softExpect(targetAddress!.company).toBe(site.testData.addNewCustomerAddressForAddressBook.address.company);
    softExpect(targetAddress!.country_code).toBe(site.testData.addNewCustomerAddressForAddressBook.address.country_code);
    softExpect(targetAddress!.default_billing).toBe(site.testData.addNewCustomerAddressForAddressBook.address.default_billing);
    softExpect(targetAddress!.default_shipping).toBe(site.testData.addNewCustomerAddressForAddressBook.address.default_shipping);
    softExpect(targetAddress!.firstname).toBe(site.testData.addNewCustomerAddressForAddressBook.address.firstname);
    softExpect(targetAddress!.lastname).toBe(site.testData.addNewCustomerAddressForAddressBook.address.lastname);
    softExpect(targetAddress!.middlename).toBeNull();
    softExpect(targetAddress!.postcode).toBe(site.testData.addNewCustomerAddressForAddressBook.address.postcode);
    softExpect(targetAddress!.region.region).toBe(site.testData.addNewCustomerAddressForAddressBook.address.region.region);
    softExpect(targetAddress!.region.__typename).toBe('CustomerAddressRegion');
    softExpect(targetAddress!.custom_attributes![0].attribute_code).toBe(site.testData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.attribute_code);
    softExpect(targetAddress!.custom_attributes![0].value).toBe(site.testData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.value);
    softExpect(targetAddress!.custom_attributes![0].__typename).toBe('CustomerAddressAttribute');
    softExpect(targetAddress!.street[0]).toBe(site.testData.addNewCustomerAddressForAddressBook.address.street);
    softExpect(targetAddress!.telephone).toBe(site.testData.addNewCustomerAddressForAddressBook.address.telephone);
    softExpect(data.customer.__typename).toBe('Customer');
    softExpect(data.countries![0].id).toBe('AU');
    softExpect(data.countries![0].full_name_locale).toBe('Australia');
    softExpect(data.countries![0].__typename).toBe('Country');
  });

  test("PLA_UpdateCustomerAddressInAddressBook - should update customer address with valid token", async ({
    createGraphQLClient, site,
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
      updated_address: site.testData.updateCustomerAddressTemplate
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
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('PLA_SetNewsletterSubscription - subscribe');
    logger.step('Step 1 - Send SetNewsletterSubscription mutation (subscribe)');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const variables = {
      is_subscribed: site.testData.subscribeNewsletterData.isSubscribed[0]
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
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('PLA_SetNewsletterSubscription - unsubscribe');
    logger.step('Step 1 - Send SetNewsletterSubscription mutation (unsubscribe)');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const variables = {
      is_subscribed: site.testData.subscribeNewsletterData.isSubscribed[1]
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
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('PLA_SetLoyaltyAndNewsletterSubscription');
    logger.step('Step 1 - Send SetLoyaltyAndNewsletterSubscription mutation');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const variables = {
      is_subscribed: site.testData.subscribeNewsletterData.isSubscribed[1],
      loyalty_program_status: site.testData.loyaltyProgramData.status[1]
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
