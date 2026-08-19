import * as z from 'zod';

/**
 * Shared GraphQL sub-shapes reused across GRA Phase 2 schemas.
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 */

export interface Money {
  value: number;
  currency: string;
  __typename: string;
}

export const MoneySchema: z.ZodType<Money> = z.looseObject({
  value: z.number(),
  currency: z.string(),
  __typename: z.string(),
});

// Matches both selection sets seen in GRA specs: `{ code message __typename }`
// (gra-graphql-operations ADD_PRODUCTS_MUTATION) and `{ code message }` (gra-wishlist
// add/remove mutations) — looseObject tolerates the extra field either way.
export interface UserErrorShape {
  code: string;
  message: string;
}

export const UserErrorSchema: z.ZodType<UserErrorShape> = z.looseObject({
  code: z.string(),
  message: z.string(),
});
