export interface PromoCodeData {
  invalidCode: string;
  validCode: string;
  validCodeMinDiscountRatio: number;
  priceTolerance: number;
}

export const PromoCodes: PromoCodeData = {
  // Deliberately carries no word matching EcommerceCheckoutPage.promoCodeErrorTextPattern: the
  // rejection scan's context signal is normally satisfied by the storefront echoing this exact
  // code back into its rejection message (see scanForPromoCodeError()), so a code that itself
  // carried rejection vocabulary would make the rejection-vocabulary check vacuously true
  // against its own echoed value, defeating the guard that check exists to provide.
  invalidCode: 'QA-NOPE-99999',
  validCode: 'test',
  validCodeMinDiscountRatio: 0.1,
  priceTolerance: 0.02,
};
