import * as z from 'zod';

/**
 * Zod schemas for GRA My Details GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * DeleteCustomerAddress (returns a bare boolean) and the local LOYALTY_QUERY are deliberately
 * not schema'd here: deleteCustomerAddress is already asserted with `.toBe(true)`, which is a
 * stricter check than a one-field z.boolean() schema would add, and LOYALTY_QUERY's two message
 * fields are only ever asserted with `toBeDefined()` in the spec — there is no real-payload
 * evidence of their type to encode.
 *
 * middlename is confirmed null on staging (gra-my-details.spec.ts asserts
 * `targetAddress!.middlename` with `.toBeNull()`) — the only field in this file with direct
 * nullable evidence per Rule 05.
 *
 * AddressBookAddressSchema's non-nullable fields (`custom_attributes`, `region`, `street`,
 * `telephone`, `postcode`, `city`, `country_code`) are unprofiled beyond the address this spec
 * creates itself: each gra-*.spec.ts run signs in with a freshly timestamped account
 * (gra-test-data.ts), so `customer.addresses` genuinely has no pre-existing entries to inspect
 * — confirmed live against pla-au (2026-08-19), where a freshly authenticated account returned
 * `addresses: []` before this spec's own create-address test runs. The non-nullable markings
 * reflect only the one address this spec creates and later asserts against (custom_attributes
 * populated via `addNewCustomerAddressForAddressBook`'s own custom_attributes input) — they are
 * not evidence about how the API behaves for addresses created outside this spec's flow.
 */

// countries here duplicates Phase 1's CountrySchema shape rather than importing it — Phase 1's
// schema file is not exported for reuse, and re-declaring 3 fields locally keeps that commit
// independently revertable.
export interface AddressBookCountry {
  id: string;
  full_name_locale: string;
  __typename: string;
}

export interface CustomerAddressRegion {
  region: string;
  __typename: string;
}

export interface CustomerAddressAttribute {
  attribute_code: string;
  value: string;
  __typename: string;
}

export interface AddressBookAddress {
  id: number;
  city: string;
  // Confirmed null on staging for the address created by this spec's own test data — the
  // mutation input (gra-test-data.ts) sends `company: null` explicitly, so this is the ordinary
  // explicit-null-in/explicit-null-out case, the same pattern as `date_of_birth` in
  // gra-account-creation-signin-schemas.ts.
  company: string | null;
  country_code: string;
  default_billing: boolean;
  default_shipping: boolean;
  firstname: string;
  lastname: string;
  middlename: string | null;
  postcode: string;
  region: CustomerAddressRegion;
  custom_attributes: CustomerAddressAttribute[];
  street: string[];
  telephone: string;
  __typename: string;
}

export interface CreateCustomerAddressData {
  createCustomerAddress: {
    id: number;
    __typename: string;
  };
}

export const CreateCustomerAddressDataSchema: z.ZodType<CreateCustomerAddressData> = z.looseObject({
  createCustomerAddress: z.looseObject({
    id: z.number(),
    __typename: z.string(),
  }),
});

const AddressBookAddressSchema: z.ZodType<AddressBookAddress> = z.looseObject({
  id: z.number(),
  city: z.string(),
  company: z.string().nullable(),
  country_code: z.string(),
  default_billing: z.boolean(),
  default_shipping: z.boolean(),
  firstname: z.string(),
  lastname: z.string(),
  middlename: z.string().nullable(),
  postcode: z.string(),
  region: z.looseObject({
    region: z.string(),
    __typename: z.string(),
  }),
  custom_attributes: z.array(z.looseObject({
    attribute_code: z.string(),
    value: z.string(),
    __typename: z.string(),
  })),
  street: z.array(z.string()),
  telephone: z.string(),
  __typename: z.string(),
});

export interface GetCustomerAddressesForAddressBookData {
  customer: {
    id: number;
    addresses: AddressBookAddress[];
    __typename: string;
  };
  countries: AddressBookCountry[];
}

export const GetCustomerAddressesForAddressBookDataSchema: z.ZodType<GetCustomerAddressesForAddressBookData> = z.looseObject({
  customer: z.looseObject({
    id: z.number(),
    addresses: z.array(AddressBookAddressSchema),
    __typename: z.string(),
  }),
  countries: z.array(z.looseObject({
    id: z.string(),
    full_name_locale: z.string(),
    __typename: z.string(),
  })),
});

export interface UpdateCustomerAddressData {
  updateCustomerAddress: {
    id: number;
    default_billing: boolean;
    default_shipping: boolean;
    __typename: string;
  };
}

export const UpdateCustomerAddressDataSchema: z.ZodType<UpdateCustomerAddressData> = z.looseObject({
  updateCustomerAddress: z.looseObject({
    id: z.number(),
    default_billing: z.boolean(),
    default_shipping: z.boolean(),
    __typename: z.string(),
  }),
});

export interface SetNewsletterSubscriptionData {
  updateCustomerV2: {
    customer: {
      id: number;
      is_subscribed: boolean;
      __typename: string;
    };
    __typename: string;
  };
}

export const SetNewsletterSubscriptionDataSchema: z.ZodType<SetNewsletterSubscriptionData> = z.looseObject({
  updateCustomerV2: z.looseObject({
    customer: z.looseObject({
      id: z.number(),
      is_subscribed: z.boolean(),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});

export interface SetLoyaltyAndNewsletterSubscriptionData {
  updateCustomerV2: {
    customer: {
      id: number;
      is_subscribed: boolean;
      // Confirmed `false` (not null) on all 8 brands per the approved research report's
      // Rule 05 counter-example — never .nullable() on the strength of an ignore-list entry.
      loyalty_program_status: boolean;
      __typename: string;
    };
    __typename: string;
  };
}

export const SetLoyaltyAndNewsletterSubscriptionDataSchema: z.ZodType<SetLoyaltyAndNewsletterSubscriptionData> = z.looseObject({
  updateCustomerV2: z.looseObject({
    customer: z.looseObject({
      id: z.number(),
      is_subscribed: z.boolean(),
      loyalty_program_status: z.boolean(),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});
