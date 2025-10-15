/**
 * PLA (Platypus Shoes) GraphQL API Test Data
 * Centralized test data for Account Management tests
 */

/**
 * Generate random string for unique test data
 */
const generateRandomString = (length: number = 8): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate random first name
 */
const generateFirstName = (): string => {
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Cameron'];
  return firstNames[Math.floor(Math.random() * firstNames.length)];
};

/**
 * Generate random last name
 */
const generateLastName = (): string => {
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  return lastNames[Math.floor(Math.random() * lastNames.length)];
};

/**
 * Generate random phone number (AU format)
 */
const generatePhoneNumber = (): string => {
  const areaCode = ['02', '03', '04', '07', '08'][Math.floor(Math.random() * 5)];
  const number = Math.floor(10000000 + Math.random() * 90000000);
  return `${areaCode}${number}`;
};

/**
 * Generate random street address
 */
const generateStreetAddress = (): string => {
  const streetNumber = Math.floor(1 + Math.random() * 999);
  const streetNames = ['Main St', 'High St', 'George St', 'King St', 'Queen St', 'Collins St', 'Bourke St', 'Elizabeth St'];
  return `${streetNumber} ${streetNames[Math.floor(Math.random() * streetNames.length)]}`;
};

/**
 * Generate random Australian city and postcode
 */
const generateCityPostcode = (): { city: string; postcode: string; region: string } => {
  const locations = [
    { city: 'SYDNEY', postcode: '2000', region: 'NSW' },
    { city: 'MELBOURNE', postcode: '3000', region: 'VIC' },
    { city: 'BRISBANE', postcode: '4000', region: 'QLD' },
    { city: 'PERTH', postcode: '6000', region: 'WA' },
    { city: 'ADELAIDE', postcode: '5000', region: 'SA' },
    { city: 'HOBART', postcode: '7000', region: 'TAS' },
    { city: 'CANBERRA', postcode: '2600', region: 'ACT' },
    { city: 'DARWIN', postcode: '0800', region: 'NT' }
  ];
  return locations[Math.floor(Math.random() * locations.length)];
};

// Generate unique email with timestamp and random string to avoid duplicates
const timestamp = Date.now();
const randomId = generateRandomString(6);
const testEmail = `platest${timestamp}${randomId}@mail.com`;

// Generate random user data
const firstName = generateFirstName();
const lastName = generateLastName();
const phoneNumber = generatePhoneNumber();
const streetAddress = generateStreetAddress();
const location = generateCityPostcode();

/**
 * Test data for PLA GraphQL API tests
 */
export const plaTestData = {
  /**
   * Valid customer data for successful account creation
   */
  validCustomer: {
    email: testEmail,
    firstname: firstName,
    lastname: lastName,
    password: 'Johncena5',
    phone_number: '',
    is_subscribed: false,
    loyalty_program_status: false,
    order_number: null,
    gender: Math.floor(Math.random() * 2), // Random gender: 0 (male) or 1 (female)
    date_of_birth: null
  },
  
  /**
   * Customer data with invalid email format (double dash at end)
   */
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
    date_of_birth: null
  },
  
  /**
   * Invalid login credentials (wrong password)
   */
  invalidPassword: {
    email: testEmail,
    password: 'WrongPassword123',
    remember: true
  },
  
  /**
   * Valid login credentials
   */
  validCredentials: {
    email: testEmail,
    password: 'Johncena5',
    remember: true,
    firstName: firstName,
    lastName: lastName
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
          attribute_code: 'address_name'
        }
      },
      region: {
        region: location.region
      },
      country_code: 'AU'
    }
  },

  /**
   * Update customer address data (addressId will be injected at runtime)
   * This is the template for updating an existing address
   */
  updateCustomerAddressTemplate: {
    firstname: firstName,
    lastname: lastName,
    street: [
      streetAddress
    ],
    city: location.city,
    postcode: location.postcode,
    region: {
      region: location.region
    },
    telephone: phoneNumber,
    default_shipping: false,
    default_billing: false,
    custom_attributes: {
      value: {
        value: `${firstName}'s Address`,
        attribute_code: "address_name"
      }
    },
    country_code: 'AU'
  },

  expectedPaymentMethods: {
    codes: ['checkmo', 'braintree_applepay', 'free', 'braintree', 'braintree_paypal'],
    titles: ['Check / Money order', 'Apple Pay', 'No Payment Information Required', 'Credit or Debit Card', 'PayPal']
  }
};

/**
 * Export test email for assertions
 */
export const getTestEmail = () => testEmail;

/**
 * Expected validation messages
 */
export const plaErrorMessages = {
  invalidEmail: 'is not a valid email address.',
  invalidCredentials: 'The account sign-in was incorrect or your account is disabled temporarily. Please wait and try again later.',
  invalidCartId: 'Could not find a cart with ID "wbkTBuu2dxhmC6AVHT0YzUBIoOEs5M67ss"'
};

/**
 * Expected customer data for assertions (dynamic based on random generation)
 */
export const expectedCustomerData = {
  firstname: firstName,
  lastname: lastName,
  isSubscribed: false,
  gender: plaTestData.validCustomer.gender
};
