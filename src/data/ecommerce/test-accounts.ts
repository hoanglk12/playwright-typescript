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
