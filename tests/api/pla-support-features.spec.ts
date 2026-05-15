import { apiTest as test, expect, softExpect } from "../../src/api/ApiTest";
import { AuthType } from "../../src/api/ApiClient";
import { plaTestData } from "../../src/data/api/pla-test-data";
import { setCustomerToken, setCartId } from './shared-state';
import { createTestLogger } from '../../src/utils/test-logger';

let customerToken: string = '';
let cartId: string = '';

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

const CREATE_CART_MUTATION = `mutation CreateCartAfterSignIn { createEmptyCart }`;

const GET_CURRENCY_QUERY = `
  query getCurrencyData {
    currency {
      default_display_currency_code
      available_currency_codes
      __typename
    }
  }
`;

const GET_DYNAMIC_DATA_QUERY = `query GetDynamicData($cart_id:String!){cart(cart_id:$cart_id){dynamic_promo_blocks{discount{phrase __typename}gift{phrase __typename}message{progress_percent phrase success_phrase __typename}__typename}__typename}storeConfig{id store_code ewave_dynamicpromoblocks_discount_enable ewave_dynamicpromoblocks_general_enable ewave_dynamicpromoblocks_gift_enable ewave_dynamicpromoblocks_message_enable __typename}}`;

test.describe.configure({ mode: 'serial' });

test.describe("PLA GraphQL API - Support Features @api @graphql @regression", () => {

  test.beforeAll(async ({ createGraphQLClient }) => {
    const logger = createTestLogger('PLA Support Features - Setup');

    logger.step('Initialize unauthenticated GraphQL client');
    const client = await createGraphQLClient();

    // Always sign in fresh — Magento 2 may invalidate earlier tokens when
    // other spec files generate new tokens for the same account.
    // Reusing a stale token from shared-state causes graphql-authorization errors in CI.
    logger.step('Sign in fresh to obtain a valid token');
    const signInCredentials = {
      email: plaTestData.validCredentials.email,
      password: plaTestData.validCredentials.password,
      remember: plaTestData.validCredentials.remember,
    };
    const signInResponse = await client.mutateWrapped(SIGN_IN_MUTATION, signInCredentials);
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
        const errorMsg = createGql.errors.length ? createGql.errors[0]?.message ?? '' : '';
        if (!errorMsg.toLowerCase().includes('already') && !errorMsg.toLowerCase().includes('exists')) {
          throw new Error(`Account creation failed: ${errorMsg}`);
        }
        logger.action('Account already exists — proceeding to sign in', '');
      } else {
        logger.action('Account created', '');
      }

      logger.step('Sign in after account creation confirmed');
      const signIn2Response = await client.mutateWrapped(SIGN_IN_MUTATION, signInCredentials);
      const signIn2Gql = await signIn2Response.getGraphQLResponse();
      if (signIn2Gql.errors) {
        const errMsg = signIn2Gql.errors.length ? signIn2Gql.errors[0]?.message ?? '' : '';
        throw new Error(`Sign-in failed after account creation: ${errMsg}`);
      }
      const token2 = signIn2Gql.data?.generateCustomerToken?.token;
      if (!token2) throw new Error('Sign-in after account creation returned no token');
      customerToken = token2;
      setCustomerToken(customerToken);
      logger.action('Token acquired after account creation', '');
    }

    // Always create a fresh cart — shared-state cartId may belong to a different customer session,
    // causing "cannot perform operations on cart" errors when paired with the fresh token above.
    logger.step('Create fresh cart for this session');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const cartResponse = await authClient.mutateWrapped(CREATE_CART_MUTATION);
    const cartGql = await cartResponse.getGraphQLResponse();
    if (cartGql.errors) {
      const errMsg = cartGql.errors.length ? cartGql.errors[0]?.message ?? '' : '';
      throw new Error(`Cart creation failed: ${errMsg}`);
    }
    const newCartId = cartGql.data?.createEmptyCart;
    if (!newCartId) throw new Error('Cart creation returned no cartId');
    cartId = newCartId;
    setCartId(cartId);
    logger.action('Fresh cart created', cartId);
  });

  test("TC_01 - PLA_getCurrencyData - should get currency code with valid token", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_01 PLA_getCurrencyData - should get currency code with valid token');
    logger.step('Step 1 - Send getCurrencyData query with bearer token');

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const response = await authClient.queryWrapped(GET_CURRENCY_QUERY);

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert response');

    expect(data.currency).toBeDefined();
    softExpect(data.currency.default_display_currency_code).toMatch(/^[A-Z]{3}$/);
    softExpect(data.currency.available_currency_codes).toContain('AUD');
    softExpect(data.currency.__typename).toBe('Currency');
  });

  test("TC_02 - PLA_getDynamicData - should get correct dynamic data with valid cartId", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_02 PLA_getDynamicData - should get correct dynamic data with valid cartId');
    logger.step('Step 1 - Send GetDynamicData query with bearer token and cartId');

    expect(cartId, 'cartId must be set by beforeAll').toBeTruthy();

    const authClient = await createGraphQLClient({
      authType: AuthType.BEARER,
      token: customerToken,
    });

    const response = await authClient.queryWrapped(GET_DYNAMIC_DATA_QUERY, { cart_id: cartId });

    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    logger.step('Step 2 - Assert cart promo blocks and storeConfig flags');

    expect(data.cart).toBeDefined();
    expect(data.storeConfig).toBeDefined();
    softExpect(data.cart.dynamic_promo_blocks.discount).toBeNull();
    softExpect(data.cart.dynamic_promo_blocks.gift).toBeNull();
    softExpect(data.cart.dynamic_promo_blocks.message).toBeDefined();
    softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_general_enable).toBe('boolean');
    softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_discount_enable).toBe('boolean');
    softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_gift_enable).toBe('boolean');
    softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_message_enable).toBe('boolean');
  });
});
