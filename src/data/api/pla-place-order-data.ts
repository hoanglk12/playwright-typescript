export interface PlaceOrderDataShape {
  productSearchTerms: string[];
  orderNumberPattern: RegExp;
}

export const PlaceOrderData: Readonly<PlaceOrderDataShape> = {
  productSearchTerms: ['', 'shoe', 'nike', 'a', 'boot'],
  orderNumberPattern: /^\S+$/,
};
