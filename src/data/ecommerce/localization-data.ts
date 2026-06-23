/**
 * Localization test data for E2E-LOC suite.
 * Sites that should display AUD prices (AU storefronts) or NZD prices (NZ storefronts).
 * Both currencies use the same $X.XX format — the test validates the dollar-sign symbol
 * and decimal format are present; it does not assert on exact amounts.
 */

export interface LocalizationData {
  auPricePattern: RegExp;
  /** NZD price pattern — same $X.XX format as AUD; validates NZ storefronts show dollar prices */
  nzPricePattern: RegExp;
}

export const LocalizationExpectations: LocalizationData = {
  auPricePattern: /\$[\d,]+\.\d{2}/,
  nzPricePattern: /\$[\d,]+\.\d{2}/,
};
