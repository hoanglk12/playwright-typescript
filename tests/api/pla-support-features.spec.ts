import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from "../../src/api/ApiClient";
import { signInAndStoreToken } from './api-test-helpers';
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

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA Support Features - Setup');

    const client = await createGraphQLClient();
    customerToken = await signInAndStoreToken(client, logger, site, siteState);

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
    siteState.setCartId(cartId);
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
