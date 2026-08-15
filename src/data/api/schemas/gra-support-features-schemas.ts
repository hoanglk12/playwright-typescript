import * as z from 'zod';

/**
 * Zod schemas for GRA Support Features GraphQL responses (`data` field).
 * - z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 * - __typename stays z.string() (never z.literal), categorically, per Rule 06 in
 *   tests/api/CLAUDE.md.
 */

export interface CurrencyData {
  default_display_currency_code: string;
  available_currency_codes: string[];
  __typename: string;
}

export interface CurrencyQueryData {
  currency: CurrencyData;
}

export const CurrencyQueryDataSchema: z.ZodType<CurrencyQueryData> = z.looseObject({
  currency: z.looseObject({
    default_display_currency_code: z.string(),
    available_currency_codes: z.array(z.string()),
    __typename: z.string(),
  }),
});

export interface DynamicPromoBlockItem {
  phrase: string;
  __typename: string;
}

export interface DynamicPromoBlockMessage {
  progress_percent: number;
  phrase: string;
  success_phrase: string | null;
  __typename: string;
}

export interface DynamicPromoBlocks {
  discount: DynamicPromoBlockItem | null;
  gift: DynamicPromoBlockItem | null;
  message: DynamicPromoBlockMessage;
  __typename: string;
}

export interface DynamicDataCart {
  dynamic_promo_blocks: DynamicPromoBlocks;
  __typename: string;
}

export interface DynamicDataStoreConfig {
  id: number;
  store_code: string;
  ewave_dynamicpromoblocks_general_enable: boolean;
  ewave_dynamicpromoblocks_discount_enable: boolean;
  ewave_dynamicpromoblocks_gift_enable: boolean;
  ewave_dynamicpromoblocks_message_enable: boolean;
  __typename: string;
}

export interface DynamicDataQueryData {
  cart: DynamicDataCart;
  storeConfig: DynamicDataStoreConfig;
}

const DynamicPromoBlockItemSchema: z.ZodType<DynamicPromoBlockItem> = z.looseObject({
  phrase: z.string(),
  __typename: z.string(),
});

const DynamicPromoBlockMessageSchema: z.ZodType<DynamicPromoBlockMessage> = z.looseObject({
  progress_percent: z.number(),
  phrase: z.string(),
  // Confirmed null on all 8 brands per the approved research report. dynamic_promo_blocks is
  // queried only in this spec, so that finding applies here directly, not by inference.
  success_phrase: z.string().nullable(),
  __typename: z.string(),
});

export const DynamicDataQueryDataSchema: z.ZodType<DynamicDataQueryData> = z.looseObject({
  cart: z.looseObject({
    dynamic_promo_blocks: z.looseObject({
      // Staging returns both null on this cart — gra-support-features.spec.ts asserts
      // exactly that with toBeNull().
      discount: DynamicPromoBlockItemSchema.nullable(),
      gift: DynamicPromoBlockItemSchema.nullable(),
      message: DynamicPromoBlockMessageSchema,
      __typename: z.string(),
    }),
    __typename: z.string(),
  }),
  storeConfig: z.looseObject({
    id: z.number(),
    store_code: z.string(),
    // The schema's real teeth: these four are confirmed boolean on every endpoint per the
    // approved research report, so they stay required z.boolean() rather than optional.
    ewave_dynamicpromoblocks_general_enable: z.boolean(),
    ewave_dynamicpromoblocks_discount_enable: z.boolean(),
    ewave_dynamicpromoblocks_gift_enable: z.boolean(),
    ewave_dynamicpromoblocks_message_enable: z.boolean(),
    __typename: z.string(),
  }),
});
