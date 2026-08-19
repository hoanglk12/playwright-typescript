import * as z from 'zod';

/**
 * Zod schema for GRA Customer Profile GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * Only changeCustomerPassword gets a schema: TC_02-TC_09 in gra-customer-profile.spec.ts are
 * all error-path tests (wrong password, staging password-policy block, duplicate email) with
 * no successful `data` shape to validate — assertDataSchema() has no legal anchor there per
 * Mechanical rule B (must follow an error-tolerance check that actually passes).
 */

export interface ChangeCustomerPasswordData {
  changeCustomerPassword: {
    id: number;
    email: string;
    __typename: string;
  };
}

export const ChangeCustomerPasswordDataSchema: z.ZodType<ChangeCustomerPasswordData> = z.looseObject({
  changeCustomerPassword: z.looseObject({
    id: z.number(),
    email: z.string(),
    __typename: z.string(),
  }),
});
