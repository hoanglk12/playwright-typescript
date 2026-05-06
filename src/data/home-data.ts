

export interface Credentials {
  username: string;
  password: string;
}

export interface NavigationMenu {
  highlightedColor: string;
}

export interface HeaderDataShape {
  VALID_ADMIN: Credentials;
  INVALID_ADMIN: Credentials;
  EMPTY_CREDENTIALS: Credentials;
  NAVIGATION_MENU: NavigationMenu;
}

export interface FooterDataShape {
  VALID_ADMIN: Credentials;
  INVALID_ADMIN: Credentials;
  EMPTY_CREDENTIALS: Credentials;
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

/**
 * Generate random test data
 */
export class HomeTestDataGenerator {
  
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
export const HeaderData: HeaderDataShape = {
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
  },
  NAVIGATION_MENU:{
    highlightedColor: '#003f64',
  }
};

export const FooterData: FooterDataShape = {
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
