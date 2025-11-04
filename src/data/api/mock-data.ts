/**
 * Mock Data Generators
 * 
 * Provides pre-built mock data for common API testing scenarios
 */

export class MockDataGenerators {
  
  // ==================== USER DATA ====================
  
  static mockUser(overrides: Partial<any> = {}) {
    return {
      id: this.randomId(),
      username: `user_${this.randomString(8)}`,
      email: `${this.randomString(8)}@example.com`,
      firstName: this.randomFirstName(),
      lastName: this.randomLastName(),
      phone: this.randomPhone(),
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  static mockUserList(count: number = 10) {
    return Array.from({ length: count }, () => this.mockUser());
  }

  static mockAdmin(overrides: Partial<any> = {}) {
    return this.mockUser({
      role: 'admin',
      permissions: ['read', 'write', 'delete', 'manage_users'],
      ...overrides,
    });
  }

  // ==================== PRODUCT DATA ====================
  
  static mockProduct(overrides: Partial<any> = {}) {
    const name = this.randomProductName();
    return {
      id: this.randomId(),
      sku: `SKU-${this.randomString(8).toUpperCase()}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      description: `High quality ${name.toLowerCase()} for everyday use`,
      price: this.randomPrice(10, 500),
      currency: 'USD',
      stock: this.randomInt(0, 500),
      inStock: true,
      category: this.randomCategory(),
      brand: this.randomBrand(),
      images: [
        `https://picsum.photos/400/400?random=${this.randomId()}`,
        `https://picsum.photos/400/400?random=${this.randomId() + 1}`,
      ],
      rating: this.randomRating(),
      reviewCount: this.randomInt(0, 1000),
      tags: this.randomTags(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  static mockProductList(count: number = 20) {
    return Array.from({ length: count }, () => this.mockProduct());
  }

  static mockOutOfStockProduct(overrides: Partial<any> = {}) {
    return this.mockProduct({
      stock: 0,
      inStock: false,
      ...overrides,
    });
  }

  // ==================== ORDER DATA ====================
  
  static mockOrder(overrides: Partial<any> = {}) {
    const items = this.mockOrderItems(this.randomInt(1, 5));
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 10.00;
    const tax = subtotal * 0.08;
    
    return {
      id: this.randomId(),
      orderNumber: `ORD-${Date.now()}-${this.randomString(4).toUpperCase()}`,
      customerId: this.randomId(),
      status: this.randomOrderStatus(),
      items,
      subtotal: this.roundPrice(subtotal),
      shipping: this.roundPrice(shipping),
      tax: this.roundPrice(tax),
      total: this.roundPrice(subtotal + shipping + tax),
      currency: 'USD',
      paymentMethod: this.randomPaymentMethod(),
      paymentStatus: 'paid',
      shippingAddress: this.mockAddress(),
      billingAddress: this.mockAddress(),
      trackingNumber: `TRK${this.randomString(12).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDelivery: this.futureDate(7),
      ...overrides,
    };
  }

  static mockOrderList(count: number = 15) {
    return Array.from({ length: count }, () => this.mockOrder());
  }

  static mockOrderItems(count: number = 3) {
    return Array.from({ length: count }, () => ({
      id: this.randomId(),
      productId: this.randomId(),
      productName: this.randomProductName(),
      sku: `SKU-${this.randomString(8).toUpperCase()}`,
      price: this.randomPrice(10, 200),
      quantity: this.randomInt(1, 5),
      image: `https://picsum.photos/100/100?random=${this.randomId()}`,
    }));
  }

  // ==================== ADDRESS DATA ====================
  
  static mockAddress(overrides: Partial<any> = {}) {
    return {
      id: this.randomId(),
      firstName: this.randomFirstName(),
      lastName: this.randomLastName(),
      company: this.randomInt(0, 1) ? this.randomCompany() : null,
      street1: `${this.randomInt(1, 9999)} ${this.randomStreet()}`,
      street2: this.randomInt(0, 1) ? `Apt ${this.randomInt(1, 500)}` : null,
      city: this.randomCity(),
      state: this.randomState(),
      zipCode: this.randomZipCode(),
      country: 'United States',
      countryCode: 'US',
      phone: this.randomPhone(),
      isDefault: false,
      ...overrides,
    };
  }

  static mockAddressList(count: number = 3) {
    const addresses = Array.from({ length: count }, () => this.mockAddress());
    if (addresses.length > 0) {
      addresses[0].isDefault = true;
    }
    return addresses;
  }

  // ==================== CART DATA ====================
  
  static mockCart(overrides: Partial<any> = {}) {
    const items = this.mockCartItems(this.randomInt(1, 5));
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      id: this.randomId(),
      customerId: this.randomId(),
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: this.roundPrice(subtotal),
      discount: 0,
      total: this.roundPrice(subtotal),
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: this.futureDate(30),
      ...overrides,
    };
  }

  static mockEmptyCart(overrides: Partial<any> = {}) {
    return this.mockCart({
      items: [],
      itemCount: 0,
      subtotal: 0,
      total: 0,
      ...overrides,
    });
  }

  static mockCartItems(count: number = 3) {
    return Array.from({ length: count }, () => ({
      id: this.randomId(),
      productId: this.randomId(),
      productName: this.randomProductName(),
      sku: `SKU-${this.randomString(8).toUpperCase()}`,
      price: this.randomPrice(10, 200),
      quantity: this.randomInt(1, 5),
      image: `https://picsum.photos/100/100?random=${this.randomId()}`,
      inStock: true,
    }));
  }

  // ==================== PAYMENT DATA ====================
  
  static mockPaymentMethod(overrides: Partial<any> = {}) {
    return {
      id: this.randomId(),
      type: 'credit_card',
      last4: this.randomString(4, '0123456789'),
      brand: this.randomCardBrand(),
      expiryMonth: this.randomInt(1, 12),
      expiryYear: this.randomInt(2024, 2030),
      holderName: `${this.randomFirstName()} ${this.randomLastName()}`,
      isDefault: false,
      ...overrides,
    };
  }

  static mockPaymentMethodList(count: number = 2) {
    const methods = Array.from({ length: count }, () => this.mockPaymentMethod());
    if (methods.length > 0) {
      methods[0].isDefault = true;
    }
    return methods;
  }

  // ==================== AUTHENTICATION DATA ====================
  
  static mockAuthToken(overrides: Partial<any> = {}) {
    return {
      accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${this.randomString(100)}.${this.randomString(40)}`,
      refreshToken: this.randomString(64),
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: this.futureDate(1),
      ...overrides,
    };
  }

  static mockLoginResponse(overrides: Partial<any> = {}) {
    return {
      user: this.mockUser(),
      token: this.mockAuthToken(),
      ...overrides,
    };
  }

  // ==================== ERROR RESPONSES ====================
  
  static mockValidationError(fields: string[] = ['email']) {
    return {
      error: 'Validation Error',
      message: 'Request validation failed',
      statusCode: 422,
      errors: fields.map(field => ({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  static mockNotFoundError(resource: string = 'Resource') {
    return {
      error: 'Not Found',
      message: `${resource} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    };
  }

  static mockUnauthorizedError() {
    return {
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    };
  }

  static mockForbiddenError() {
    return {
      error: 'Forbidden',
      message: 'You do not have permission to perform this action',
      statusCode: 403,
      timestamp: new Date().toISOString(),
    };
  }

  static mockServerError() {
    return {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== PAGINATION ====================
  
  static mockPaginatedResponse(data: any[], page: number = 1, limit: number = 10) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageData = data.slice(startIndex, endIndex);
    
    return {
      data: pageData,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit),
        hasNext: endIndex < data.length,
        hasPrev: page > 1,
      },
    };
  }

  // ==================== GRAPHQL RESPONSES ====================
  
  static mockGraphQLSuccess(data: any) {
    return {
      data,
    };
  }

  static mockGraphQLError(message: string, code?: string) {
    return {
      errors: [{
        message,
        extensions: code ? { code } : undefined,
      }],
    };
  }

  // ==================== HELPER METHODS ====================
  
  private static randomId(): number {
    return Math.floor(Math.random() * 1000000);
  }

  private static randomString(length: number, chars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static randomPrice(min: number, max: number): number {
    return this.roundPrice(Math.random() * (max - min) + min);
  }

  private static roundPrice(price: number): number {
    return Math.round(price * 100) / 100;
  }

  private static randomRating(): number {
    return Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0 - 5.0
  }

  private static randomFirstName(): string {
    const names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Emma', 'Robert', 'Olivia'];
    return names[Math.floor(Math.random() * names.length)];
  }

  private static randomLastName(): string {
    const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    return names[Math.floor(Math.random() * names.length)];
  }

  private static randomProductName(): string {
    const adjectives = ['Premium', 'Deluxe', 'Pro', 'Ultra', 'Classic', 'Modern', 'Vintage', 'Elite'];
    const products = ['Laptop', 'Headphones', 'Keyboard', 'Mouse', 'Monitor', 'Chair', 'Desk', 'Camera', 'Watch', 'Phone'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${products[Math.floor(Math.random() * products.length)]}`;
  }

  private static randomCategory(): string {
    const categories = ['Electronics', 'Computers', 'Accessories', 'Gaming', 'Office', 'Home', 'Sports', 'Fashion'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private static randomBrand(): string {
    const brands = ['TechCorp', 'ProGear', 'SmartDevices', 'EliteGadgets', 'PremiumTech', 'UltraProducts'];
    return brands[Math.floor(Math.random() * brands.length)];
  }

  private static randomTags(): string[] {
    const allTags = ['new', 'sale', 'featured', 'popular', 'trending', 'bestseller', 'limited'];
    const count = this.randomInt(1, 3);
    return Array.from({ length: count }, () => allTags[Math.floor(Math.random() * allTags.length)]);
  }

  private static randomOrderStatus(): string {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private static randomPaymentMethod(): string {
    const methods = ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay'];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  private static randomCardBrand(): string {
    const brands = ['Visa', 'Mastercard', 'American Express', 'Discover'];
    return brands[Math.floor(Math.random() * brands.length)];
  }

  private static randomPhone(): string {
    return `+1${this.randomString(3, '0123456789')}-${this.randomString(3, '0123456789')}-${this.randomString(4, '0123456789')}`;
  }

  private static randomStreet(): string {
    const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Park Blvd', 'Lake Rd', 'Hill St', 'Pine Ave'];
    return streets[Math.floor(Math.random() * streets.length)];
  }

  private static randomCity(): string {
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  private static randomState(): string {
    const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH'];
    return states[Math.floor(Math.random() * states.length)];
  }

  private static randomZipCode(): string {
    return this.randomString(5, '0123456789');
  }

  private static randomCompany(): string {
    const companies = ['Tech Solutions Inc', 'Digital Innovations LLC', 'Smart Systems Corp', 'Future Enterprises'];
    return companies[Math.floor(Math.random() * companies.length)];
  }

  private static futureDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }
}
