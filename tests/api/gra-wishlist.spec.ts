import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import {
  graWishlistData,
  graWishlistErrorCategories,
  UserError,
  DiscoveredProduct,
  WishlistItemShape,
  WishlistShape,
} from '../../src/data/api/gra-wishlist-data';
import { signInAndStoreToken } from './api-test-helpers';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { GraphQLResponse } from '../../src/api/GraphQLClient';

let customerToken: string = '';
let wishlistId: string = '';
let addedItemId: string = '';
let discoveredProductSku: string = '';

// ── GraphQL constants ──────────────────────────────────────────────────────────

const DISCOVER_PRODUCTS_QUERY = `
  query DiscoverWishlistProducts($search: String!, $pageSize: Int) {
    products(search: $search, pageSize: $pageSize) {
      items {
        sku
        name
        __typename
      }
    }
  }
`;

const GET_CUSTOMER_WISHLISTS_QUERY = `
  query GetCustomerWishlists {
    customer {
      wishlists {
        id
        items_count
        items_v2(pageSize: 100) {
          items {
            id
            product {
              sku
              name
              __typename
            }
            quantity
            __typename
          }
        }
        __typename
      }
    }
  }
`;

const ADD_TO_WISHLIST_MUTATION = `
  mutation AddProductsToWishlist($wishlistId: ID!, $items: [WishlistItemInput!]!) {
    addProductsToWishlist(wishlistId: $wishlistId, wishlistItems: $items) {
      wishlist {
        id
        items_count
        items_v2(pageSize: 100) {
          items {
            id
            product {
              sku
              name
              __typename
            }
            quantity
            __typename
          }
        }
        __typename
      }
      user_errors {
        code
        message
      }
    }
  }
`;

const REMOVE_FROM_WISHLIST_MUTATION = `
  mutation RemoveProductsFromWishlist($wishlistId: ID!, $wishlistItemsIds: [ID!]!) {
    removeProductsFromWishlist(wishlistId: $wishlistId, wishlistItemsIds: $wishlistItemsIds) {
      wishlist {
        id
        items_count
        items_v2(pageSize: 100) {
          items {
            id
            product {
              sku
              __typename
            }
            __typename
          }
        }
        __typename
      }
      user_errors {
        code
        message
      }
    }
  }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

interface GqlWithUserErrors {
  user_errors?: UserError[];
}

function wasRejected(
  gql: { errors?: { message?: string }[]; data?: Record<string, GqlWithUserErrors | undefined> },
  opName: string,
): boolean {
  if ((gql.errors?.length ?? 0) > 0) return true;
  const userErrors = gql.data?.[opName]?.user_errors;
  return Array.isArray(userErrors) && userErrors.length > 0;
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe('GRA GraphQL API - Wishlist @api @regression', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('PLA Wishlist - Setup');

    // ── 1. Fresh auth ──────────────────────────────────────────────────────────
    const publicClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(publicClient, logger, site, siteState);

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // ── 2. Discover a SimpleProduct SKU ───────────────────────────────────────
    await logger.step('Discover a SimpleProduct SKU for wishlist tests', async () => {
      const discoverResponse = await publicClient.queryWrapped(DISCOVER_PRODUCTS_QUERY, {
        search: graWishlistData.productSearchTerm,
        pageSize: 20,
      });
      const discoverGql = await discoverResponse.getGraphQLResponse();
      const allItems: DiscoveredProduct[] = discoverGql.data?.products?.items ?? [];
      if (allItems.length === 0) {
        throw new Error(`No products found for search term "${graWishlistData.productSearchTerm}"`);
      }
      // Prefer SimpleProduct; fall back to first item — Magento 2 accepts configurable SKUs in wishlist
      const pickedProduct = allItems.find((item) => item.__typename === 'SimpleProduct') ?? allItems[0];
      discoveredProductSku = pickedProduct.sku;
      logger.action(`Discovered product (${pickedProduct.__typename})`, discoveredProductSku);
    });

    // ── 3. Get wishlist ID ────────────────────────────────────────────────────
    let wishlists: WishlistShape[] = [];
    await logger.step('Get customer wishlist ID', async () => {
      const wishlistResponse = await authClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);
      const wishlistGql = await wishlistResponse.getGraphQLResponse();
      if (wishlistGql.errors?.length) {
        throw new Error(`Failed to get wishlists: ${wishlistGql.errors[0]?.message ?? 'unknown error'}`);
      }
      wishlists = wishlistGql.data?.customer?.wishlists ?? [];
      if (wishlists.length === 0) throw new Error('Customer has no wishlists');
      wishlistId = wishlists[0].id;
      logger.action('Wishlist ID', wishlistId);
    });

    // ── 4. Clean up existing items ────────────────────────────────────────────
    const existingItems: WishlistItemShape[] = wishlists[0].items_v2.items;
    if (existingItems.length > 0) {
      await logger.step(`Cleanup: removing ${existingItems.length} existing item(s)`, async () => {
        const itemIds = existingItems.map((item) => item.id);
        const removeResponse = await authClient.mutateWrapped(REMOVE_FROM_WISHLIST_MUTATION, {
          wishlistId,
          wishlistItemsIds: itemIds,
        });
        const removeGql = await removeResponse.getGraphQLResponse();
        expect(
          wasRejected(removeGql, 'removeProductsFromWishlist'),
          'beforeAll cleanup: failed to remove existing wishlist items',
        ).toBe(false);
        logger.action('Cleanup complete', `removed ${itemIds.length} item(s)`);
      });
    } else {
      logger.action('Cleanup skipped', 'wishlist already empty');
    }
  });

  // ── TC_01: empty wishlist after cleanup ────────────────────────────────────

  test('TC_01 - customer.wishlists → items array is empty after cleanup', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 customer.wishlists → empty after cleanup');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query customer wishlists with auth token', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      response = await authClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);
    });

    let wishlists: WishlistShape[] = [];
    let items: WishlistItemShape[] = [];
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      wishlists = data.customer?.wishlists ?? [];
      items = wishlists[0]?.items_v2?.items ?? [];
    });

    await logger.step('Step 3 - Assert items array is empty', async () => {
      logger.verify('Wishlist items count after cleanup', 0, items.length);
      expect(wishlists.length, 'Expected at least one wishlist').toBeGreaterThan(0);
      expect(items, 'Wishlist items must be empty after cleanup').toHaveLength(0);
      softExpect(wishlists[0]?.items_count, 'items_count should be 0 after cleanup').toBe(0);
    });
  });

  // ── TC_02: add valid product ───────────────────────────────────────────────

  test('TC_02 - addProductsToWishlist valid product → item appears in wishlist', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 addProductsToWishlist valid product → item appears');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Add product to wishlist', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      response = await authClient.mutateWrapped(ADD_TO_WISHLIST_MUTATION, {
        wishlistId,
        items: [{ sku: discoveredProductSku, quantity: graWishlistData.wishlistItemQuantity }],
      });
    });

    let gql!: GraphQLResponse;
    await logger.step('Step 2 - Assert no top-level errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      gql = await response.getGraphQLResponse();
      const userErrors: UserError[] = gql.data?.addProductsToWishlist?.user_errors ?? [];
      logger.verify('No user_errors when adding valid product', 0, userErrors.length);
      expect(userErrors, 'Expected no user_errors for valid product add').toHaveLength(0);
    });

    await logger.step('Step 3 - Assert item appears in wishlist', async () => {
      const wishlistItems: WishlistItemShape[] = gql.data?.addProductsToWishlist?.wishlist?.items_v2?.items ?? [];
      const addedItem = wishlistItems.find((item) => item.product?.sku === discoveredProductSku);
      logger.verify('Added item found in wishlist', discoveredProductSku, addedItem?.product?.sku);
      expect(addedItem, 'Added item must appear in wishlist response').toBeDefined();

      addedItemId = addedItem?.id ?? '';
      expect(addedItemId, 'addedItemId must be non-empty after add').toBeTruthy();

      softExpect(addedItem?.quantity, 'Wishlist item quantity should match requested value').toBe(graWishlistData.wishlistItemQuantity);
      softExpect(addedItem?.__typename, 'Wishlist item __typename should include WishlistItem').toContain('WishlistItem');
    });
  });

  // ── TC_03: add invalid SKU ────────────────────────────────────────────────

  test('TC_03 - addProductsToWishlist invalid SKU → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 addProductsToWishlist invalid SKU → error returned');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Attempt to add non-existent SKU to wishlist', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      response = await authClient.mutateWrapped(ADD_TO_WISHLIST_MUTATION, {
        wishlistId,
        items: [{ sku: graWishlistData.nonExistentSku, quantity: graWishlistData.wishlistItemQuantity }],
      });
    });

    await logger.step('Step 2 - Assert error is returned', async () => {
      const gql = await response.getGraphQLResponse();
      const rejected = wasRejected(gql, 'addProductsToWishlist');
      logger.verify('Invalid SKU causes rejection (top-level error or user_errors)', true, rejected);
      expect(rejected, 'Expected error when adding product with invalid SKU').toBe(true);
    });
  });

  // ── TC_04: add unauthenticated ────────────────────────────────────────────

  test('TC_04 - addProductsToWishlist unauthenticated → UNAUTHORIZED error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 addProductsToWishlist unauthenticated → UNAUTHORIZED');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Attempt to add product without auth token', async () => {
      const publicClient = await createGraphQLClient();
      response = await publicClient.mutateWrapped(ADD_TO_WISHLIST_MUTATION, {
        wishlistId,
        items: [{ sku: discoveredProductSku, quantity: graWishlistData.wishlistItemQuantity }],
      });
    });

    await logger.step('Step 2 - Assert graphql-authorization error', async () => {
      await response.assertHasErrors();
      const gql = await response.getGraphQLResponse();
      const errorCategory = gql.errors?.[0]?.extensions?.category;
      logger.verify('Authorization error category', graWishlistErrorCategories.unauthorized, errorCategory);
      expect(errorCategory).toBe(graWishlistErrorCategories.unauthorized);
    });
  });

  // ── TC_05: wishlists items_count and items after add ─────────────────────

  test('TC_05 - customer.wishlists → items_count > 0 and items returned after add', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 customer.wishlists → items_count > 0 after add');

    expect(addedItemId, 'addedItemId must be set by TC_02 — TC_05 depends on the add having succeeded').toBeTruthy();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query customer wishlists with auth token', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      response = await authClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);
    });

    let wishlists: WishlistShape[] = [];
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      wishlists = data.customer?.wishlists ?? [];
    });

    await logger.step('Step 3 - Assert items_count and items are populated', async () => {
      const items: WishlistItemShape[] = wishlists[0]?.items_v2?.items ?? [];

      logger.verify('Wishlist items_count after add', '> 0', wishlists[0]?.items_count);
      expect(wishlists[0]?.items_count, 'Expected items_count > 0 after add').toBeGreaterThan(0);
      expect(items.length, 'Expected at least one item in wishlist').toBeGreaterThan(0);

      const addedItem = items.find((item) => item.product?.sku === discoveredProductSku);
      expect(addedItem, 'Added product must still be in wishlist').toBeDefined();

      softExpect(wishlists[0]?.__typename, 'Wishlist __typename should be Wishlist').toBe('Wishlist');
      softExpect(addedItem?.product?.__typename, 'Product __typename should be defined').toBeDefined();
    });
  });

  // ── TC_06: remove existing item ───────────────────────────────────────────

  test('TC_06 - removeProductsFromWishlist existing item → item no longer in wishlist', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 removeProductsFromWishlist existing item → item removed');

    expect(addedItemId, 'addedItemId must be set by TC_02').toBeTruthy();

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Remove previously added item from wishlist', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      response = await authClient.mutateWrapped(REMOVE_FROM_WISHLIST_MUTATION, {
        wishlistId,
        wishlistItemsIds: [addedItemId],
      });
    });

    let gql!: GraphQLResponse;
    await logger.step('Step 2 - Assert no top-level errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      gql = await response.getGraphQLResponse();
      const userErrors: UserError[] = gql.data?.removeProductsFromWishlist?.user_errors ?? [];
      logger.verify('No user_errors when removing existing item', 0, userErrors.length);
      expect(userErrors, 'Expected no user_errors for valid item removal').toHaveLength(0);
    });

    await logger.step('Step 3 - Assert item is no longer in wishlist', async () => {
      const wishlistItems: WishlistItemShape[] = gql.data?.removeProductsFromWishlist?.wishlist?.items_v2?.items ?? [];
      const removedItem = wishlistItems.find((item) => item.id === addedItemId);
      logger.verify('Removed item no longer present in wishlist', undefined, removedItem?.id);
      expect(removedItem, 'Item must no longer appear in wishlist after removal').toBeUndefined();
    });
  });

  // ── TC_07: remove non-existent item ──────────────────────────────────────

  test('TC_07 - removeProductsFromWishlist non-existent item id → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 removeProductsFromWishlist non-existent item id → error');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Attempt to remove non-existent item from wishlist', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
      response = await authClient.mutateWrapped(REMOVE_FROM_WISHLIST_MUTATION, {
        wishlistId,
        wishlistItemsIds: [graWishlistData.nonExistentWishlistItemId],
      });
    });

    await logger.step('Step 2 - Assert error is returned', async () => {
      const gql = await response.getGraphQLResponse();
      const rejected = wasRejected(gql, 'removeProductsFromWishlist');
      logger.verify('Non-existent item ID causes rejection (top-level error or user_errors)', true, rejected);
      expect(rejected, 'Expected error when removing non-existent wishlist item').toBe(true);
    });
  });

  // ── TC_08: wishlists unauthenticated ──────────────────────────────────────

  test('TC_08 - customer.wishlists unauthenticated → UNAUTHORIZED error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_08 customer.wishlists unauthenticated → UNAUTHORIZED');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query customer wishlists without auth token', async () => {
      const publicClient = await createGraphQLClient();
      response = await publicClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);
    });

    await logger.step('Step 2 - Assert graphql-authorization error', async () => {
      await response.assertHasErrors();
      const gql = await response.getGraphQLResponse();
      const errorCategory = gql.errors?.[0]?.extensions?.category;
      logger.verify('Authorization error category', graWishlistErrorCategories.unauthorized, errorCategory);
      expect(errorCategory).toBe(graWishlistErrorCategories.unauthorized);
    });
  });

});
