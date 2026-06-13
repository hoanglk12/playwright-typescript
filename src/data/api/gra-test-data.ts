/**
 * PLA (Platypus Shoes) GraphQL API Test Data
 * Centralized test data for Account Management tests
 */

const generateRandomString = (length: number = 8): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateFirstName = (): string => {
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Cameron'];
  return firstNames[Math.floor(Math.random() * firstNames.length)];
};

const generateLastName = (): string => {
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  return lastNames[Math.floor(Math.random() * lastNames.length)];
};

const generatePhoneNumber = (): string => {
  const areaCode = ['02', '03', '04', '07', '08'][Math.floor(Math.random() * 5)];
  const number = Math.floor(10000000 + Math.random() * 90000000);
  return `${areaCode}${number}`;
};

const generateStreetAddress = (): string => {
  const streetNumber = Math.floor(1 + Math.random() * 999);
  const streetNames = ['Main St', 'High St', 'George St', 'King St', 'Queen St', 'Collins St', 'Bourke St', 'Elizabeth St'];
  return `${streetNumber} ${streetNames[Math.floor(Math.random() * streetNames.length)]}`;
};

const generateCityPostcode = (): { city: string; postcode: string; region: string } => {
  const locations = [
    { city: 'SYDNEY', postcode: '2000', region: 'NSW' },
    { city: 'MELBOURNE', postcode: '3000', region: 'VIC' },
    { city: 'BRISBANE', postcode: '4000', region: 'QLD' },
    { city: 'PERTH', postcode: '6000', region: 'WA' },
    { city: 'ADELAIDE', postcode: '5000', region: 'SA' },
    { city: 'HOBART', postcode: '7000', region: 'TAS' },
    { city: 'CANBERRA', postcode: '2600', region: 'ACT' },
    { city: 'DARWIN', postcode: '0800', region: 'NT' },
  ];
  return locations[Math.floor(Math.random() * locations.length)];
};

export interface CustomerInput {
  email: string;
  firstname: string;
  lastname: string;
  password: string;
  phone_number: string;
  is_subscribed: boolean;
  loyalty_program_status: boolean;
  order_number: string | null;
  gender: number;
  date_of_birth: string | null;
}

export interface InvalidPassword {
  email: string;
  password: string;
  remember: boolean;
}

export interface ValidCredentials {
  email: string;
  password: string;
  remember: boolean;
  firstName: string;
  lastName: string;
}

export interface CustomerAddressAttribute {
  value: {
    value: string;
    attribute_code: string;
  };
}

export interface NewCustomerAddress {
  firstname: string;
  lastname: string;
  street: string;
  city: string;
  postcode: string;
  telephone: string;
  company: string | null;
  default_shipping: boolean;
  default_billing: boolean;
  custom_attributes: CustomerAddressAttribute;
  region: { region: string };
  country_code: string;
}

export interface AddNewCustomerAddressInput {
  address: NewCustomerAddress;
}

export interface UpdateCustomerAddress {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  postcode: string;
  region: { region: string };
  telephone: string;
  default_shipping: boolean;
  default_billing: boolean;
  custom_attributes: CustomerAddressAttribute;
  country_code: string;
}

export interface UpdateCustomerInformation {
  email: string;
  firstname: string;
  lastname: string;
  date_of_birth: string;
  phone_number: string;
  password: string;
  is_subscribed: boolean;
  loyalty_program_status: boolean;
}

export interface GraTestData {
  validCustomer: CustomerInput;
  invalidEmail: CustomerInput;
  invalidPassword: InvalidPassword;
  validCredentials: ValidCredentials;
  invalidCartId: string;
  addNewCustomerAddressForAddressBook: AddNewCustomerAddressInput;
  updateCustomerAddressTemplate: UpdateCustomerAddress;
  updateCustomerInformationData: UpdateCustomerInformation;
  subscribeNewsletterData: { isSubscribed: boolean[] };
  loyaltyProgramData: { status: boolean[] };
  expectedPaymentMethods: { codes: string[]; titles: string[] };
}

export interface GraErrorMessages {
  invalidEmail: string;
  invalidCredentials: string;
  invalidCartId: string;
}

export interface ExpectedCustomerData {
  firstname: string;
  lastname: string;
  isSubscribed: boolean;
  gender: number;
}

/**
 * Generates a fresh, self-consistent GraTestData instance for any brand.
 * The emailPrefix is used as the email address prefix (e.g. 'pla', 'skx', 'drm', 'van').
 * All fields (email, name, address) share the same randomly-generated values,
 * so credentials and address data are always in sync within a single instance.
 * Call once per suite (e.g. at module load or in beforeAll) rather than per-test.
 */
export function createBrandTestData(emailPrefix: string): GraTestData {
  const timestamp = Date.now();
  const randomId = generateRandomString(6);
  const email = `${emailPrefix}test${timestamp}${randomId}@mail.com`;
  const firstName = generateFirstName();
  const lastName = generateLastName();
  const phoneNumber = generatePhoneNumber();
  const streetAddress = generateStreetAddress();
  const location = generateCityPostcode();

  return {
    validCustomer: {
      email,
      firstname: firstName,
      lastname: lastName,
      password: 'Johncena5',
      phone_number: phoneNumber,
      is_subscribed: false,
      loyalty_program_status: false,
      order_number: null,
      gender: 0,
      date_of_birth: null,
    },
    invalidEmail: {
      email: `invalid${randomId}@mail.com--`,
      firstname: firstName,
      lastname: lastName,
      password: 'Johncena5',
      phone_number: '',
      is_subscribed: false,
      loyalty_program_status: false,
      order_number: null,
      gender: 1,
      date_of_birth: null,
    },
    invalidPassword: {
      email,
      password: 'WrongPassword123',
      remember: true,
    },
    validCredentials: {
      email,
      password: 'Johncena5',
      remember: true,
      firstName,
      lastName,
    },
    invalidCartId: 'wbkTBuu2dxhmC6AVHT0YzUBIoOEs5M67ss',
    addNewCustomerAddressForAddressBook: {
      address: {
        firstname: firstName,
        lastname: lastName,
        street: streetAddress,
        city: location.city,
        postcode: location.postcode,
        telephone: phoneNumber,
        company: null,
        default_shipping: true,
        default_billing: true,
        custom_attributes: {
          value: {
            value: `${firstName}'s Address`,
            attribute_code: 'address_name',
          },
        },
        region: { region: location.region },
        country_code: 'AU',
      },
    },
    updateCustomerAddressTemplate: {
      firstname: firstName,
      lastname: lastName,
      street: [streetAddress],
      city: location.city,
      postcode: location.postcode,
      region: { region: location.region },
      telephone: phoneNumber,
      default_shipping: false,
      default_billing: false,
      custom_attributes: {
        value: {
          value: `${firstName}'s Address`,
          attribute_code: 'address_name',
        },
      },
      country_code: 'AU',
    },
    updateCustomerInformationData: {
      email,
      firstname: firstName,
      lastname: lastName,
      date_of_birth: '06/29/1995',
      phone_number: '0575463465',
      password: 'Johncena5',
      is_subscribed: false,
      loyalty_program_status: false,
    },
    subscribeNewsletterData: { isSubscribed: [true, false] },
    loyaltyProgramData: { status: [true, false] },
    expectedPaymentMethods: {
      codes: ['checkmo', 'braintree_applepay', 'free', 'braintree', 'braintree_paypal'],
      titles: ['Check / Money order', 'Apple Pay', 'No Payment Information Required', 'Credit or Debit Card', 'PayPal'],
    },
  };
}

export function createGraTestData(): GraTestData {
  return createBrandTestData('pla');
}

// Module-load-time singleton — single source of truth for this run.
export const graTestData: GraTestData = createGraTestData();

export const getTestEmail = (): string => graTestData.validCredentials.email;

export const graErrorMessages: GraErrorMessages = {
  invalidEmail: 'is not a valid email address.',
  invalidCredentials: 'The account sign-in was incorrect or your account is disabled temporarily. Please wait and try again later.',
  invalidCartId: 'Could not find a cart with ID "wbkTBuu2dxhmC6AVHT0YzUBIoOEs5M67ss"',
};

export const expectedCustomerData: ExpectedCustomerData = {
  firstname: graTestData.validCustomer.firstname,
  lastname: graTestData.validCustomer.lastname,
  isSubscribed: false,
  gender: graTestData.validCustomer.gender,
};
