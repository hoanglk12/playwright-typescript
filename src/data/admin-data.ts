export interface ValidCredentials {
  userId: string;
  password: string;
}

export interface InvalidCredentials {
  invalidUserId: string;
  invalidPassword: string;
  emptyUserId: string;
  emptyPassword: string;
}

export interface AdminMessages {
  loginSuccess: string;
  invalidLogin: string;
  registrationSuccess: string;
  customerAddedSuccess: string;
  accountCreatedSuccess: string;
  errorLogin: string;
}

export interface AdminUrls {
  homePage: string;
  loginPage: string;
  registerPage: string;
  managerPage: string;
}

export interface AdminTestDataShape {
  validCredentials: ValidCredentials;
  invalidCredentials: InvalidCredentials;
  expectedMessages: AdminMessages;
  urls: AdminUrls;
}

export interface CustomerData {
  customerName: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  mobileNumber: string;
  email: string;
}

export interface AccountData {
  accountType: 'Savings' | 'Current';
  initialDeposit: string;
}

export interface TransactionData {
  depositAmount: string;
  withdrawalAmount: string;
  transferAmount: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface AdminDataShape {
  VALID_ADMIN: Credentials;
  INVALID_ADMIN: Credentials;
  EMPTY_CREDENTIALS: Credentials;
}

/**
 * Test data for CMS admin application
 */
export const AdminTestData: AdminTestDataShape = {
  // Valid test credentials (these would be generated during registration)
  validCredentials: {
    userId: '', // Will be populated during test execution
    password: '', // Will be populated during test execution
  },

  // Invalid credentials for negative testing
  invalidCredentials: {
    invalidUserId: 'invalid123',
    invalidPassword: 'invalid123',
    emptyUserId: '',
    emptyPassword: '',
  },

 

  // Expected messages
  expectedMessages: {
    loginSuccess: 'Welcome To Manager\'s Page of Guru99 Bank',
    invalidLogin: 'User or Password is not valid',
    registrationSuccess: 'Access details to guru99 Bank',
    customerAddedSuccess: 'Customer Registered Successfully!!!',
    accountCreatedSuccess: 'Account Generated Successfully!!!',
    errorLogin: 'Your sign-in attempt was not successful. Please try again.'

  },

  // URLs
  urls: {
    homePage: '/',
    loginPage: '/',
    registerPage: '',
    managerPage: '',
  },
};

/**
 * Generate random test data
 */
export class AdminTestDataGenerator {
  
  /**
   * Generate random email
   */
  static generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test_${timestamp}_${random}@automation.com`;
  }

  /**
   * Generate random customer data
   */
  static generateCustomerData(): CustomerData {
    const timestamp = Date.now();
    return {
      customerName: `Test Customer ${timestamp}`,
      gender: Math.random() > 0.5 ? 'male' : 'female',
      dateOfBirth: '01/01/1990',
      address: `${Math.floor(Math.random() * 999)} Test Street`,
      city: 'Test City',
      state: 'Test State',
      pinCode: Math.floor(100000 + Math.random() * 900000).toString(),
      mobileNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
      email: this.generateRandomEmail(),
    };
  }

  /**
   * Generate random account data
   */
  static generateAccountData(): AccountData {
    return {
      accountType: Math.random() > 0.5 ? 'Savings' : 'Current',
      initialDeposit: (Math.floor(Math.random() * 10000) + 1000).toString(),
    };
  }

  /**
   * Generate random transaction amounts
   */
  static generateTransactionData(): TransactionData {
    return {
      depositAmount: (Math.floor(Math.random() * 1000) + 100).toString(),
      withdrawalAmount: (Math.floor(Math.random() * 500) + 50).toString(),
      transferAmount: (Math.floor(Math.random() * 200) + 10).toString(),
    };
  }
}

/**
 * Admin data for BankGuru application
 */
export const AdminData: AdminDataShape = {
  VALID_ADMIN: {
    username: 'mngr586899',
    password: 'YzEhaqY'
  },
  
  INVALID_ADMIN: {
    username: 'invaliduser123',
    password: 'invalidpass123'
  },
  
  EMPTY_CREDENTIALS: {
    username: '',
    password: ''
  }
};
