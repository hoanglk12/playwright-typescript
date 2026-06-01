class TestState {
  private static instance: TestState | null = null;
  private _customerToken: string | null = null;
  private _customerId: string | null = null;
  private _cartId: string | null = null;
  private _addressId: string | null = null;

  static getInstance(): TestState {
    if (!TestState.instance) {
      TestState.instance = new TestState();
    }
    return TestState.instance;
  }

  getCustomerToken(): string { return this._customerToken ?? ''; }
  setCustomerToken(token: string): void {
    if (!token) throw new Error('setCustomerToken: token must not be empty');
    this._customerToken = token;
  }

  getCustomerId(): string { return this._customerId ?? ''; }
  setCustomerId(id: string): void {
    if (!id) throw new Error('setCustomerId: id must not be empty');
    this._customerId = id;
  }

  getCartId(): string { return this._cartId ?? ''; }
  setCartId(id: string): void {
    if (!id) throw new Error('setCartId: id must not be empty');
    this._cartId = id;
  }

  getAddressId(): string { return this._addressId ?? ''; }
  setAddressId(id: string): void {
    if (!id) throw new Error('setAddressId: id must not be empty');
    this._addressId = id;
  }

  reset(): void {
    this._customerToken = null;
    this._customerId = null;
    this._cartId = null;
    this._addressId = null;
  }
}

export const sharedState = TestState.getInstance();

export function getCustomerToken(): string { return sharedState.getCustomerToken(); }
export function setCustomerToken(token: string): void { sharedState.setCustomerToken(token); }
export function getCustomerId(): string { return sharedState.getCustomerId(); }
export function setCustomerId(id: string): void { sharedState.setCustomerId(id); }
export function getCartId(): string { return sharedState.getCartId(); }
export function setCartId(id: string): void { sharedState.setCartId(id); }
export function getAddressId(): string { return sharedState.getAddressId(); }
export function setAddressId(id: string): void { sharedState.setAddressId(id); }
