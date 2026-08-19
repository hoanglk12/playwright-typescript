import * as z from 'zod';

/**
 * Zod schemas for GRA Checkout Billing & Payment GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * TC_05 (invalid payment code) is an error-path test with no successful `data` shape to
 * validate — not schema'd here, per Mechanical rule B.
 */

export interface CartAddressRegion {
  code: string;
  label: string;
  __typename: string;
}

export interface CartAddressCountry {
  code: string;
  label: string;
  __typename: string;
}

export interface CartBillingAddress {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: CartAddressRegion;
  postcode: string;
  country: CartAddressCountry;
  telephone: string;
  __typename: string;
}

export interface SetBillingAddressData {
  setBillingAddressOnCart: {
    cart: {
      billing_address: CartBillingAddress;
      __typename: string;
    };
    __typename: string;
  };
}

export const SetBillingAddressDataSchema: z.ZodType<SetBillingAddressData> = z.looseObject({
  setBillingAddressOnCart: z.looseObject({
    cart: z.looseObject({
      billing_address: z.looseObject({
        firstname: z.string(),
        lastname: z.string(),
        street: z.array(z.string()),
        city: z.string(),
        region: z.looseObject({
          code: z.string(),
          label: z.string(),
          __typename: z.string(),
        }),
        postcode: z.string(),
        country: z.looseObject({
          code: z.string(),
          label: z.string(),
          __typename: z.string(),
        }),
        telephone: z.string(),
        __typename: z.string(),
      }),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});

export interface SelectedPaymentMethod {
  code: string;
  title: string;
  __typename: string;
}

export interface SetPaymentMethodData {
  setPaymentMethodOnCart: {
    cart: {
      selected_payment_method: SelectedPaymentMethod;
      __typename: string;
    };
    __typename: string;
  };
}

export const SetPaymentMethodDataSchema: z.ZodType<SetPaymentMethodData> = z.looseObject({
  setPaymentMethodOnCart: z.looseObject({
    cart: z.looseObject({
      selected_payment_method: z.looseObject({
        code: z.string(),
        title: z.string(),
        __typename: z.string(),
      }),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});
