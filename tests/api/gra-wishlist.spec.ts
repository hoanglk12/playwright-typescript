import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import {
  plaWishlistData,
  plaWishlistErrorCategories,
  UserError,
  DiscoveredProduct,
  WishlistItemShape,
  WishlistShape,
} from '../../src/data/api/pla-wishlist-data';
import { signInAndStoreToken } from './api-test-helpers';

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

test.describe('PLA GraphQL API - Wishlist @api @regression', () => {

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA Wishlist - Setup');

    // ── 1. Fresh auth ──────────────────────────────────────────────────────────
    const publicClient = await createGraphQLClient();
    customerToken = await signInAndStoreToken(publicClient, logger, site, siteState);

    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });

    // ── 2. Discover a SimpleProduct SKU ───────────────────────────────────────
    logger.step('Discover a SimpleProduct SKU for wishlist tests');
    const discoverResponse = await publicClient.queryWrapped(DISCOVER_PRODUCTS_QUERY, {
      search: plaWishlistData.productSearchTerm,
      pageSize: 20,
    });
    const discoverGql = await discoverResponse.getGraphQLResponse();
    const allItems: DiscoveredProduct[] = discoverGql.data?.products?.items ?? [];
    if (allItems.length === 0) {
      throw new Error(`No products found for search term "${plaWishlistData.productSearchTerm}"`);
    }
    // Prefer SimpleProduct; fall back to first item — Magento 2 accepts configurable SKUs in wishlist
    const pickedProduct = allItems.find((item) => item.__typename === 'SimpleProduct') ?? allItems[0];
    discoveredProductSku = pickedProduct.sku;
    logger.action(`Discovered product (${pickedProduct.__typename})`, discoveredProductSku);

    // ── 3. Get wishlist ID ────────────────────────────────────────────────────
    logger.step('Get customer wishlist ID');
    const wishlistResponse = await authClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);
    const wishlistGql = await wishlistResponse.getGraphQLResponse();
    if (wishlistGql.errors?.length) {
      throw new Error(`Failed to get wishlists: ${wishlistGql.errors[0]?.message ?? 'unknown error'}`);
    }
    const wishlists: WishlistShape[] = wishlistGql.data?.customer?.wishlists ?? [];
    if (wishlists.length === 0) throw new Error('Customer has no wishlists');
    wishlistId = wishlists[0].id;
    logger.action('Wishlist ID', wishlistId);

    // ── 4. Clean up existing items ────────────────────────────────────────────
    const existingItems: WishlistItemShape[] = wishlists[0].items_v2.items;
    if (existingItems.length > 0) {
      logger.step(`Cleanup: removing ${existingItems.length} existing item(s)`);
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
    } else {
      logger.action('Cleanup skipped', 'wishlist already empty');
    }
  });

  // ── TC_01: empty wishlist after cleanup ────────────────────────────────────

  test('TC_01 - customer.wishlists → items array is empty after cleanup', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 customer.wishlists → empty after cleanup');

    logger.step('Step 1 - Query customer wishlists with auth token');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);

    logger.step('Step 2 - Assert no errors');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const wishlists: WishlistShape[] = data.customer?.wishlists ?? [];
    const items: WishlistItemShape[] = wishlists[0]?.items_v2?.items ?? [];

    logger.step('Step 3 - Assert items array is empty');
    logger.verify('Wishlist items count after cleanup', 0, items.length);
    expect(wishlists.length, 'Expected at least one wishlist').toBeGreaterThan(0);
    expect(items, 'Wishlist items must be empty after cleanup').toHaveLength(0);
    softExpect(wishlists[0]?.items_count, 'items_count should be 0 after cleanup').toBe(0);
  });

  // ── TC_02: add valid product ───────────────────────────────────────────────

  test('TC_02 - addProductsToWishlist valid product → item appears in wishlist', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 addProductsToWishlist valid product → item appears');

    logger.step('Step 1 - Add product to wishlist');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(ADD_TO_WISHLIST_MUTATION, {
      wishlistId,
      items: [{ sku: discoveredProductSku, quantity: plaWishlistData.wishlistItemQuantity }],
    });

    logger.step('Step 2 - Assert no top-level errors');
    await response.assertNoErrors();
    await response.assertHasData();

    const gql = await response.getGraphQLResponse();
    const userErrors: UserError[] = gql.data?.addProductsToWishlist?.user_errors ?? [];
    logger.verify('No user_errors when adding valid product', 0, userErrors.length);
    expect(userErrors, 'Expected no user_errors for valid product add').toHaveLength(0);

    logger.step('Step 3 - Assert item appears in wishlist');
    const wishlistItems: WishlistItemShape[] = gql.data?.addProductsToWishlist?.wishlist?.items_v2?.items ?? [];
    const addedItem = wishlistItems.find((item) => item.product?.sku === discoveredProductSku);
    logger.verify('Added item found in wishlist', discoveredProductSku, addedItem?.product?.sku);
    expect(addedItem, 'Added item must appear in wishlist response').toBeDefined();

    addedItemId = addedItem?.id ?? '';
    expect(addedItemId, 'addedItemId must be non-empty after add').toBeTruthy();

    softExpect(addedItem?.quantity, 'Wishlist item quantity should match requested value').toBe(plaWishlistData.wishlistItemQuantity);
    softExpect(addedItem?.__typename, 'Wishlist item __typename should include WishlistItem').toContain('WishlistItem');
  });

  // ── TC_03: add invalid SKU ────────────────────────────────────────────────

  test('TC_03 - addProductsToWishlist invalid SKU → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 addProductsToWishlist invalid SKU → error returned');

    logger.step('Step 1 - Attempt to add non-existent SKU to wishlist');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(ADD_TO_WISHLIST_MUTATION, {
      wishlistId,
      items: [{ sku: plaWishlistData.nonExistentSku, quantity: plaWishlistData.wishlistItemQuantity }],
    });

    logger.step('Step 2 - Assert error is returned');
    const gql = await response.getGraphQLResponse();
    const rejected = wasRejected(gql, 'addProductsToWishlist');
    logger.verify('Invalid SKU causes rejection (top-level error or user_errors)', true, rejected);
    expect(rejected, 'Expected error when adding product with invalid SKU').toBe(true);
  });

  // ── TC_04: add unauthenticated ────────────────────────────────────────────

  test('TC_04 - addProductsToWishlist unauthenticated → UNAUTHORIZED error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 addProductsToWishlist unauthenticated → UNAUTHORIZED');

    logger.step('Step 1 - Attempt to add product without auth token');
    const publicClient = await createGraphQLClient();
    const response = await publicClient.mutateWrapped(ADD_TO_WISHLIST_MUTATION, {
      wishlistId,
      items: [{ sku: discoveredProductSku, quantity: plaWishlistData.wishlistItemQuantity }],
    });

    logger.step('Step 2 - Assert graphql-authorization error');
    await response.assertHasErrors();
    const gql = await response.getGraphQLResponse();
    const errorCategory = gql.errors?.[0]?.extensions?.category;
    logger.verify('Authorization error category', plaWishlistErrorCategories.unauthorized, errorCategory);
    expect(errorCategory).toBe(plaWishlistErrorCategories.unauthorized);
  });

  // ── TC_05: wishlists items_count and items after add ─────────────────────

  test('TC_05 - customer.wishlists → items_count > 0 and items returned after add', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 customer.wishlists → items_count > 0 after add');

    expect(addedItemId, 'addedItemId must be set by TC_02 — TC_05 depends on the add having succeeded').toBeTruthy();

    logger.step('Step 1 - Query customer wishlists with auth token');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);

    logger.step('Step 2 - Assert no errors');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const wishlists: WishlistShape[] = data.customer?.wishlists ?? [];
    const items: WishlistItemShape[] = wishlists[0]?.items_v2?.items ?? [];

    logger.step('Step 3 - Assert items_count and items are populated');
    logger.verify('Wishlist items_count after add', '> 0', wishlists[0]?.items_count);
    expect(wishlists[0]?.items_count, 'Expected items_count > 0 after add').toBeGreaterThan(0);
    expect(items.length, 'Expected at least one item in wishlist').toBeGreaterThan(0);

    const addedItem = items.find((item) => item.product?.sku === discoveredProductSku);
    expect(addedItem, 'Added product must still be in wishlist').toBeDefined();

    softExpect(wishlists[0]?.__typename, 'Wishlist __typename should be Wishlist').toBe('Wishlist');
    softExpect(addedItem?.product?.__typename, 'Product __typename should be defined').toBeDefined();
  });

  // ── TC_06: remove existing item ───────────────────────────────────────────

  test('TC_06 - removeProductsFromWishlist existing item → item no longer in wishlist', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 removeProductsFromWishlist existing item → item removed');

    expect(addedItemId, 'addedItemId must be set by TC_02').toBeTruthy();

    logger.step('Step 1 - Remove previously added item from wishlist');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(REMOVE_FROM_WISHLIST_MUTATION, {
      wishlistId,
      wishlistItemsIds: [addedItemId],
    });

    logger.step('Step 2 - Assert no top-level errors');
    await response.assertNoErrors();
    await response.assertHasData();

    const gql = await response.getGraphQLResponse();
    const userErrors: UserError[] = gql.data?.removeProductsFromWishlist?.user_errors ?? [];
    logger.verify('No user_errors when removing existing item', 0, userErrors.length);
    expect(userErrors, 'Expected no user_errors for valid item removal').toHaveLength(0);

    logger.step('Step 3 - Assert item is no longer in wishlist');
    const wishlistItems: WishlistItemShape[] = gql.data?.removeProductsFromWishlist?.wishlist?.items_v2?.items ?? [];
    const removedItem = wishlistItems.find((item) => item.id === addedItemId);
    logger.verify('Removed item no longer present in wishlist', undefined, removedItem?.id);
    expect(removedItem, 'Item must no longer appear in wishlist after removal').toBeUndefined();
  });

  // ── TC_07: remove non-existent item ──────────────────────────────────────

  test('TC_07 - removeProductsFromWishlist non-existent item id → error returned', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 removeProductsFromWishlist non-existent item id → error');

    logger.step('Step 1 - Attempt to remove non-existent item from wishlist');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(REMOVE_FROM_WISHLIST_MUTATION, {
      wishlistId,
      wishlistItemsIds: [plaWishlistData.nonExistentWishlistItemId],
    });

    logger.step('Step 2 - Assert error is returned');
    const gql = await response.getGraphQLResponse();
    const rejected = wasRejected(gql, 'removeProductsFromWishlist');
    logger.verify('Non-existent item ID causes rejection (top-level error or user_errors)', true, rejected);
    expect(rejected, 'Expected error when removing non-existent wishlist item').toBe(true);
  });

  // ── TC_08: wishlists unauthenticated ──────────────────────────────────────

  test('TC_08 - customer.wishlists unauthenticated → UNAUTHORIZED error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_08 customer.wishlists unauthenticated → UNAUTHORIZED');

    logger.step('Step 1 - Query customer wishlists without auth token');
    const publicClient = await createGraphQLClient();
    const response = await publicClient.queryWrapped(GET_CUSTOMER_WISHLISTS_QUERY);

    logger.step('Step 2 - Assert graphql-authorization error');
    await response.assertHasErrors();
    const gql = await response.getGraphQLResponse();
    const errorCategory = gql.errors?.[0]?.extensions?.category;
    logger.verify('Authorization error category', plaWishlistErrorCategories.unauthorized, errorCategory);
    expect(errorCategory).toBe(plaWishlistErrorCategories.unauthorized);
  });

});
