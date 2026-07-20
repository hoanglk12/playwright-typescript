// Shared GraphQL query/mutation strings for GRA multi-brand API specs (tests/api/gra-*.spec.ts).
// Hoisted here to remove verbatim/near-verbatim duplication across spec files.
// Where specs previously used slightly different selection sets, the superset (union) of
// fields is kept — extra fields are harmless to callers that don't read them.

export interface SignInVariables {
  email: string;
  password: string;
  remember?: boolean;
}

export interface CreateAccountVariables {
  email: string;
  firstname: string;
  lastname: string;
  password: string;
  phone_number: string;
  is_subscribed: boolean;
  loyalty_program_status?: boolean | null;
  order_number?: string | null;
  gender?: number | null;
  date_of_birth?: string | null;
}

export const SIGN_IN_MUTATION = `
  mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
    generateCustomerToken(email: $email, password: $password, remember: $remember) {
      token
      __typename
    }
  }
`;

// Superset of api-test-helpers/gra-authentication (id email __typename) and
// gra-account-creation-signin (id firstname lastname email __typename) selection sets.
export const CREATE_ACCOUNT_MUTATION = `
  mutation CreateAccount(
    $email: String!, $firstname: String!, $lastname: String!,
    $password: String!, $phone_number: String!, $is_subscribed: Boolean!,
    $loyalty_program_status: Boolean, $order_number: String,
    $gender: Int, $date_of_birth: String
  ) {
    createCustomer(input: {
      email: $email, firstname: $firstname, lastname: $lastname,
      password: $password, phone_number: $phone_number,
      is_subscribed: $is_subscribed, loyalty_program_status: $loyalty_program_status,
      order_number: $order_number, gender: $gender, date_of_birth: $date_of_birth
    }) {
      customer { id firstname lastname email __typename }
    }
  }
`;

// Aliases createEmptyCart -> cartId. gra-support-features previously used the field
// unaliased (data.createEmptyCart) — its consuming code has been updated to read data.cartId.
export const CREATE_CART_MUTATION = `mutation CreateCart { cartId: createEmptyCart }`;

export interface ProductVariant {
  product: { sku: string; stock_status: string; __typename?: string };
}

export interface ProductItem {
  sku: string;
  name?: string;
  stock_status: string;
  __typename: string;
  variants?: ProductVariant[];
}

export interface GetProductsQueryVariables {
  search: string;
  pageSize?: number;
}

export interface SkuDiscoveryOptions {
  searchTerms: string[];
  pageSize: number;
}

// Shared discoverInStockSkus() options — used by gra-checkout-shipping, gra-checkout-billing-payment,
// and gra-cart-minicart, which all previously duplicated this identical options object.
export const SKU_DISCOVERY_DEFAULTS: Readonly<SkuDiscoveryOptions> = {
  searchTerms: ['', 'shoe', 'nike', 'a'],
  pageSize: 10,
};

// pageSize hoisted to a variable — previously hardcoded to 10 or 20 depending on the spec.
export const GET_PRODUCTS_QUERY = `
  query GetTestProducts($search: String!, $pageSize: Int) {
    products(search: $search, pageSize: $pageSize, currentPage: 1) {
      items {
        sku
        name
        stock_status
        __typename
        ... on ConfigurableProduct {
          variants {
            product { sku stock_status __typename }
          }
        }
      }
    }
  }
`;

export interface CartItemInput {
  sku: string;
  quantity: number;
}

export interface UserError {
  code: string;
  message: string;
}

export const ADD_PRODUCTS_MUTATION = `
  mutation AddProductsToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
    addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
      cart {
        items {
          id
          quantity
          product { sku name __typename }
          __typename
        }
        total_quantity
        __typename
      }
      user_errors { code message __typename }
      __typename
    }
  }
`;

export const REMOVE_ITEM_MUTATION = `
  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {
    removeItemFromCart(input: $input) {
      cart {
        items { id quantity product { sku __typename } __typename }
        total_quantity
        __typename
      }
      __typename
    }
  }
`;

export interface ShippingMethod {
  carrier_code: string;
  method_code: string;
  available: boolean;
}

export interface CartAddressInput {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: string;
  postcode: string;
  country_code: string;
  telephone: string;
}

// Minimal setup variant — used by gra-checkout-billing-payment, gra-place-order, gra-order-history.
// Only reads back available_shipping_methods; no address fields are echoed.
export const SET_SHIPPING_ADDRESSES_MUTATION = `
  mutation SetShippingAddressesOnCart($cartId: String!, $shippingAddresses: [ShippingAddressInput!]!) {
    setShippingAddressesOnCart(input: {
      cart_id: $cartId,
      shipping_addresses: $shippingAddresses
    }) {
      cart {
        shipping_addresses {
          available_shipping_methods {
            carrier_code
            method_code
            available
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

// Richer variant — echoes address fields back for assertions. Used only by gra-checkout-shipping,
// whose TC_01/TC_02 assertions depend on this selection set. Do NOT collapse into the minimal variant.
export const SET_SHIPPING_ADDRESSES_RICH_MUTATION = `
  mutation SetShippingAddressesOnCart($cartId: String!, $shippingAddresses: [ShippingAddressInput!]!) {
    setShippingAddressesOnCart(input: {
      cart_id: $cartId,
      shipping_addresses: $shippingAddresses
    }) {
      cart {
        shipping_addresses {
          firstname
          lastname
          street
          city
          region { label __typename }
          postcode
          country { label __typename }
          telephone
          available_shipping_methods {
            carrier_code
            method_code
            carrier_title
            method_title
            available
            amount { value currency __typename }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

// Superset selection set — gra-checkout-shipping reads selected_shipping_method fields;
// gra-checkout-billing-payment/gra-place-order/gra-order-history only need the mutation to
// succeed and ignore the extra fields.
export const SET_SHIPPING_METHODS_MUTATION = `
  mutation SetShippingMethodsOnCart($cartId: String!, $carrierCode: String!, $methodCode: String!) {
    setShippingMethodsOnCart(input: {
      cart_id: $cartId,
      shipping_methods: [{ carrier_code: $carrierCode, method_code: $methodCode }]
    }) {
      cart {
        shipping_addresses {
          selected_shipping_method {
            carrier_code
            method_code
            carrier_title
            method_title
            amount { value currency __typename }
            __typename
          }
          available_shipping_methods {
            carrier_code
            method_code
            available
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

// Superset selection set — gra-checkout-billing-payment reads the full billing_address echo;
// gra-place-order/gra-order-history only read firstname/lastname.
export const SET_BILLING_ADDRESS_MUTATION = `
  mutation SetBillingAddressOnCart($cartId: String!, $billingAddress: BillingAddressInput!) {
    setBillingAddressOnCart(input: {
      cart_id: $cartId,
      billing_address: $billingAddress
    }) {
      cart {
        billing_address {
          firstname
          lastname
          street
          city
          region { code label __typename }
          postcode
          country { code label __typename }
          telephone
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

export interface PaymentMethod {
  code: string;
  title: string;
}

export const GET_AVAILABLE_PAYMENT_METHODS_QUERY = `
  query GetAvailablePaymentMethods($cartId: String!) {
    cart(cart_id: $cartId) {
      available_payment_methods {
        code
        title
        __typename
      }
      __typename
    }
  }
`;

export const SET_PAYMENT_METHOD_MUTATION = `
  mutation SetPaymentMethodOnCart($cartId: String!, $paymentMethodCode: String!) {
    setPaymentMethodOnCart(input: {
      cart_id: $cartId,
      payment_method: { code: $paymentMethodCode }
    }) {
      cart {
        selected_payment_method {
          code
          title
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

export const PLACE_ORDER_MUTATION = `
  mutation PlaceOrder($cartId: String!) {
    placeOrder(input: { cart_id: $cartId }) {
      order { order_number __typename }
      __typename
    }
  }
`;
