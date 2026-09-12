import { BraintreeTestCardGenerator, type BraintreeTestCard } from '../api/gra-braintree-payment-data';

export interface CreditCardCheckoutDataShape {
  generateGuestCard: () => BraintreeTestCard;
}

// Thin ecommerce-domain wrapper over the shared Braintree sandbox card generator so ecommerce
// specs don't reach directly into api-domain test data. Never introduces a second literal PAN.
export const CreditCardCheckoutData: CreditCardCheckoutDataShape = {
  generateGuestCard: () => BraintreeTestCardGenerator.generateSandboxVisa(),
};
