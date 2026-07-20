import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from "../../src/api/ApiClient";
import { signInAndStoreToken } from './api-test-helpers';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';

let customerToken: string = '';
let cartId: string = '';

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

test.describe("GRA GraphQL API - Support Features @api @graphql @regression", () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('PLA Support Features - Setup');

    const client = await createGraphQLClient();
    customerToken = await signInAndStoreToken(client, logger, site, siteState);

    await logger.step('Create fresh cart for this session', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      const cartResponse = await authClient.mutateWrapped(CREATE_CART_MUTATION);
      const cartGql = await cartResponse.getGraphQLResponse();
      if (cartGql.errors?.length) {
        throw new Error(`Cart creation failed: ${cartGql.errors[0]?.message ?? ''}`);
      }
      const newCartId = cartGql.data?.createEmptyCart;
      if (!newCartId) throw new Error('Cart creation returned no cartId');
      cartId = newCartId;
      siteState.setCartId(cartId);
      logger.action('Fresh cart created', cartId);
    });
  });

  test("TC_01 - GRA_getCurrencyData - should get currency code with valid token", async ({
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('TC_01 PLA_getCurrencyData - should get currency code with valid token');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Send getCurrencyData query with bearer token', async () => {
      const authClient = await createGraphQLClient({
        authType: AuthType.BEARER,
        token: customerToken,
      });

      response = await authClient.queryWrapped(GET_CURRENCY_QUERY);

      await response.assertNoErrors();
      await response.assertHasData();
    });

    await logger.step('Step 2 - Assert response', async () => {
      const data = await response.getData();

      expect(data.currency).toBeDefined();
      softExpect(data.currency.default_display_currency_code).toMatch(/^[A-Z]{3}$/);
      softExpect(data.currency.available_currency_codes).toContain(site.currency);
      softExpect(data.currency.__typename).toBe('Currency');
    });
  });

  test("TC_02 - GRA_getDynamicData - should get correct dynamic data with valid cartId", async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_02 PLA_getDynamicData - should get correct dynamic data with valid cartId');

    expect(cartId, 'cartId must be set by beforeAll').toBeTruthy();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Send GetDynamicData query with bearer token and cartId', async () => {
      const authClient = await createGraphQLClient({
        authType: AuthType.BEARER,
        token: customerToken,
      });

      response = await authClient.queryWrapped(GET_DYNAMIC_DATA_QUERY, { cart_id: cartId });

      await response.assertNoErrors();
      await response.assertHasData();
    });

    await logger.step('Step 2 - Assert cart promo blocks and storeConfig flags', async () => {
      const data = await response.getData();

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
});
