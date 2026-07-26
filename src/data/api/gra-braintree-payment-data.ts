export interface BraintreeTestCard {
  number: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
}

export class BraintreeTestCardGenerator {
  // Empirically verified against the sandbox Braintree GraphQL API during technical research
  // (2026-07). Only this number is used — other published Braintree sandbox test numbers
  // (decline/expired variants) were not independently re-verified against this integration.
  static generateSandboxVisa(): BraintreeTestCard {
    const now = new Date();
    const expirationYear = String(now.getFullYear() + 3);
    const expirationMonth = String(now.getMonth() + 1).padStart(2, '0');
    const cvv = String(Math.floor(100 + Math.random() * 900));

    return {
      number: '4111111111111111',
      expirationMonth,
      expirationYear,
      cvv,
    };
  }
}
