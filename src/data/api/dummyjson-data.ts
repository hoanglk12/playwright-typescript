import { faker } from '../faker';
import {
  AddProductRequest,
  UpdateProductRequest,
  AddUserRequest,
  UpdateUserRequest,
  AddCartRequest,
  CartProductInput,
} from '../../api/services/dummyjson';

export interface DummyJsonCredentials {
  username: string;
  password: string;
}

export interface DummyJsonAuthDataShape {
  VALID_USER: DummyJsonCredentials;
  INVALID_USER: DummyJsonCredentials;
}

// Documented dummyjson test account — see https://dummyjson.com/docs/auth
export const dummyJsonAuthData: DummyJsonAuthDataShape = {
  VALID_USER: { username: 'emilys', password: 'emilyspass' },
  INVALID_USER: { username: 'emilys', password: 'wrong-password' },
};

// Deliberately dot-free: dummyjson's JWT parser throws a 500 on a dot-containing string it
// tries (and fails) to decode as a malformed JWT. A plain string without dots fails signature
// verification cleanly and returns the documented 401.
export const DUMMYJSON_INVALID_TOKEN: string = 'invalidtoken12345';

// id 1 is dummyjson's long-stable seed record — safe to use for read/happy-path tests
export const DUMMYJSON_KNOWN_PRODUCT_ID: number = 1;
export const DUMMYJSON_KNOWN_CART_ID: number = 1;
export const DUMMYJSON_KNOWN_USER_ID: number = 1;
// Used only to trigger deterministic 404s — no record will ever exist at this id
export const DUMMYJSON_UNKNOWN_ID: number = 999999;

export class DummyJsonDataGenerator {
  static generateProduct(): AddProductRequest {
    return {
      title: faker.commerce.productName(),
      price: faker.number.float({ min: 5, max: 500, fractionDigits: 2 }),
      category: faker.commerce.department(),
    };
  }

  static generateProductUpdate(): UpdateProductRequest {
    return {
      title: faker.commerce.productName(),
      price: faker.number.float({ min: 5, max: 500, fractionDigits: 2 }),
    };
  }

  static generateUser(): AddUserRequest {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      age: faker.number.int({ min: 18, max: 80 }),
      email: faker.internet.email(),
    };
  }

  static generateUserUpdate(): UpdateUserRequest {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    };
  }

  static generateCart(userId: number): AddCartRequest {
    const products: CartProductInput[] = [
      { id: faker.number.int({ min: 1, max: 100 }), quantity: faker.number.int({ min: 1, max: 3 }) },
    ];
    return { userId, products };
  }
}
