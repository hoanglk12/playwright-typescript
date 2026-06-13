export interface UserError {
  code: string;
  message: string;
}

export interface DiscoveredProduct {
  sku: string;
  name: string;
  __typename: string;
}

export interface WishlistItemShape {
  id: string;
  product: {
    sku: string;
    name: string;
    __typename: string;
  };
  quantity: number;
  __typename: string;
}

export interface WishlistShape {
  id: string;
  items_count: number;
  items_v2: {
    items: WishlistItemShape[];
  };
  __typename: string;
}

export interface GraWishlistDataShape {
  nonExistentSku: string;
  nonExistentWishlistItemId: string;
  productSearchTerm: string;
  wishlistItemQuantity: number;
}

export interface GraWishlistErrorCategories {
  unauthorized: string;
}

export const graWishlistData: GraWishlistDataShape = {
  nonExistentSku: 'INVALID-SKU-WISHLIST-TEST-99999',
  nonExistentWishlistItemId: '99999999',
  productSearchTerm: 'shoe',
  wishlistItemQuantity: 1,
};

export const graWishlistErrorCategories: GraWishlistErrorCategories = {
  unauthorized: 'graphql-authorization',
};
