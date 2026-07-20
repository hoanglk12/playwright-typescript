export interface CustomerOrderItem {
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  __typename: string;
}

export interface CustomerOrderShape {
  number: string;
  status: string;
  grand_total: number;
  items: CustomerOrderItem[];
  __typename: string;
}

export interface CustomerOrdersShape {
  items: CustomerOrderShape[];
  total_count: number;
  __typename: string;
}

export interface FreshOrderAccount {
  email: string;
  firstname: string;
  lastname: string;
  password: string;
  phone_number: string;
  gender: number;
}

export interface OrderHistoryDataShape {
  invalidGuestToken: string;
  orderNumberPattern: RegExp;
  paginationPageSize: number;
  simplePaymentCodes: string[];
}

export const OrderHistoryData: Readonly<OrderHistoryDataShape> = {
  invalidGuestToken: 'INVALID-GUEST-TOKEN-99999999',
  orderNumberPattern: /^\S+$/,
  paginationPageSize: 1,
  simplePaymentCodes: ['checkmo', 'afterpay', 'free', 'cashondelivery'],
};

export class OrderHistoryDataGenerator {
  static generateFreshAccount(): FreshOrderAccount {
    return {
      email: `ordertest${Date.now()}@example.com`,
      firstname: 'Order',
      lastname: 'HistoryTest',
      password: 'Johncena5',
      phone_number: '0412345678',
      gender: 0,
    };
  }
}

export interface OrderHistoryErrorCategories {
  unauthorized: string;
}

export const orderHistoryErrorCategories: OrderHistoryErrorCategories = {
  unauthorized: 'graphql-authorization',
};
