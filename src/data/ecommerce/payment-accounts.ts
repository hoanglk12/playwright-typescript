export interface PayPalSandboxAccount {
  email: string;
  password: string;
}

// Password is sourced from the PAYPAL_SANDBOX_PASSWORD environment variable and must
// NEVER be hardcoded in this file or in any spec. The empty-string fallback causes the
// spec to test.skip() via a password guard (mirrors GRA_TEST_PASSWORD in test-accounts.ts).
const password = process.env.PAYPAL_SANDBOX_PASSWORD ?? '';

// E2E-PLAORD-001 — confirmed live sandbox buyer account (not a production PayPal
// credential) used to complete a real Braintree-mediated PayPal sandbox checkout on
// Platypus AU staging. The email is not treated as a secret; the password is.
export const paypalSandboxAccount: PayPalSandboxAccount = {
  email: 'hoangmanutd12@gmail.com',
  password,
};
