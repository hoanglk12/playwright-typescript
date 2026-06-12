/**
 * PLA (Platypus Shoes) GraphQL API — Cart Operations Test Data
 * Used by pla-cart_minicart_operations.spec.ts
 */

export interface CartOperationsDataShape {
  invalidSku: string;
  invalidCartId: string;
  invalidCartItemId: number;
  invalidCouponCode: string;
  initialQuantity: number;
  increasedQuantity: number;
  decreasedQuantity: number;
}

export interface CartOperationsErrorMessagesShape {
  productNotFound: string;
  cartNotFound: string;
  invalidCartItem: string;
  couponNotFound: string;
  unauthorized: string;
}

export const CartOperationsData: CartOperationsDataShape = {
  invalidSku: 'INVALID-SKU-TESTONLY-99999',
  invalidCartId: 'wbkTBuu2dxhmC6AVHT0YzUBIoOEs5M67ss',
  invalidCartItemId: 99999999,
  invalidCouponCode: 'INVALID_COUPON_NOTEXIST_2026',
  initialQuantity: 1,
  increasedQuantity: 3,
  decreasedQuantity: 2,
};

export const CartOperationsErrorMessages: CartOperationsErrorMessagesShape = {
  productNotFound: 'Could not find a product',
  cartNotFound: 'Could not find a cart',
  invalidCartItem: 'Could not find cart item with id',
  couponNotFound: "The coupon code isn't valid",
  unauthorized: "The current customer isn't authorized",
};
