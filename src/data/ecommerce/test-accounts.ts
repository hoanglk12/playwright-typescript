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

export interface FreshAccountCredentials {
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  phone_number: string;
}

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Cameron'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

// Fresh throwaway accounts are created per-run so GRA_TEST_PASSWORD is not required.
// Fall back to the established GRA staging password used across src/data/api/gra-* when unset.
const FRESH_ACCOUNT_PASSWORD = process.env.GRA_TEST_PASSWORD || 'Johncena5';

export function createFreshAccountCredentials(brandCode: string): FreshAccountCredentials {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const firstname = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastname = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return {
    email: `qa.${brandCode}.e2e${ts}${rand}@mailinator.com`,
    password: FRESH_ACCOUNT_PASSWORD,
    firstname,
    lastname,
    phone_number: '0412345678',
  };
}

// Uses email addresses that do not exist on any GRA storefront (E2E-AUTH-004).
// Magento returns the same generic sign-in error for non-existent emails as for
// wrong passwords — by design, to prevent email enumeration attacks.
export const nonExistentCredentials: SiteAuthMap = {
  'Platypus AU': { email: 'qa.noexist.platypus.au@mailinator.com', password: 'AnyPass_99!' },
  'Platypus NZ': { email: 'qa.noexist.platypus.nz@mailinator.com', password: 'AnyPass_99!' },
  'Skechers AU': { email: 'qa.noexist.skechers.au@mailinator.com', password: 'AnyPass_99!' },
  'Skechers NZ': { email: 'qa.noexist.skechers.nz@mailinator.com', password: 'AnyPass_99!' },
  'Vans AU': { email: 'qa.noexist.vans.au@mailinator.com', password: 'AnyPass_99!' },
  'Vans NZ': { email: 'qa.noexist.vans.nz@mailinator.com', password: 'AnyPass_99!' },
  'Dr. Martens AU': { email: 'qa.noexist.drmartens.au@mailinator.com', password: 'AnyPass_99!' },
  'Dr. Martens NZ': { email: 'qa.noexist.drmartens.nz@mailinator.com', password: 'AnyPass_99!' },
};
