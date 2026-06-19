export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SiteAuthMap {
  [siteName: string]: AuthCredentials;
}

// Password is sourced from the GRA_TEST_PASSWORD environment variable and must
// NEVER be hardcoded in this file or in any spec. The empty-string fallback
// causes tests to skip via a password guard in the spec (see auth.spec.ts).
const password = process.env.GRA_TEST_PASSWORD ?? '';

export const testAccounts: SiteAuthMap = {
  'Platypus AU': { email: 'qa.platypus.au.t1@mailinator.com', password },
  'Platypus NZ': { email: 'qa.platypus.nz.t1b@mailinator.com', password },
  'Skechers AU': { email: 'qa.skechers.au.t1@mailinator.com', password },
  'Skechers NZ': { email: 'qa.skechers.nz.t1@mailinator.com', password },
  'Vans AU': { email: 'qa.vans.au.t1@mailinator.com', password },
  'Vans NZ': { email: 'qa.vans.nz.t1@mailinator.com', password },
  'Dr. Martens AU': { email: 'qa.drmartens.au.t1@mailinator.com', password },
  'Dr. Martens NZ': { email: 'qa.drmartens.nz.t1@mailinator.com', password },
};

// Uses each site's real email address with a known-wrong password.
// Intentionally wrong password confirms "incorrect credentials" error path (E2E-AUTH-003).
// The wrong password is hardcoded because it is intentionally invalid — it is NOT a real credential.
export const invalidCredentials: SiteAuthMap = {
  'Platypus AU': { email: testAccounts['Platypus AU'].email, password: 'InvalidPass_00!' },
  'Platypus NZ': { email: testAccounts['Platypus NZ'].email, password: 'InvalidPass_00!' },
  'Skechers AU': { email: testAccounts['Skechers AU'].email, password: 'InvalidPass_00!' },
  'Skechers NZ': { email: testAccounts['Skechers NZ'].email, password: 'InvalidPass_00!' },
  'Vans AU': { email: testAccounts['Vans AU'].email, password: 'InvalidPass_00!' },
  'Vans NZ': { email: testAccounts['Vans NZ'].email, password: 'InvalidPass_00!' },
  'Dr. Martens AU': { email: testAccounts['Dr. Martens AU'].email, password: 'InvalidPass_00!' },
  'Dr. Martens NZ': { email: testAccounts['Dr. Martens NZ'].email, password: 'InvalidPass_00!' },
};
