import * as z from 'zod';

/**
 * Zod schema for GRA Authentication GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * Only SIGN_IN_MUTATION gets a schema. Every other operation in gra-authentication.spec.ts is
 * either an error-path test (revokeCustomerToken unauthenticated, resetPassword with an
 * invalid token/weak password, requestPasswordResetEmail for a non-existent/invalid-format
 * email) with no successful `data` to validate, or — for requestPasswordResetEmail's one
 * happy-path test (TC_04) — a bare boolean already asserted with `.toBe(true)`, which is a
 * stricter check than a one-field z.boolean() schema would add.
 */

export interface SignInData {
  generateCustomerToken: {
    token: string;
    __typename: string;
  };
}

export const SignInDataSchema: z.ZodType<SignInData> = z.looseObject({
  generateCustomerToken: z.looseObject({
    token: z.string(),
    __typename: z.string(),
  }),
});
