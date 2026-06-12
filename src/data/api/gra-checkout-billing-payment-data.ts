export interface CartInlineAddress {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: string;
  postcode: string;
  country_code: string;
  telephone: string;
}

export interface CheckoutBillingPaymentDataShape {
  shippingInlineAddress: CartInlineAddress;
  billingInlineAddress: CartInlineAddress;
  invalidPaymentCode: string;
}

export const CheckoutBillingPaymentData: CheckoutBillingPaymentDataShape = {
  shippingInlineAddress: {
    firstname: 'Test',
    lastname: 'Automation',
    street: ['123 Test Street'],
    city: 'SYDNEY',
    region: 'NSW',
    postcode: '2000',
    country_code: 'AU',
    telephone: '0412345678',
  },
  billingInlineAddress: {
    firstname: 'Billing',
    lastname: 'Test',
    street: ['456 Billing Avenue'],
    city: 'MELBOURNE',
    region: 'VIC',
    postcode: '3000',
    country_code: 'AU',
    telephone: '0498765432',
  },
  invalidPaymentCode: 'invalid_payment_99999',
};
