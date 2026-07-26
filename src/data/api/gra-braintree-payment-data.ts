export interface BraintreeTestCard {
  number: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
}

export interface BraintreePaymentDataShape {
  // Empirically verified against the sandbox Braintree GraphQL API during technical research
  // (2026-07). Only this number is included — other published Braintree sandbox test numbers
  // (decline/expired variants) were not independently re-verified against this integration.
  sandboxVisa: BraintreeTestCard;
}

export const BraintreePaymentData: Readonly<BraintreePaymentDataShape> = {
  sandboxVisa: {
    number: '4111111111111111',
    expirationMonth: '12',
    expirationYear: '2028',
    cvv: '123',
  },
};
