export interface PromoCodeData {
  invalidCode: string;
}

// Deliberately carries no word matching EcommerceCheckoutPage.promoCodeErrorTextPattern: the
// rejection scan's context signal is normally satisfied by the storefront echoing this exact
// code back into its rejection message (see scanForPromoCodeError()), so a code that itself
// carried rejection vocabulary would make the rejection-vocabulary check vacuously true against
// its own echoed value, defeating the guard that check exists to provide.
export const PromoCodes: PromoCodeData = {
  invalidCode: 'QA-NOPE-99999',
};
