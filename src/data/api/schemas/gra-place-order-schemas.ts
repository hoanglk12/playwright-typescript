import * as z from 'zod';

/**
 * Zod schema for GRA Place Order GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * Only TC_01 (happy path) gets a schema. TC_02 (missing shipping address) and TC_03 (missing
 * payment method) are error-path tests with no successful `data` shape to validate — not
 * schema'd here, per Mechanical rule B.
 */

export interface PlaceOrderResultData {
  placeOrder: {
    order: {
      order_number: string;
      __typename: string;
    };
    __typename: string;
  };
}

export const PlaceOrderResultDataSchema: z.ZodType<PlaceOrderResultData> = z.looseObject({
  placeOrder: z.looseObject({
    order: z.looseObject({
      order_number: z.string(),
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
});
