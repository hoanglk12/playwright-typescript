import { apiTest as test } from "../../src/api/ApiTest";
import { expect } from "@playwright/test";
import {
  plaTestData,
  getTestEmail,
  plaErrorMessages,
  expectedCustomerData,
} from "../../src/data/api/pla-test-data";
import { getCustomerToken, setCustomerToken, setAddressId, setCustomerId, getCustomerId, getAddressId } from './shared-state';

let customerToken: string;
export let customerId: string;
export let addressId: string;
// Reuse the SAME test email generator as pla-account-creation-signin.spec.ts
const testEmail = getTestEmail();

//Regex to check integer number format
const intRegex = /^\d+$/;
test.describe.serial("PLA GraphQL API - My Details apis", () => {
  
  test.beforeAll(async ({ createGraphQLClient }) => {
    // Try to get token from shared state first (if running after account creation tests)
    customerToken = getCustomerToken();
    customerId = getCustomerId(); // Also try to get customerId from shared state
    addressId = getAddressId(); // Also try to get addressId from shared state
    
    // If no token exists (running standalone), create account and sign in
    if (!customerToken) {
      console.log('No shared token found. Creating account and signing in...');
      
      const client = await createGraphQLClient();
      
      // Step 1: Try to create account (might fail if account already exists)
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
      const createGraphqlResponse = await createResponse.getGraphQLResponse();

      customerId = createGraphqlResponse.data?.createCustomer?.customer?.id;
      console.log("Customer ID:", customerId);

      setCustomerId(customerId);
      
      if (createGraphqlResponse.errors) {
        const errorMessage = createGraphqlResponse.errors[0]?.message || '';
        if (errorMessage.includes('already') || errorMessage.includes('exists')) {
          console.log('⚠️  Account already exists, skipping to sign in...');
        } else {
          console.error('❌ Account creation failed:', errorMessage);
          throw new Error(`Account creation failed: ${errorMessage}`);
        }
      } else {
        console.log('✅ Account created with email:', testEmail);
      }
      
      // Step 2: Sign in with the credentials (only works if account was just created with this password)
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
      const signInGraphqlResponse = await signInResponse.getGraphQLResponse();
      
      if (signInGraphqlResponse.errors) {
        const signInError = signInGraphqlResponse.errors[0]?.message || '';
        console.error('❌ Sign-in failed:', signInError);
        console.error('This usually means the account exists but has a different password.');
        console.error('Please delete the existing test account or use a fresh test environment.');
        throw new Error(`Sign-in failed: ${signInError}`);
      }
      
      customerToken = signInGraphqlResponse.data.generateCustomerToken.token;
      
      // Save to shared state for potential reuse
      setCustomerToken(customerToken);

      console.log('✅ Token acquired for my-details tests');
    } else {
      console.log('✅ Using existing shared token from test suite');
    }
  });

  test("PLA_AddNewCustomerAddressToAddressBook - should add new customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const mutation = `mutation AddNewCustomerAddressToAddressBook($address: CustomerAddressInput!) {
  createCustomerAddress(input: $address) {
    id
    __typename
  }
}`;
   const variables = plaTestData.addNewCustomerAddressForAddressBook;
   console.log("Address to add:", variables);

   const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("Response data:", data);

    addressId = data.createCustomerAddress.id;
    console.log("New Address ID:", addressId);

     // Save to shared state for potential reuse
    setAddressId(addressId);

    // Validate customer data
    expect(data.createCustomerAddress).toBeDefined();
    expect(data.createCustomerAddress.id.toString()).toMatch(intRegex);
    expect(data.createCustomerAddress.__typename).toBe('CustomerAddress');
});

test("PLA_GetCustomerAddressesForAddressBook - should retrieve customer addresses with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `query GetCustomerAddressesForAddressBook{customer{id addresses{id ...CustomerAddressFragment __typename}__typename}countries{id full_name_locale __typename}}fragment CustomerAddressFragment on CustomerAddress{__typename id city company country_code default_billing default_shipping firstname lastname middlename postcode region{region __typename}custom_attributes{attribute_code value __typename}street telephone}`;
  

   const response = await authClient.queryWrapped(query);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("Get Response data:", data);

    // addressId = data.createCustomerAddress.id;
    // console.log("New Address ID:", addressId);

     // Save to shared state for potential reuse
    // setAddressId(addressId);

    // Validate customer and address data
    expect(data.customer.id).toBe(customerId);
    expect(data.customer.addresses![0].id).toBe(addressId);
    expect(data.customer.addresses![0].__typename).toBe('CustomerAddress');
    expect(data.customer.addresses![0].city).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.city);
    expect(data.customer.addresses![0].company).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.company);
    expect(data.customer.addresses![0].country_code).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.country_code);
    expect(data.customer.addresses![0].default_billing).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.default_billing);
    expect(data.customer.addresses![0].default_shipping).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.default_shipping);
    expect(data.customer.addresses![0].firstname).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.firstname);
    expect(data.customer.addresses![0].lastname).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.lastname);
    expect(data.customer.addresses![0].middlename).toBeNull();
    expect(data.customer.addresses![0].postcode).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.postcode);
    expect(data.customer.addresses![0].region.region).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.region.region);
    expect(data.customer.addresses![0].region.__typename).toBe('CustomerAddressRegion');
    expect(data.customer.addresses![0].custom_attributes![0].attribute_code).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.attribute_code);
    expect(data.customer.addresses![0].custom_attributes![0].value).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.custom_attributes.value.value);
    expect(data.customer.addresses![0].custom_attributes![0].__typename).toBe('CustomerAddressAttribute');
    expect(data.customer.addresses![0].street[0]).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.street);
    expect(data.customer.addresses![0].telephone).toBe(plaTestData.addNewCustomerAddressForAddressBook.address.telephone);
    expect(data.customer.__typename).toBe('Customer');
    expect(data.countries![0].id).toBe('AU');
    expect(data.countries![0].full_name_locale).toBe('Australia');
    expect(data.countries![0].__typename).toBe('Country');

});

test("PLA_UpdateCustomerAddressInAddressBook - should update customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');
    console.log("Address ID to update:", addressId);

    // Ensure we have an addressId from the first test
    expect(addressId).toBeDefined();
    expect(addressId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    // GraphQL mutation to update customer address
    const mutation = `mutation UpdateCustomerAddressInAddressBook($addressId: Int!, $updated_address: CustomerAddressInput!) {
  updateCustomerAddress(id: $addressId, input: $updated_address) {
    id
    __typename
  }
}`;

    // Build variables with dynamic addressId and static update data from test data
    const variables = {
      addressId: addressId, // Keep as string for GraphQL Int type
      updated_address: plaTestData.updateCustomerAddressTemplate
    };

    console.log("Update variables:", JSON.stringify(variables, null, 2));

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("Updated response data:", data);

    // Validate the response
    expect(data.updateCustomerAddress).toBeDefined();
    expect(data.updateCustomerAddress.id).toBe(parseInt(addressId)); // Compare as numbers
    expect(data.updateCustomerAddress).toBeDefined();
    expect(data.updateCustomerAddress.default_billing).toBeFalsy();
    expect(data.updateCustomerAddress.default_shipping).toBeFalsy();

    console.log("✅ Address updated successfully");
});

test("PLA_DeleteCustomerAddressFromAddressBook - should delete customer address with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');
    console.log("Address ID to update:", addressId);

    // Ensure we have an addressId from the first test
    expect(addressId).toBeDefined();
    expect(addressId).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    // GraphQL mutation to update customer address
    const mutation = `mutation DeleteCustomerAddressFromAddressBook($addressId: Int!) {
  deleteCustomerAddress(id: $addressId)
}`;

    // Build variables with dynamic addressId and static update data from test data
    const variables = {
      addressId: addressId, // Keep as string for GraphQL Int type
      
    };



    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("Updated response data:", data);

    // Validate the response
    expect(data.deleteCustomerAddress).toBeDefined();
    expect(data.deleteCustomerAddress).toBe(true);

    console.log("✅ Address deleted successfully");
});

test("PLA_SetNewsletterSubscription - user is subscribed to newsletter with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    // GraphQL mutation to subscribe to newsletter
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
    console.log("Updated response data:", data);

    // Validate the response
    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2.customer).toBeDefined();
    expect(data.updateCustomerV2.customer.id).toBe(customerId);
    expect(data.updateCustomerV2.customer.is_subscribed).toBe(true);

    console.log("✅ User is subscribed to newsletter successfully");
});

test("PLA_SetNewsletterSubscription - user is unsubscribed to newsletter with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    // GraphQL mutation to unsubscribe from newsletter
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
    console.log("Updated response data:", data);

    // Validate the response
    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2.customer).toBeDefined();
    expect(data.updateCustomerV2.customer.id).toBe(customerId);
    expect(data.updateCustomerV2.customer.is_subscribed).toBe(false);

    console.log("✅ User is subscribed to newsletter successfully");
});

test("PLA_SetLoyaltyAndNewsletterSubscription - user is unsubscribed to newsletter and not a loyalty member with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    // GraphQL mutation to update loyalty and newsletter settings
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

    console.log("Updated request data:", variables);

    const response = await authClient.mutateWrapped(mutation, variables);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    console.log("Updated response data:", data);

    // Validate the response
    expect(data.updateCustomerV2).toBeDefined();
    expect(data.updateCustomerV2.customer).toBeDefined();
    expect(data.updateCustomerV2.customer.id).toBe(customerId);
    expect(data.updateCustomerV2.customer.is_subscribed).toBe(false);
    expect(data.updateCustomerV2.customer.loyalty_program_status).toBe(false);

    console.log("✅ User is unsubscribed to newsletter and not a loyalty member successfully");
});



});