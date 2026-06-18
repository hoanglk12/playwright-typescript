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

export function createCheckoutBillingPaymentData(countryCode: string): CheckoutBillingPaymentDataShape {
  const isNZ = countryCode === 'NZ';
  return {
    shippingInlineAddress: {
      firstname: 'Test',
      lastname: 'Automation',
      street: ['123 Test Street'],
      city: isNZ ? 'AUCKLAND' : 'SYDNEY',
      region: isNZ ? 'Auckland' : 'NSW',
      postcode: isNZ ? '1010' : '2000',
      country_code: countryCode,
      telephone: isNZ ? '0212345678' : '0412345678',
    },
    billingInlineAddress: {
      firstname: 'Billing',
      lastname: 'Test',
      street: ['456 Billing Avenue'],
      city: isNZ ? 'WELLINGTON' : 'MELBOURNE',
      region: isNZ ? 'Wellington' : 'VIC',
      postcode: isNZ ? '6011' : '3000',
      country_code: countryCode,
      telephone: isNZ ? '0498765432' : '0498765432',
    },
    invalidPaymentCode: 'invalid_payment_99999',
  };
}

// Default AU instance — kept for any imports that haven't migrated to site-aware factory
export const CheckoutBillingPaymentData: CheckoutBillingPaymentDataShape = createCheckoutBillingPaymentData('AU');
