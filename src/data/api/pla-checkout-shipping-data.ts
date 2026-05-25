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

export interface CreateAddressInput {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: { region_code: string };
  postcode: string;
  country_code: string;
  telephone: string;
  default_shipping: boolean;
  default_billing: boolean;
}

export interface CheckoutShippingDataShape {
  inlineAddress: CartInlineAddress;
  createAddressInput: CreateAddressInput;
  invalidCustomerAddressId: number;
  invalidCarrierCode: string;
  invalidMethodCode: string;
  invalidCartId: string;
}

export const CheckoutShippingData: CheckoutShippingDataShape = {
  inlineAddress: {
    firstname: 'Test',
    lastname: 'Automation',
    street: ['123 Test Street'],
    city: 'SYDNEY',
    region: 'NSW',
    postcode: '2000',
    country_code: 'AU',
    telephone: '0412345678',
  },
  createAddressInput: {
    firstname: 'Test',
    lastname: 'Automation',
    street: ['123 Test Street'],
    city: 'SYDNEY',
    region: { region_code: 'NSW' },
    postcode: '2000',
    country_code: 'AU',
    telephone: '0412345678',
    default_shipping: true,
    default_billing: true,
  },
  invalidCustomerAddressId: 99999999,
  invalidCarrierCode: 'invalid_carrier_99999',
  invalidMethodCode: 'invalid_method_99999',
  invalidCartId: 'wbkTBuu2dxhmC6AVHT0YzUBIoOEs5M67ss',
};
