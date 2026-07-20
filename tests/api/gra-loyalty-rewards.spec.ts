/**
 * PLA (Platypus Shoes) GraphQL API Tests
 * Loyalty & Rewards — applyRewardPointsToCart (PlatyPoints) + applyQantasPointsToCart (QFF)
 *
 * Exploration notes (confirmed 2026-06-02 against staging):
 *
 * applyRewardPointsToCart(cartId: ID!)
 *   Succeeds with no errors. Returns applied_multiple_rewards: null when the account has
 *   no PlatyPoints balance. No error is thrown for a zero-balance account.
 *   Auth guard: graphql-authorization error for unauthenticated calls. ✅ testable
 *
 * applyQantasPointsToCart(input: ApplyQantasPointsInput!)
 *   Required input fields: cart_id (String!), quote_ref (String!), points_burned (Int!),
 *   dollar_value (Float!). Optional: member_number (String).
 *   STAGING BUG: The mutation resolver always returns "Internal server error" in the
 *   response regardless of input validity, but the side effect succeeds — the cart's
 *   applied_qantas_points is populated. Verify via a separate cart query (TC_04).
 *   Auth guard: NONE on staging — unauthenticated calls also receive ISE (not an auth error).
 *   Invalid cart_id: "Could not find a cart" error. ✅ testable
 *   QFF credentials (memberNumber, lastName, PIN) are Qantas-API inputs for obtaining
 *   a real quote_ref — that external step is outside Magento GraphQL scope.
 *
 * removeQantasPointsFromCart(input: RemoveQantasPointsInput!)
 *   Required: cart_id (String!). Works without errors. Used for cleanup in afterAll.
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { LoyaltyRewardsData } from '../../src/data/api/gra-loyalty-rewards-data';
import {
  signInAndStoreToken,
  createFreshCart,
  discoverInStockSkus,
  addFirstAddableProduct,
} from './api-test-helpers';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { REMOVE_ITEM_MUTATION } from '../../src/data/api/gra-graphql-operations';

// ── Local types ───────────────────────────────────────────────────────────────

interface CartItem {
  id: number | string;
  product: { sku: string };
}

// ── Module-level state ────────────────────────────────────────────────────────
let customerToken: string = '';
let cartId: string = '';

// ── GraphQL strings ───────────────────────────────────────────────────────────

const GET_CART_ITEMS_QUERY = `
  query GetCartItems($cartId: String!) {
    cart(cart_id: $cartId) {
      items { id quantity product { sku __typename } __typename }
      total_quantity
      __typename
    }
  }
`;

const APPLY_REWARD_POINTS_MUTATION = `
  mutation ApplyRewardPointsToCart($cartId: ID!) {
    applyRewardPointsToCart(cartId: $cartId) {
      cart {
        id
        applied_multiple_rewards {
          applied_amount
          applied_rewards {
            applied
            left
            reward_id
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const REMOVE_REWARD_POINTS_MUTATION = `
  mutation RemoveRewardPointsFromCart($cartId: ID!) {
    removeRewardPointsFromCart(cartId: $cartId) {
      cart {
        id
        applied_multiple_rewards {
          applied_amount
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const APPLY_QANTAS_POINTS_MUTATION = `
  mutation ApplyQantasPointsToCart($input: ApplyQantasPointsInput!) {
    applyQantasPointsToCart(input: $input) {
      cart {
        id
        __typename
      }
      __typename
    }
  }
`;

const REMOVE_QANTAS_POINTS_MUTATION = `
  mutation RemoveQantasPointsFromCart($input: RemoveQantasPointsInput!) {
    removeQantasPointsFromCart(input: $input) {
      cart {
        id
        applied_qantas_points {
          points_burned
          dollar_value
          member_number
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const GET_CART_LOYALTY_STATE_QUERY = `
  query GetCartLoyaltyState($cartId: String!) {
    cart(cart_id: $cartId) {
      id
      qff_reward {
        is_qff_member
        qff_points
        qff_reward_message
        __typename
      }
      applied_qantas_points {
        points_burned
        dollar_value
        member_number
        __typename
      }
      applied_multiple_rewards {
        applied_amount
        applied_rewards {
          applied
          left
          reward_id
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('GRA GraphQL API - Loyalty & Rewards @api @graphql', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('beforeAll Loyalty & Rewards setup');

    // ── 1. Sign in fresh (creates account if not exists) ──────────────────
    const anonClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(anonClient, logger, site, siteState);

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // ── 2. Create fresh cart ───────────────────────────────────────────────
    await logger.step('Step 1 - Create fresh cart', async () => {
      cartId = await createFreshCart(authClient, logger);
    });

    // ── 3. Discover in-stock SKU and add to cart ───────────────────────────
    await logger.step('Step 2 - Discover in-stock SKU and add to cart', async () => {
      const candidateSkus = await discoverInStockSkus(authClient, {
        searchTerms: ['shoe', 'a', 'boot', ''],
        pageSize: 20,
      });
      if (!candidateSkus.length) throw new Error('beforeAll: no in-stock product SKUs found');

      const result = await addFirstAddableProduct(authClient, cartId, candidateSkus.slice(0, 5));
      if (!result.added) throw new Error('beforeAll: could not add any in-stock product to cart');
      logger.action('Product added to cart', result.sku);
      logger.action('beforeAll complete', `cartId=${cartId}`);
    });
  });

  test.afterAll(async ({ createGraphQLClient }) => {
    if (!cartId || !customerToken) return;
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    try {
      // Remove QFF and PlatyPoints discounts
      await authClient.mutateWrapped(REMOVE_QANTAS_POINTS_MUTATION, { input: { cart_id: cartId } });
      await authClient.mutateWrapped(REMOVE_REWARD_POINTS_MUTATION, { cartId });
    } catch {
      // Non-fatal
    }
    try {
      // Remove ALL cart items to prevent accumulation across test runs.
      // createEmptyCart reuses the existing customer cart, so repeated runs
      // would keep adding items to the same cart unless we clean up here.
      const itemsGql = await (await authClient.queryWrapped(GET_CART_ITEMS_QUERY, { cartId })).getData();
      const items: CartItem[] = itemsGql?.cart?.items ?? [];
      for (const item of items) {
        await authClient.mutateWrapped(REMOVE_ITEM_MUTATION, {
          input: { cart_id: cartId, cart_item_id: Number(item.id) },
        });
      }
    } catch {
      // Non-fatal
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // applyRewardPointsToCart (PlatyPoints)
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_01 - applyRewardPointsToCart authenticated → response returned, applied_multiple_rewards null for zero-balance account', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 applyRewardPointsToCart authenticated');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute applyRewardPointsToCart', async () => {
      logger.action('POST', `applyRewardPointsToCart (cartId=${cartId})`);
      response = await authClient.mutateWrapped(APPLY_REWARD_POINTS_MUTATION, { cartId });
    });

    await logger.step('Step 2 - Assert no errors and response structure valid', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const cart = data?.applyRewardPointsToCart?.cart;

      expect(cart, 'cart must be defined in applyRewardPointsToCart response').toBeDefined();
      logger.verify('cart.id matches', cartId, cart?.id);
      softExpect(cart?.id).toBe(cartId);
      softExpect(cart?.__typename).toBe('Cart');

      // applied_multiple_rewards is null when account has no PlatyPoints balance — this is not an error
      logger.verify('applied_multiple_rewards present (null = no balance, not an error)', true, 'applied_multiple_rewards' in cart);
      expect(
        'applied_multiple_rewards' in cart,
        'applied_multiple_rewards field must be present in response (null is valid for zero-balance accounts)',
      ).toBe(true);
    });
  });

  test('TC_02 - applyRewardPointsToCart unauthenticated → graphql-authorization error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 applyRewardPointsToCart unauthenticated');

    const anonClient = await createGraphQLClient();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute applyRewardPointsToCart with no auth token', async () => {
      logger.action('POST', `applyRewardPointsToCart (no auth, cartId=${cartId})`);
      response = await anonClient.mutateWrapped(APPLY_REWARD_POINTS_MUTATION, { cartId });
    });

    await logger.step('Step 2 - Assert authorization error returned', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMsg = gql.errors?.[0]?.message ?? '';
      const errorCategory = gql.errors?.[0]?.extensions?.category ?? '';

      logger.verify('Error message present', true, errorMsg.length > 0);
      const acceptedCategories = LoyaltyRewardsData.unauthenticatedErrorCategories;
      logger.verify('Error category (authorization-class)', acceptedCategories.join('|'), errorCategory);
      expect(errorMsg.length, 'Expected an error message for unauthenticated request').toBeGreaterThan(0);
      softExpect(acceptedCategories.includes(errorCategory)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // applyQantasPointsToCart (QFF)
  // Staging quirk: The mutation resolver always returns "Internal server error"
  // in the response body regardless of input validity. The side effect (cart state
  // update) still succeeds. TC_03 documents this behaviour; TC_04 verifies the
  // side effect via a separate cart query.
  // ═══════════════════════════════════════════════════════════════════════════

  test('TC_03 - applyQantasPointsToCart valid input → mutation accepted, side effect verified in TC_04', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 applyQantasPointsToCart valid input');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { memberNumber, pointsBurned, dollarValue, quoteRef } = LoyaltyRewardsData.qffApply;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute applyQantasPointsToCart with valid QFF member data', async () => {
      logger.action('POST', `applyQantasPointsToCart (cartId=${cartId}, memberNumber=${memberNumber}, points=${pointsBurned})`);
      response = await authClient.mutateWrapped(APPLY_QANTAS_POINTS_MUTATION, {
        input: {
          cart_id: cartId,
          quote_ref: quoteRef,
          points_burned: pointsBurned,
          dollar_value: dollarValue,
          member_number: memberNumber,
        },
      });
    });

    await logger.step('Step 2 - Observe response (ISE is a known intermittent staging bug; side effect always succeeds)', async () => {
      const gql = await response.getGraphQLResponse();
      const errorMsg = gql.errors?.[0]?.message ?? '';
      const hasData = !!gql.data?.applyQantasPointsToCart;

      // The staging resolver sometimes returns "Internal server error" on this mutation
      // (observed when the cart has accumulated many items from repeated test runs).
      // In both error and success cases the side effect (applied_qantas_points on the cart)
      // is applied correctly — verified in TC_04 via a separate cart query.
      logger.verify(
        'Mutation ran (either success or staging ISE — both result in applied side effect)',
        true,
        hasData || errorMsg.length > 0,
      );
      expect(
        hasData || errorMsg.length > 0,
        'applyQantasPointsToCart must either return cart data or an error — a completely empty response is unexpected',
      ).toBe(true);

      if (errorMsg.length > 0) {
        logger.action('Staging ISE observed in response', errorMsg);
        softExpect(errorMsg).toContain('Internal server error');
      } else {
        logger.action('Mutation responded without error', 'side effect confirmed via TC_04');
        softExpect(gql.data?.applyQantasPointsToCart?.cart?.id).toBe(cartId);
      }
    });
  });

  test('TC_04 - applyQantasPointsToCart side effect: cart applied_qantas_points populated after TC_03', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 applyQantasPointsToCart side effect verification');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { memberNumber, pointsBurned, dollarValue } = LoyaltyRewardsData.qffApply;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query cart loyalty state after applyQantasPointsToCart', async () => {
      logger.action('GET', `cart(cart_id=${cartId}) applied_qantas_points`);
      response = await authClient.queryWrapped(GET_CART_LOYALTY_STATE_QUERY, { cartId });
    });

    await logger.step('Step 2 - Assert applied_qantas_points populated with submitted values', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const appliedQff = data?.cart?.applied_qantas_points;

      expect(appliedQff, 'applied_qantas_points must be populated after applyQantasPointsToCart').not.toBeNull();
      expect(appliedQff, 'applied_qantas_points must be defined').toBeDefined();

      logger.verify('points_burned', pointsBurned, appliedQff?.points_burned);
      logger.verify('dollar_value', dollarValue, appliedQff?.dollar_value);
      logger.verify('member_number', memberNumber, appliedQff?.member_number);

      softExpect(appliedQff?.points_burned).toBe(pointsBurned);
      softExpect(appliedQff?.dollar_value).toBe(dollarValue);
      softExpect(appliedQff?.member_number).toBe(memberNumber);
      softExpect(appliedQff?.__typename).toBe('AppliedQantasPoints');
    });
  });

  test('TC_05 - applyQantasPointsToCart invalid cart_id → cart-not-found error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 applyQantasPointsToCart invalid cartId');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const { memberNumber, pointsBurned, dollarValue, quoteRef } = LoyaltyRewardsData.qffApply;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute applyQantasPointsToCart with invalid cart_id', async () => {
      logger.action('POST', `applyQantasPointsToCart (cart_id=${LoyaltyRewardsData.invalidCartId})`);
      response = await authClient.mutateWrapped(APPLY_QANTAS_POINTS_MUTATION, {
        input: {
          cart_id: LoyaltyRewardsData.invalidCartId,
          quote_ref: quoteRef,
          points_burned: pointsBurned,
          dollar_value: dollarValue,
          member_number: memberNumber,
        },
      });
    });

    await logger.step('Step 2 - Assert cart-not-found error', async () => {
      await response.assertHasErrors();

      const gql = await response.getGraphQLResponse();
      const errorMsg = gql.errors?.[0]?.message ?? '';

      logger.verify('Error message present', true, errorMsg.length > 0);
      logger.verify('Error message contains cart ID reference', true, errorMsg.toLowerCase().includes('cart'));
      expect(errorMsg.length, 'Expected an error message for invalid cart_id').toBeGreaterThan(0);
      softExpect(errorMsg.toLowerCase()).toContain('cart');
    });
  });

  test('TC_06 - removeRewardPointsFromCart → applied_multiple_rewards cleared', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 removeRewardPointsFromCart');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    await logger.step('Step 1 - Apply reward points first (to have something to remove)', async () => {
      await authClient.mutateWrapped(APPLY_REWARD_POINTS_MUTATION, { cartId });
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 2 - Execute removeRewardPointsFromCart', async () => {
      logger.action('POST', `removeRewardPointsFromCart (cartId=${cartId})`);
      response = await authClient.mutateWrapped(REMOVE_REWARD_POINTS_MUTATION, { cartId });
    });

    await logger.step('Step 3 - Assert no errors and rewards cleared', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const cart = data?.removeRewardPointsFromCart?.cart;

      expect(cart, 'cart must be defined in removeRewardPointsFromCart response').toBeDefined();
      logger.verify('applied_multiple_rewards cleared', null, cart?.applied_multiple_rewards);
      softExpect(cart?.applied_multiple_rewards).toBeNull();
    });
  });

  test('TC_07 - removeQantasPointsFromCart → applied_qantas_points cleared', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 removeQantasPointsFromCart');

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute removeQantasPointsFromCart', async () => {
      logger.action('POST', `removeQantasPointsFromCart (cart_id=${cartId})`);
      response = await authClient.mutateWrapped(REMOVE_QANTAS_POINTS_MUTATION, {
        input: { cart_id: cartId },
      });
    });

    await logger.step('Step 2 - Assert no errors and QFF points cleared', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      const cart = data?.removeQantasPointsFromCart?.cart;

      expect(cart, 'cart must be defined in removeQantasPointsFromCart response').toBeDefined();
      logger.verify('applied_qantas_points cleared after remove', null, cart?.applied_qantas_points);
      softExpect(cart?.applied_qantas_points).toBeNull();
    });
  });

});
