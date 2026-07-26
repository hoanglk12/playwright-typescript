/**
 * AUD and NZD both use the same $X.XX format — the E2E-LOC tests validate that the
 * dollar-sign symbol and decimal format are present, not any exact amount.
 */

export interface LocalizationData {
  auPricePattern: RegExp;
  nzPricePattern: RegExp;
}

export const LocalizationExpectations: LocalizationData = {
  auPricePattern: /\$[\d,]+\.\d{2}/,
  nzPricePattern: /\$[\d,]+\.\d{2}/,
};
