import * as z from 'zod';

/**
 * Zod schemas for GRA Account Creation & Sign-In GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * SignIn re-uses SignInDataSchema from gra-authentication-schemas.ts rather than
 * re-declaring it here — SIGN_IN_MUTATION is the same shared operation in both specs, and its
 * `data` shape is identical (generateCustomerToken{token,__typename}). The two error-path
 * tests (invalid email on create, wrong password on sign-in) are not schema'd — no successful
 * `data` shape to validate, and both specs explicitly assert `data.<field>` is null on that path.
 *
 * GetCustomerDetails carries the loyalty subtree — the highest Rule 05 hazard in Phase 2.
 * Nullability below is the approved research report's measured facts, applied verbatim, not
 * re-derived: `loyalty` nulls on non-loyalty brands (drm/van); on loyalty brands (pla/skx)
 * every loyalty sub-field is null except `rewards: []`; `apparel21_id` is null everywhere
 * except pla-nz/skx-nz; `qff_member_number` is null on AU and an empty string on NZ;
 * `loyalty_program_status` is `false` (never null) on all 8 brands — the Rule 05
 * counter-example, not a candidate for `.nullable()` despite sitting on the same
 * assertNoCriticalErrors ignore list as `loyalty`.
 *
 * `date_of_birth` is nullable because CREATE_ACCOUNT_MUTATION's own test input
 * (site.testData.validCustomer) sends `date_of_birth: null` — an explicit-null-in implies
 * explicit-null-out, the same pattern confirmed for address `company` in Phase 2's
 * gra-my-details schema. `level`, `program`, `points_balance`, `points_to_next_reward`,
 * `reward_account_id`, `rewards_balance`, `spend_value_to_next_reward`, and
 * `positive_rewards_balance_message` inside the loyalty subtree were confirmed null on a live
 * GET_CUSTOMER_DETAILS_QUERY against pla-au (2026-08-19, freshly created customer): every one
 * of those fields returned `null`, matching this file's guess above; only `rewards: []` and
 * `__typename` came back populated. The non-null branch of each field's type remains a best
 * guess — no payload has exercised it — but the `.nullable()` markings themselves are confirmed.
 */

export interface LoyaltyLevel {
  accrual_points: number;
  auto_reward_threshold: number;
  auto_reward_value: number;
  description: string;
  level_id: number;
  level_point_bonus: number;
  name: string;
  sequence: number;
  __typename: string;
}

export interface LoyaltyProgram {
  apply_reward_threshold: number;
  description: string;
  name: string;
  __typename: string;
}

export interface LoyaltyReward {
  available: boolean;
  customer_reward_id: string;
  expiry_date: string;
  pending: boolean;
  redeemed: boolean;
  status: string;
  total: number;
  __typename: string;
}

export interface Loyalty {
  level: LoyaltyLevel | null;
  points_balance: number | null;
  points_to_next_reward: number | null;
  program: LoyaltyProgram | null;
  rewards: LoyaltyReward[];
  reward_account_id: string | null;
  rewards_balance: number | null;
  spend_value_to_next_reward: number | null;
  positive_rewards_balance_message: string | null;
  __typename: string;
}

const LoyaltySchema: z.ZodType<Loyalty> = z.looseObject({
  level: z.looseObject({
    accrual_points: z.number(),
    auto_reward_threshold: z.number(),
    auto_reward_value: z.number(),
    description: z.string(),
    level_id: z.number(),
    level_point_bonus: z.number(),
    name: z.string(),
    sequence: z.number(),
    __typename: z.string(),
  }).nullable(),
  points_balance: z.number().nullable(),
  points_to_next_reward: z.number().nullable(),
  program: z.looseObject({
    apply_reward_threshold: z.number(),
    description: z.string(),
    name: z.string(),
    __typename: z.string(),
  }).nullable(),
  rewards: z.array(z.looseObject({
    available: z.boolean(),
    customer_reward_id: z.string(),
    expiry_date: z.string(),
    pending: z.boolean(),
    redeemed: z.boolean(),
    status: z.string(),
    total: z.number(),
    __typename: z.string(),
  })),
  reward_account_id: z.string().nullable(),
  rewards_balance: z.number().nullable(),
  spend_value_to_next_reward: z.number().nullable(),
  positive_rewards_balance_message: z.string().nullable(),
  __typename: z.string(),
});

export interface GetCustomerDetailsData {
  customer: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    phone_number: string;
    date_of_birth: string | null;
    is_subscribed: boolean;
    gender: number;
    apparel21_id: string | null;
    is_qff_member: boolean;
    qff_member_number: string | null;
    loyalty_program_status: boolean;
    loyalty: Loyalty | null;
    __typename: string;
  };
}

export const GetCustomerDetailsDataSchema: z.ZodType<GetCustomerDetailsData> = z.looseObject({
  customer: z.looseObject({
    id: z.number(),
    firstname: z.string(),
    lastname: z.string(),
    email: z.string(),
    phone_number: z.string(),
    date_of_birth: z.string().nullable(),
    is_subscribed: z.boolean(),
    gender: z.number(),
    apparel21_id: z.string().nullable(),
    is_qff_member: z.boolean(),
    qff_member_number: z.string().nullable(),
    loyalty_program_status: z.boolean(),
    loyalty: LoyaltySchema.nullable(),
    __typename: z.string(),
  }),
});

export interface CreateAccountData {
  createCustomer: {
    customer: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      __typename: string;
    };
  };
}

export const CreateAccountDataSchema: z.ZodType<CreateAccountData> = z.looseObject({
  createCustomer: z.looseObject({
    customer: z.looseObject({
      id: z.number(),
      firstname: z.string(),
      lastname: z.string(),
      email: z.string(),
      __typename: z.string(),
    }),
  }),
});
