/**
 * PLA (Platypus Shoes) GraphQL API Test Data
 * Centralized test data for Account Management tests
 */

// Generate unique email with timestamp to avoid duplicates
const timestamp = Date.now();
const testEmail = `platest${timestamp}@mail.com`;

/**
 * Test data for PLA GraphQL API tests
 */
export const plaTestData = {
  /**
   * Valid customer data for successful account creation
   */
  validCustomer: {
    email: testEmail,
    firstname: 'Hoang',
    lastname: 'PLA1',
    password: 'Johncena5',
    phone_number: '',
    is_subscribed: false,
    loyalty_program_status: false,
    order_number: null,
    gender: 1,
    date_of_birth: null
  },
  
  /**
   * Customer data with invalid email format (double dash at end)
   */
  invalidEmail: {
    email: 'hoangplatest3@mail.com--',
    firstname: 'Hoang',
    lastname: 'PLA1',
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
    password: 'Johncena52',
    remember: true
  },
  
  /**
   * Valid login credentials
   */
  validCredentials: {
    email: testEmail,
    password: 'Johncena5',
    remember: true
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
  invalidEmail: '"hoangplatest3@mail.com--" is not a valid email address.',
  invalidCredentials: 'The account sign-in was incorrect or your account is disabled temporarily. Please wait and try again later.'
};

/**
 * Expected customer data for assertions
 */
export const expectedCustomerData = {
  firstname: 'Hoang',
  lastname: 'PLA1',
  isSubscribed: false,
  gender: 1
};
