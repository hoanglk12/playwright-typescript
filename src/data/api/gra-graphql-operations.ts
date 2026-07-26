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

export const CREATE_CART_MUTATION = `mutation CreateCart { cartId: createEmptyCart }`;

// ── Customer read queries ──────────────────────────────────────────────────────
// Three distinct customer{} queries used across gra-my-details, gra-authentication, and
// gra-account-creation-signin. Each has a different selection set and none can be safely
// merged into one superset:
// - GET_CUSTOMER_ID_QUERY resolves a bare id only, when shared-state has none cached.
// - GET_CUSTOMER_QUERY (gra-authentication) is polled repeatedly in TC_02 to detect token
//   revocation — the poll treats *any* GraphQL error as the "revoked" signal, so it must
//   stay minimal (id + email only). Adding loyalty fields would break the poll on
//   non-loyalty brands (drm-au, van-au), which return a loyalty partial-error even for a
//   still-valid token, causing a false-positive "revoked" reading on iteration 1.
// - GET_CUSTOMER_DETAILS_QUERY (gra-account-creation-signin) intentionally reads the full
//   CustomerInformationFragment + CustomerLoyaltyFragment set and tolerates loyalty
//   partial-errors via assertNoCriticalErrors(gql, ['loyalty', 'loyalty_program_status']).
// Do NOT collapse these into one query.
export const GET_CUSTOMER_ID_QUERY = `
  query GetCustomerId {
    customer { id }
  }
`;

export const GET_CUSTOMER_QUERY = `
  query GetCustomer {
    customer {
      id
      email
    }
  }
`;

export const GET_CUSTOMER_DETAILS_QUERY = `
  query getCustomerDetails {
    customer {
      id
      ...CustomerInformationFragment
      ...CustomerLoyaltyFragment
      __typename
    }
  }

  fragment CustomerInformationFragment on Customer {
    id
    firstname
    lastname
    email
    phone_number
    date_of_birth
    is_subscribed
    gender
    apparel21_id
    is_qff_member
    qff_member_number
    __typename
  }

  fragment CustomerLoyaltyFragment on Customer {
    id
    loyalty_program_status
    loyalty {
      level {
        accrual_points
        auto_reward_threshold
        auto_reward_value
        description
        level_id
        level_point_bonus
        name
        sequence
        __typename
      }
      points_balance
      points_to_next_reward
      program {
        apply_reward_threshold
        description
        name
        __typename
      }
      rewards {
        available
        customer_reward_id
        expiry_date
        pending
        redeemed
        status
        total
        __typename
      }
      reward_account_id
      rewards_balance
      spend_value_to_next_reward
      positive_rewards_balance_message
      __typename
    }
    __typename
  }
`;

export interface SetNewsletterSubscriptionVariables {
  is_subscribed: boolean;
}

export interface SetLoyaltyAndNewsletterSubscriptionVariables {
  is_subscribed: boolean;
  loyalty_program_status?: boolean | null;
}

export interface UpdateFirstnameLastnameVariables {
  firstname?: string;
  lastname?: string;
}

export interface UpdateDateOfBirthVariables {
  date_of_birth?: string;
}

export interface UpdatePhoneNumberVariables {
  phone_number?: string;
}

export interface UpdateEmailVariables {
  email?: string;
}

// The following six mutations all invoke the updateCustomerV2 resolver with different input
// shapes: gra-my-details (SetNewsletterSubscription, SetLoyaltyAndNewsletterSubscription) and
// gra-customer-profile (UpdateFirstnameLastname, UpdateDateOfBirth, UpdatePhoneNumber,
// UpdateEmail). They are NOT merged into one mutation — each spec sends only its own input
// field(s) and reads back only the customer fields it asserts on; combining inputs would
// change what each test actually exercises.
// Note: ChangeCustomerPassword (gra-customer-profile) uses the separate
// changeCustomerPassword resolver, not updateCustomerV2, and is intentionally left local to
// that spec — it is not part of this cluster.
export const SET_NEWSLETTER_MUTATION = `
  mutation SetNewsletterSubscription($is_subscribed: Boolean!) {
    updateCustomerV2(input: {is_subscribed: $is_subscribed}) {
      customer {
        id
        is_subscribed
        __typename
      }
      __typename
    }
  }
`;

export const SET_LOYALTY_NEWSLETTER_MUTATION = `
  mutation SetLoyaltyAndNewsletterSubscription($is_subscribed: Boolean!, $loyalty_program_status: Boolean) {
    updateCustomerV2(input: {is_subscribed: $is_subscribed, loyalty_program_status: $loyalty_program_status}) {
      customer {
        id
        is_subscribed
        loyalty_program_status
        __typename
      }
      __typename
    }
  }
`;

export const UPDATE_NAME_MUTATION = `
  mutation UpdateFirstnameLastname($firstname: String, $lastname: String) {
    updateCustomerV2(input: {firstname: $firstname, lastname: $lastname}) {
      customer {
        id
        firstname
        lastname
        __typename
      }
      __typename
    }
  }
`;

export const UPDATE_DOB_MUTATION = `
  mutation UpdateDateOfBirth($date_of_birth: String) {
    updateCustomerV2(input: {date_of_birth: $date_of_birth}) {
      customer {
        id
        date_of_birth
        __typename
      }
      __typename
    }
  }
`;

export const UPDATE_PHONE_MUTATION = `
  mutation UpdatePhoneNumber($phone_number: String) {
    updateCustomerV2(input: {phone_number: $phone_number}) {
      customer {
        id
        __typename
      }
      __typename
    }
  }
`;

export const UPDATE_EMAIL_MUTATION = `
  mutation UpdateEmail($email: String) {
    updateCustomerV2(input: {email: $email}) {
      customer {
        id
        email
        __typename
      }
      __typename
    }
  }
`;

// Two distinct customer.addresses queries — kept as named variants, not merged.
// GET_CUSTOMER_ADDRESSES_FOR_ADDRESS_BOOK_QUERY (gra-my-details) reads company, middlename,
// custom_attributes, default_billing, and region.region, plus a top-level countries query —
// all asserted on directly by that spec. GET_CUSTOMER_ADDRESSES_QUERY (gra-checkout-shipping)
// is a lighter query used only to discover an existing saved address id inside a beforeAll
// hook, and reads region.region_code (not region.region). Both are single-use (no third
// caller), so merging would only add fields to each caller's request that it never reads,
// for no deduplication benefit.
export const GET_CUSTOMER_ADDRESSES_FOR_ADDRESS_BOOK_QUERY = `query GetCustomerAddressesForAddressBook{customer{id addresses{id ...CustomerAddressFragment __typename}__typename}countries{id full_name_locale __typename}}fragment CustomerAddressFragment on CustomerAddress{__typename id city company country_code default_billing default_shipping firstname lastname middlename postcode region{region __typename}custom_attributes{attribute_code value __typename}street telephone}`;

export const GET_CUSTOMER_ADDRESSES_QUERY = `
  query GetCustomerAddresses {
    customer {
      addresses {
        id
        firstname
        lastname
        street
        city
        region { region_code __typename }
        postcode
        country_code
        telephone
        default_shipping
        __typename
      }
      __typename
    }
  }
`;

// Two distinct createCustomerAddress mutations — kept as named variants, not merged.
// ADD_CUSTOMER_ADDRESS_MUTATION (gra-my-details) sends a single $address: CustomerAddressInput!
// object variable and reads back only id/__typename — that spec asserts on the address fields
// separately via GET_CUSTOMER_ADDRESSES_FOR_ADDRESS_BOOK_QUERY instead. CREATE_CUSTOMER_ADDRESS_MUTATION
// (gra-checkout-shipping) sends flat scalar variables and echoes back a richer selection set
// (firstname, lastname, street, city, region.region_code, postcode, country_code, telephone) that
// its beforeAll reads directly off the mutation response. Both call the same createCustomerAddress
// resolver, but with different call conventions and selection sets — do NOT merge them.
export const ADD_CUSTOMER_ADDRESS_MUTATION = `
  mutation AddNewCustomerAddressToAddressBook($address: CustomerAddressInput!) {
    createCustomerAddress(input: $address) {
      id
      __typename
    }
  }
`;

export const CREATE_CUSTOMER_ADDRESS_MUTATION = `
  mutation CreateCustomerAddress(
    $firstname: String!,
    $lastname: String!,
    $street: [String!]!,
    $city: String!,
    $region: CustomerAddressRegionInput,
    $postcode: String!,
    $country_code: CountryCodeEnum!,
    $telephone: String!,
    $default_shipping: Boolean,
    $default_billing: Boolean
  ) {
    createCustomerAddress(input: {
      firstname: $firstname,
      lastname: $lastname,
      street: $street,
      city: $city,
      region: $region,
      postcode: $postcode,
      country_code: $country_code,
      telephone: $telephone,
      default_shipping: $default_shipping,
      default_billing: $default_billing
    }) {
      id
      firstname
      lastname
      street
      city
      region { region_code __typename }
      postcode
      country_code
      telephone
      __typename
    }
  }
`;

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

export const SKU_DISCOVERY_DEFAULTS: Readonly<SkuDiscoveryOptions> = {
  searchTerms: ['', 'shoe', 'nike', 'a'],
  pageSize: 10,
};

// A strict superset of gra-wishlist's former local DiscoverWishlistProducts query
// (same $search/$pageSize variables, selecting only sku/name/__typename) — the extra
// stock_status/variants/currentPage fields are harmless since that spec only reads
// sku/name/__typename from the result.
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

export const GET_CART_ITEMS_QUERY = `
  query GetCartItems($cartId: String!) {
    cart(cart_id: $cartId) {
      items { id quantity product { sku __typename } __typename }
      total_quantity
      __typename
    }
  }
`;

export const APPLY_REWARD_POINTS_MUTATION = `
  mutation ApplyRewardPointsToCart($cartId: ID!) {
    applyRewardPointsToCart(cartId: $cartId) {
      cart {
        id
        applied_multiple_rewards {
          applied_amount
          applied_rewards {
            applied
            left
            reward_id
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

export const REMOVE_REWARD_POINTS_MUTATION = `
  mutation RemoveRewardPointsFromCart($cartId: ID!) {
    removeRewardPointsFromCart(cartId: $cartId) {
      cart {
        id
        applied_multiple_rewards {
          applied_amount
          __typename
        }
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

// Shared sub-selection of storeConfig fields, spread into two DIFFERENT root operations that
// are NOT merged: gra-catalog's GetStoreConfig (no variables, also reads locale/base_currency_code
// outside this fragment) and gra-support-features' GetDynamicData($cart_id) (requires a cart_id,
// reads dynamic_promo_blocks alongside storeConfig). Only the fields both callers actually read
// are included here — do not add fields one caller needs but not the other.
export const EWAVE_STORE_CONFIG_FRAGMENT = `fragment EwaveStoreConfigFragment on StoreConfig{id store_code ewave_dynamicpromoblocks_general_enable ewave_dynamicpromoblocks_discount_enable ewave_dynamicpromoblocks_gift_enable ewave_dynamicpromoblocks_message_enable __typename}`;
