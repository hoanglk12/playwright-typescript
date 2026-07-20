/**
 * GRA GraphQL API Tests — Loyalty & Rewards (NZ store views)
 * PlatyPoints only — Qantas QFF is an AU-only loyalty programme and is absent from this file.
 *
 * applyRewardPointsToCart(cartId: ID!)
 *   Succeeds with no errors. Returns applied_multiple_rewards: null when the account has
 *   no PlatyPoints balance. No error is thrown for a zero-balance account.
 *   Auth guard: graphql-authorization error for unauthenticated calls. ✅ testable
 */

import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import {
  signInAndStoreToken,
  createFreshCart,
  discoverInStockSkus,
  addFirstAddableProduct,
} from './api-test-helpers';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { REMOVE_ITEM_MUTATION } from '../../src/data/api/gra-graphql-operations';
import { LoyaltyRewardsData } from '../../src/data/api/gra-loyalty-rewards-data';

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

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('GRA GraphQL API - Loyalty & Rewards NZ @api @graphql @loyalty @loyalty-nz', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('beforeAll Loyalty & Rewards NZ setup');

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
        searchTerms: [site.catalogSearchTerm, 'a', 'boot', ''],
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
      await authClient.mutateWrapped(REMOVE_REWARD_POINTS_MUTATION, { cartId });
    } catch {
      // Non-fatal
    }
    try {
      // Remove ALL cart items to prevent accumulation across test runs.
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

});
