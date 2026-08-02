import { faker } from '../faker';

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

const FRESH_ACCOUNT_PASSWORD = process.env.GRA_TEST_PASSWORD || 'Johncena5';

export function createFreshAccountCredentials(brandCode: string): FreshAccountCredentials {
  const ts = Date.now();
  const rand = faker.string.alphanumeric(8).toLowerCase();
  return {
    email: `qa.${brandCode}.e2e${ts}${rand}@mailinator.com`,
    password: FRESH_ACCOUNT_PASSWORD,
    firstname: faker.person.firstName(),
    lastname: faker.person.lastName(),
    phone_number: '0412345678',
  };
}

export interface GuestCheckoutEmail {
  email: string;
}

// E2E-CHKOUT-003 — unique per call so repeated test runs never collide on the same address.
export function createGuestCheckoutEmail(): GuestCheckoutEmail {
  const ts = Date.now();
  const rand = faker.string.alphanumeric(8).toLowerCase();
  return {
    email: `qa.checkout.e2e${ts}${rand}@mailinator.com`,
  };
}

export interface GuestShippingAddress {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  /**
   * Partial address text typed into the checkout address-autocomplete field to trigger the
   * suggestion dropdown. "1 Pitt Street Sydney" is a confirmed Sydney CBD address (verified
   * live: resolves to a "1 Pitt St, SYDNEY, NSW, 2000" suggestion on Platypus AU staging).
   * E2E-CHKOUT-004 selects the first rendered suggestion rather than depending on this
   * resolving to any specific address — see fillShippingAddressAndSelectSuggestion() in
   * checkout-page.ts for the confirmed recon finding that shipping methods only become
   * selectable once a suggestion is picked (typed free text alone leaves every delivery-method
   * radio disabled). A CBD address was deliberately used (rather than a remote suburb) to give
   * the widest chance of enabling more than one carrier/method — recon confirmed Platypus AU
   * staging still only ever enables exactly one method regardless of address; this is
   * documented in checkout-page.ts as a known staging characteristic, not a test defect.
   *
   * RECON FINDING (confirmed live, single-worker run against Platypus NZ staging): the AU
   * address above does NOT resolve to a suggestion on NZ storefronts — the shipping-address
   * autocomplete is region-scoped, so an AU query against an NZ store returns nothing and
   * fillShippingAddressAndSelectSuggestion() correctly reports "cannot proceed". This was
   * initially mistaken for storefront flakiness; it is a genuine region mismatch in the test
   * data. createGuestShippingAddress() therefore takes an `isNz` flag so callers can request an
   * NZ-appropriate query for NZ storefronts (see storefronts.ts `storeHeader === 'nz'`).
   */
  addressQuery: string;
}

export function createGuestShippingAddress(isNz = false): GuestShippingAddress {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    phoneNumber: '0412345678',
    addressQuery: isNz ? '1 Queen Street Auckland' : '1 Pitt Street Sydney',
  };
}

// E2E-CHKOUT-009 — Data for the "Add New Address" drawer on /my-details. `firstName`/`lastName`
// are generated independently from any account-profile identity (never derived from
// FreshAccountCredentials) so a test can assert the checkout "DELIVER TO" block genuinely
// sources its text from the saved address, not the account profile — see the recon notes on
// EcommerceCheckoutPage.getDeliverToAddressText(). `region` must be a value confirmed present in
// the storefront's Region/State combobox (AU: VIC/NSW/QLD/NT/WA/TAS/ACT/SA, confirmed live on
// Dr. Martens AU); NZ region values are unconfirmed — callers should verify via
// EcommerceMyDetailsPage.getRegionOptionTexts() and test.skip() if the value below is absent.
export interface NewSavedAddressData {
  addressName: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  postcode: string;
  region: string;
  phoneNumber: string;
}

export function createNewSavedAddressData(isNz = false): NewSavedAddressData {
  return {
    addressName: 'Home',
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    street: isNz ? '1 Queen Street' : '42 Example Parade',
    city: isNz ? 'Auckland' : 'Melbourne',
    postcode: isNz ? '1010' : '3000',
    region: isNz ? 'Auckland' : 'VIC',
    phoneNumber: isNz ? '0212345678' : '0412345678',
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
