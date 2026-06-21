import { faker } from './faker';

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

export class AdminTestDataGenerator {
  static generateRandomEmail(): string {
    const [local, domain] = faker.internet.email().toLowerCase().split('@');
    return `${local}_${Date.now()}@${domain}`;
  }

  static generateCustomerData(): CustomerData {
    return {
      customerName: faker.person.fullName(),
      gender: faker.person.sexType(),
      dateOfBirth: faker.date.birthdate().toLocaleDateString('en-US'),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      pinCode: faker.location.zipCode('######'),
      mobileNumber: faker.string.numeric(10),
      email: this.generateRandomEmail(),
    };
  }

  static generateAccountData(): AccountData {
    return {
      accountType: faker.helpers.arrayElement(['Savings', 'Current'] as const),
      initialDeposit: faker.number.int({ min: 1000, max: 10000 }).toString(),
    };
  }

  static generateTransactionData(): TransactionData {
    return {
      depositAmount: faker.number.int({ min: 100, max: 1000 }).toString(),
      withdrawalAmount: faker.number.int({ min: 50, max: 500 }).toString(),
      transferAmount: faker.number.int({ min: 10, max: 200 }).toString(),
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
