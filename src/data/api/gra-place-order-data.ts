export interface PlaceOrderDataShape {
  productSearchTerms: string[];
  orderNumberPattern: RegExp;
  simplePaymentCodes: string[];
}

export const PlaceOrderData: Readonly<PlaceOrderDataShape> = {
  productSearchTerms: ['', 'shoe', 'sneaker', 'a', 'boot'],
  orderNumberPattern: /^\S+$/,
  simplePaymentCodes: ['checkmo', 'afterpay', 'free', 'cashondelivery'],
};

export class PlaceOrderTestDataGenerator {
  /** Unique guest email per call — guest carts need an email before placeOrder validation runs */
  static generateGuestEmail(): string {
    return `guest${Date.now()}${Math.random().toString(36).slice(2, 8)}@mail.com`;
  }
}
