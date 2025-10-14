/**
 * Shared state module for PLA API tests
 * This module holds shared variables that can be accessed across test files
 */

// Shared customer token from account management tests
export let customerToken: string;

// Shared customer ID
export let customerId: string;

// Shared cart ID
export let cartId: string;

//Shared address ID
export let addressId: string;

/**
 * Set customer token
 */
export function setCustomerToken(token: string): void {
  customerToken = token;
}

/**
 * Set customer ID
 */
export function setCustomerId(id: string): void {
  customerId = id;
}

export function setAddressId(id: string): void {
  addressId = id;
}


/**
 * Set cart ID
 */
export function setCartId(id: string): void {
  cartId = id;
}

/**
 * Get customer token
 */
export function getCustomerToken(): string {
  return customerToken;
}

/**
 * Get customer ID
 */
export function getCustomerId(): string {
  return customerId;
}

/**
 * Get cart ID
 */
export function getCartId(): string {
  return cartId;
}

/**
 * Get address ID
 */
export function getAddressId(): string {
  return addressId;
}

