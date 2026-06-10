export interface PlaceOrderDataShape {
  productSearchTerms: string[];
  orderNumberPattern: RegExp;
}

export const PlaceOrderData: Readonly<PlaceOrderDataShape> = {
  productSearchTerms: ['', 'shoe', 'sneaker', 'a', 'boot'],
  orderNumberPattern: /^\S+$/,
};
