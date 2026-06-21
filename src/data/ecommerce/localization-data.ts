/**
 * Localization test data for E2E-LOC suite.
 * Sites that should display AUD prices
 */

export interface LocalizationData {
  auPricePattern: RegExp;
}

export const LocalizationExpectations: LocalizationData = {
  auPricePattern: /\$[\d,]+\.\d{2}/,
};
