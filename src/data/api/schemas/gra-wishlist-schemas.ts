import * as z from 'zod';
import { UserErrorShape, UserErrorSchema } from './gra-common-schemas';

/**
 * Zod schemas for GRA Wishlist GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * TC_03 (invalid SKU) and TC_04/TC_08 (unauthenticated) are error-path tests with no
 * successful `data` shape to validate — not schema'd here, per Mechanical rule B.
 *
 * ADD_TO_WISHLIST_MUTATION and GET_CUSTOMER_WISHLISTS_QUERY select the same item shape
 * (id, product{sku,name,__typename}, quantity, __typename); REMOVE_FROM_WISHLIST_MUTATION
 * selects a lighter shape (no quantity, no product.name) — kept as a distinct type rather
 * than widened, matching the actual wire shape per query.
 *
 * WishlistItem.product / WishlistItemLite.product / Wishlist.items_v2 non-nullable markings:
 * gra-wishlist.spec.ts itself already asserts this — TC_02/TC_05 do
 * `items.find(item => item.product?.sku === discoveredProductSku)` and hard `expect(addedItem,
 * ...).toBeDefined()` against the real `items_v2.items` array on every brand this spec runs
 * (no skip), so `items_v2` and each item's `product` are confirmed populated on the payloads
 * this suite actually exercises.
 */

export interface WishlistItemProduct {
  sku: string;
  name: string;
  __typename: string;
}

export interface WishlistItem {
  id: string;
  product: WishlistItemProduct;
  quantity: number;
  __typename: string;
}

export interface Wishlist {
  id: string;
  items_count: number;
  items_v2: {
    items: WishlistItem[];
  };
  __typename: string;
}

const WishlistItemSchema: z.ZodType<WishlistItem> = z.looseObject({
  id: z.string(),
  product: z.looseObject({
    sku: z.string(),
    name: z.string(),
    __typename: z.string(),
  }),
  quantity: z.number(),
  __typename: z.string(),
});

const WishlistSchema: z.ZodType<Wishlist> = z.looseObject({
  id: z.string(),
  items_count: z.number(),
  items_v2: z.looseObject({
    items: z.array(WishlistItemSchema),
  }),
  __typename: z.string(),
});

export interface GetCustomerWishlistsData {
  customer: {
    wishlists: Wishlist[];
  };
}

export const GetCustomerWishlistsDataSchema: z.ZodType<GetCustomerWishlistsData> = z.looseObject({
  customer: z.looseObject({
    wishlists: z.array(WishlistSchema),
  }),
});

export interface AddProductsToWishlistData {
  addProductsToWishlist: {
    wishlist: Wishlist;
    user_errors: UserErrorShape[];
  };
}

export const AddProductsToWishlistDataSchema: z.ZodType<AddProductsToWishlistData> = z.looseObject({
  addProductsToWishlist: z.looseObject({
    wishlist: WishlistSchema,
    user_errors: z.array(UserErrorSchema),
  }),
});

export interface WishlistItemLiteProduct {
  sku: string;
  __typename: string;
}

export interface WishlistItemLite {
  id: string;
  product: WishlistItemLiteProduct;
  __typename: string;
}

export interface WishlistLite {
  id: string;
  items_count: number;
  items_v2: {
    items: WishlistItemLite[];
  };
  __typename: string;
}

const WishlistItemLiteSchema: z.ZodType<WishlistItemLite> = z.looseObject({
  id: z.string(),
  product: z.looseObject({
    sku: z.string(),
    __typename: z.string(),
  }),
  __typename: z.string(),
});

const WishlistLiteSchema: z.ZodType<WishlistLite> = z.looseObject({
  id: z.string(),
  items_count: z.number(),
  items_v2: z.looseObject({
    items: z.array(WishlistItemLiteSchema),
  }),
  __typename: z.string(),
});

export interface RemoveProductsFromWishlistData {
  removeProductsFromWishlist: {
    wishlist: WishlistLite;
    user_errors: UserErrorShape[];
  };
}

export const RemoveProductsFromWishlistDataSchema: z.ZodType<RemoveProductsFromWishlistData> = z.looseObject({
  removeProductsFromWishlist: z.looseObject({
    wishlist: WishlistLiteSchema,
    user_errors: z.array(UserErrorSchema),
  }),
});
