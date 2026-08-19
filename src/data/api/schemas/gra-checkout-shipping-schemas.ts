import * as z from 'zod';
import { Money, MoneySchema } from './gra-common-schemas';

/**
 * Zod schemas for GRA Checkout Shipping GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * TC_03 (invalid customer_address_id) and TC_04 (empty firstname) are validation error-path
 * tests for setShippingAddressesOnCart; TC_07 is the same for setShippingMethodsOnCart. None
 * have a successful `data` shape to validate — not schema'd here, per Mechanical rule B.
 *
 * `available_shipping_methods` (array) and its `amount`/`carrier_title`/`method_title` fields:
 * confirmed populated (non-null) on all three methods pla-au AU addresses returned live
 * (2026-08-19) — carrier_code `instore`/method `pickup`, carrier_code `flatrate`/method
 * `flatrate`, and carrier_code `codecarrierau`/method `nddau`. The pickup carrier was the
 * natural candidate for a null title/amount and it wasn't.
 *
 * `selected_shipping_method` non-nullable fields: confirmed populated for both the flatrate
 * method (probe, pla-au) and the instore/pickup carrier — the natural null candidate — via
 * TC_05 on van-nz (`carrier_code: "instore"`, `method_code: "pickup"`), which asserts this
 * schema and passed. The "every `shipping_addresses` element" part of the claim remains
 * untested for N>1 addresses: `shipping_addresses.length` was 1 in every observed response,
 * since this spec's own checkout flow never produces more than one shipping address per cart.
 */

export interface CartAddressRegionLabel {
  // Nullable per Rule 05: confirmed null on pla-au TC_02 (customer_address_id path) for a
  // freshly created address whose region_code ('NSW') resolves fine on the inline-address
  // path (TC_01) but not when re-fetched through a saved customer_address_id.
  label: string | null;
  __typename: string;
}

export interface CartAddressCountryLabel {
  label: string;
  __typename: string;
}

export interface AvailableShippingMethod {
  carrier_code: string;
  method_code: string;
  carrier_title: string;
  method_title: string;
  available: boolean;
  amount: Money;
  __typename: string;
}

export interface CartShippingAddress {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: CartAddressRegionLabel;
  postcode: string;
  country: CartAddressCountryLabel;
  telephone: string;
  available_shipping_methods: AvailableShippingMethod[];
  __typename: string;
}

export interface SetShippingAddressesData {
  setShippingAddressesOnCart: {
    cart: {
      shipping_addresses: CartShippingAddress[];
      __typename: string;
    };
    __typename: string;
  };
}

const AvailableShippingMethodSchema: z.ZodType<AvailableShippingMethod> = z.looseObject({
  carrier_code: z.string(),
  method_code: z.string(),
  carrier_title: z.string(),
  method_title: z.string(),
  available: z.boolean(),
  amount: MoneySchema,
  __typename: z.string(),
});

export const SetShippingAddressesDataSchema: z.ZodType<SetShippingAddressesData> = z.looseObject({
  setShippingAddressesOnCart: z.looseObject({
    cart: z.looseObject({
      shipping_addresses: z.array(z.looseObject({
        firstname: z.string(),
        lastname: z.string(),
        street: z.array(z.string()),
        city: z.string(),
        region: z.looseObject({
          label: z.string().nullable(),
          __typename: z.string(),
        }),
        postcode: z.string(),
        country: z.looseObject({
          label: z.string(),
          __typename: z.string(),
        }),
        telephone: z.string(),
        available_shipping_methods: z.array(AvailableShippingMethodSchema),
        __typename: z.string(),
      })),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});

export interface SelectedShippingMethod {
  carrier_code: string;
  method_code: string;
  carrier_title: string;
  method_title: string;
  amount: Money;
  __typename: string;
}

export interface AvailableShippingMethodLite {
  carrier_code: string;
  method_code: string;
  available: boolean;
  __typename: string;
}

export interface ShippingMethodsCartAddress {
  selected_shipping_method: SelectedShippingMethod;
  available_shipping_methods: AvailableShippingMethodLite[];
  __typename: string;
}

export interface SetShippingMethodsData {
  setShippingMethodsOnCart: {
    cart: {
      shipping_addresses: ShippingMethodsCartAddress[];
      __typename: string;
    };
    __typename: string;
  };
}

export const SetShippingMethodsDataSchema: z.ZodType<SetShippingMethodsData> = z.looseObject({
  setShippingMethodsOnCart: z.looseObject({
    cart: z.looseObject({
      shipping_addresses: z.array(z.looseObject({
        selected_shipping_method: z.looseObject({
          carrier_code: z.string(),
          method_code: z.string(),
          carrier_title: z.string(),
          method_title: z.string(),
          amount: MoneySchema,
          __typename: z.string(),
        }),
        available_shipping_methods: z.array(z.looseObject({
          carrier_code: z.string(),
          method_code: z.string(),
          available: z.boolean(),
          __typename: z.string(),
        })),
        __typename: z.string(),
      })),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});
