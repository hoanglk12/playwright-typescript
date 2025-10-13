import { apiTest as test } from "../../src/api/ApiTest";
import { expect } from "@playwright/test";
import {
  plaTestData,
  getTestEmail,
  plaErrorMessages,
  expectedCustomerData,
} from "../../src/data/api/pla-test-data";
import { getCustomerToken, setCustomerToken } from './shared-state';

let customerToken: string;
let customerId: string;

// Reuse the SAME test email generator as pla-account-creation-signin.spec.ts
const testEmail = getTestEmail();

test.describe.serial("PLA GraphQL API - My Details apis", () => {
  
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
      customerId = createData.createCustomer.customer.id;
      
      console.log('✅ Account created with email:', testEmail);
      
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
      
      console.log('✅ Token acquired for standalone run');
    } else {
      console.log('✅ Using existing shared token from test suite');
    }
  });

  test("PLA_GetCustomerAddressesForAddressBook - should get customer address info with valid token", async ({
    createGraphQLClient,
  }) => {
    console.log("Customer Token (first 20 chars):", customerToken.substring(0, 20) + '...');
    
    expect(customerToken).toBeDefined();
    expect(customerToken).toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: "bearer" as any,
      token: customerToken,
    });

    const query = `query GetCustomerAddressesForAddressBook{customer{id addresses{id ...CustomerAddressFragment __typename}__typename}countries{id full_name_locale __typename}}fragment CustomerAddressFragment on CustomerAddress{__typename id city company country_code default_billing default_shipping firstname lastname middlename postcode region{region __typename}custom_attributes{attribute_code value __typename}street telephone}`;
   
    const response = await authClient.queryWrapped(query);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    
    console.log("Customer addresses retrieved:");
    console.log("  Customer ID:", data.customer.id);
    console.log("  Address count:", data.customer.addresses?.length || 0);
    console.log("  Countries available:", data.countries?.length || 0);
  });
});