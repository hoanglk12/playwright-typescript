import { apiTest as test } from "../../src/api/ApiTest";
import { expect } from "@playwright/test";
import {
  plaTestData,
  getTestEmail,
  plaErrorMessages,
  expectedCustomerData,
} from "../../src/data/api/pla-test-data";
import { getCustomerToken, setCustomerToken, setAddressId } from './shared-state';

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

});