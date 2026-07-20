export interface QffApplyInput {
  memberNumber: string;
  pointsBurned: number;
  dollarValue: number;
  quoteRef: string;
}

export interface LoyaltyRewardsDataShape {
  qffApply: QffApplyInput;
  invalidCartId: string;
  unauthenticatedErrorCategories: string[];
}

export const LoyaltyRewardsData: LoyaltyRewardsDataShape = {
  qffApply: {
    memberNumber: '1987720370',
    pointsBurned: 100,
    dollarValue: 10.0,
    quoteRef: 'TESTREF-AUTOMATION',
  },
  invalidCartId: 'INVALID_LOYALTY_TEST_CART',
  unauthenticatedErrorCategories: ['graphql-authorization', 'graphql-no-such-entity', 'graphql-input'],
};
