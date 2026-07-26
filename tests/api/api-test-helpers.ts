import { expect, request, APIRequestContext } from '@playwright/test';
import { GraphQLClient } from '../../src/api/GraphQLClient';
import { SiteContext } from '../../src/data/api/sites';
import { TestState } from './shared-state';
import { TestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { BraintreeTestCard } from '../../src/data/api/gra-braintree-payment-data';
import {
  SIGN_IN_MUTATION,
  CREATE_ACCOUNT_MUTATION,
  CREATE_CART_MUTATION,
  GET_PRODUCTS_QUERY,
  ADD_PRODUCTS_MUTATION,
  REMOVE_ITEM_MUTATION,
  SET_SHIPPING_ADDRESSES_MUTATION,
  SET_SHIPPING_METHODS_MUTATION,
  SET_BILLING_ADDRESS_MUTATION,
  GET_AVAILABLE_PAYMENT_METHODS_QUERY,
  CREATE_BRAINTREE_CLIENT_TOKEN_MUTATION,
  SET_BRAINTREE_PAYMENT_METHOD_MUTATION,
  ProductItem,
  ShippingMethod,
  PaymentMethod,
  CartAddressInput,
} from '../../src/data/api/gra-graphql-operations';

/**
 * Always authenticates fresh — never reuses an existing shared-state token.
 * Per tests/api/CLAUDE.md: "Never reuse getCustomerToken() from shared-state."
 */
export async function signInAndStoreToken(
  client: GraphQLClient,
  logger: TestLogger,
  site: SiteContext,
  state: TestState,
): Promise<string> {
  const { email, password, remember } = site.testData.validCredentials;
  const signInVars = { email, password, remember };

  logger.step('Auth: sign in fresh to obtain a valid token');
  const signInGql = await (
    await client.mutateWrapped(SIGN_IN_MUTATION, signInVars)
  ).getGraphQLResponse();

  if (!(signInGql.errors?.length)) {
    const token: string = signInGql.data?.generateCustomerToken?.token ?? '';
    if (!token) throw new Error('signInAndStoreToken: sign-in succeeded but token was missing');
    state.setCustomerToken(token);
    logger.action('Fresh token acquired', '');
    return token;
  }

  logger.step('Auth: sign-in failed — creating account first');
  const createGql = await (
    await client.mutateWrapped(CREATE_ACCOUNT_MUTATION, site.testData.validCustomer)
  ).getGraphQLResponse();

  if ((createGql.errors?.length ?? 0) > 0) {
    const msg = createGql.errors![0]?.message ?? '';
    if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exists')) {
      throw new Error(`signInAndStoreToken: account creation failed: ${msg}`);
    }
    logger.action('Account already exists — proceeding to sign in', '');
  }

  const retryGql = await (
    await client.mutateWrapped(SIGN_IN_MUTATION, signInVars)
  ).getGraphQLResponse();

  if ((retryGql.errors?.length ?? 0) > 0) {
    throw new Error(
      `signInAndStoreToken: sign-in failed after account creation: ${retryGql.errors![0]?.message ?? 'unknown'}`,
    );
  }

  const retryToken: string = retryGql.data?.generateCustomerToken?.token ?? '';
  if (!retryToken) throw new Error('signInAndStoreToken: sign-in after account creation returned no token');
  state.setCustomerToken(retryToken);
  logger.action('Token acquired after account creation', '');
  return retryToken;
}

export interface GqlWithUserErrors {
  user_errors?: { message?: string }[];
}

/**
 * Checks both top-level GraphQL errors and mutation-level user_errors (Magento's
 * business-logic error convention). Per tests/api/CLAUDE.md "Wishlist — Error Shape".
 */
export function wasRejected(
  gql: { errors?: { message?: string }[]; data?: Record<string, GqlWithUserErrors | undefined> },
  opName: string,
): boolean {
  if ((gql.errors?.length ?? 0) > 0) return true;
  const userErrors = gql.data?.[opName]?.user_errors;
  return Array.isArray(userErrors) && userErrors.length > 0;
}

/**
 * Asserts no GraphQL errors are present, tolerating errors whose `path` matches one of
 * ignorePaths (e.g. PLA staging's broken price_range data, or non-loyalty brands' loyalty
 * fields). Callers pass only the paths relevant to their own query — lists are not merged.
 */
export function assertNoCriticalErrors(
  gql: { errors?: Array<{ path?: unknown }> },
  ignorePaths: string[],
): void {
  const criticalErrors = (gql.errors ?? []).filter(
    (e) => !(Array.isArray(e.path) && (e.path as string[]).some((p) => ignorePaths.includes(p))),
  );
  expect(criticalErrors, 'unexpected GraphQL errors').toHaveLength(0);
}

export async function createFreshCart(
  client: GraphQLClient,
  logger?: TestLogger,
): Promise<string> {
  const cartGql = await (await client.mutateWrapped(CREATE_CART_MUTATION)).getGraphQLResponse();
  if (cartGql.errors?.length) {
    throw new Error(`createFreshCart: createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`);
  }
  const cartId: string = cartGql.data?.cartId ?? '';
  if (!cartId) throw new Error('createFreshCart: cartId is empty after createEmptyCart');
  logger?.action('Cart created', cartId);
  return cartId;
}

/**
 * Never throws — an empty result is a valid outcome the caller inspects and reacts to.
 */
export async function discoverInStockSkus(
  client: GraphQLClient,
  opts?: { searchTerms?: string[]; minCandidates?: number; pageSize?: number },
): Promise<string[]> {
  const searchTerms = opts?.searchTerms ?? ['', 'shoe', 'nike', 'a'];
  const minCandidates = opts?.minCandidates ?? 3;
  const pageSize = opts?.pageSize ?? 20;

  const candidateSkus: string[] = [];
  for (const term of searchTerms) {
    const productsData = await (await client.queryWrapped(GET_PRODUCTS_QUERY, { search: term, pageSize })).getData();
    const items: ProductItem[] = productsData?.products?.items ?? [];

    for (const item of items) {
      if (item.stock_status === 'IN_STOCK' && item.__typename === 'SimpleProduct') {
        if (!candidateSkus.includes(item.sku)) candidateSkus.push(item.sku);
      } else if (item.__typename === 'ConfigurableProduct' && Array.isArray(item.variants)) {
        for (const v of item.variants) {
          if (v.product?.stock_status === 'IN_STOCK' && !candidateSkus.includes(v.product.sku)) {
            candidateSkus.push(v.product.sku);
          }
        }
      }
      // No fallback to item.sku — parent configurable SKUs are not addable to cart
    }
    if (candidateSkus.length >= minCandidates) break;
  }
  return candidateSkus;
}

export interface AddedProduct {
  sku: string;
  cartItemId: number | null;
  added: boolean;
}

/**
 * Never throws for "no candidate worked" — callers inspect result.added and react (e.g. throw
 * their own contextual error).
 */
export async function addFirstAddableProduct(
  client: GraphQLClient,
  cartId: string,
  candidateSkus: string[],
  opts?: { removeAfterProbe?: boolean },
  logger?: TestLogger,
): Promise<AddedProduct> {
  for (const sku of candidateSkus) {
    const addGql = await (await client.mutateWrapped(ADD_PRODUCTS_MUTATION, {
      cartId,
      cartItems: [{ sku, quantity: 1 }],
    })).getGraphQLResponse();

    if (!wasRejected(addGql, 'addProductsToCart')) {
      const items: { id: number; product: { sku: string } }[] = addGql.data?.addProductsToCart?.cart?.items ?? [];
      const addedItem = items.find((i) => i.product.sku === sku);
      let cartItemId: number | null = addedItem?.id ?? null;

      if (opts?.removeAfterProbe && cartItemId !== null) {
        await client.mutateWrapped(REMOVE_ITEM_MUTATION, {
          input: { cart_id: cartId, cart_item_id: cartItemId },
        });
        cartItemId = null;
      }

      logger?.action('SKU verified addable', sku);
      return { sku, cartItemId, added: true };
    }

    const userErrors = addGql.data?.addProductsToCart?.user_errors ?? [];
    logger?.action(`SKU ${sku} not addable`, userErrors[0]?.message ?? addGql.errors?.[0]?.message ?? 'unknown');
  }

  return { sku: '', cartItemId: null, added: false };
}

export type ShippingMethodLite = ShippingMethod;

export interface ShippingAddressResult {
  ok: boolean;
  availableMethods: ShippingMethodLite[];
  error?: string;
}

/**
 * Uses the minimal SET_SHIPPING_ADDRESSES_MUTATION variant (available_shipping_methods only).
 * gra-checkout-shipping uses SET_SHIPPING_ADDRESSES_RICH_MUTATION directly instead (echoes address
 * fields back for its assertions) — do not migrate that spec onto this helper.
 */
export async function setShippingAddressOnCart(
  client: GraphQLClient,
  cartId: string,
  address: CartAddressInput,
  logger?: TestLogger,
): Promise<ShippingAddressResult> {
  const gql = await (await client.mutateWrapped(SET_SHIPPING_ADDRESSES_MUTATION, {
    cartId,
    shippingAddresses: [{ address: { ...address, save_in_address_book: false } }],
  })).getGraphQLResponse();

  if (gql.errors?.length) {
    const error = gql.errors[0]?.message ?? 'unknown';
    logger?.action('Shipping address setup failed', error);
    return { ok: false, availableMethods: [], error };
  }

  const availableMethods: ShippingMethodLite[] =
    gql.data?.setShippingAddressesOnCart?.cart?.shipping_addresses?.[0]?.available_shipping_methods ?? [];
  return { ok: true, availableMethods };
}

export interface ShippingMethodResult {
  ok: boolean;
  selected?: { carrierCode: string; methodCode: string };
  error?: string;
}

/**
 * Prefers flatrate_flatrate, else the first available method that isn't instore_pickup.
 * Per tests/api/CLAUDE.md: instore_pickup + placeOrder fails with "Quote does not have Pickup
 * Location assigned" — preferFlatrate defaults true so callers that go on to placeOrder are safe.
 */
export async function selectShippingMethod(
  client: GraphQLClient,
  cartId: string,
  availableMethods: ShippingMethodLite[],
  opts?: { preferFlatrate?: boolean; excludeInstorePickup?: boolean },
  logger?: TestLogger,
): Promise<ShippingMethodResult> {
  const preferFlatrate = opts?.preferFlatrate ?? true;
  const excludeInstorePickup = opts?.excludeInstorePickup ?? true;

  let target: ShippingMethodLite | undefined;
  if (preferFlatrate) {
    target = availableMethods.find((m) => m.available && m.carrier_code === 'flatrate');
  }
  if (!target) {
    target = availableMethods.find((m) => m.available && !(excludeInstorePickup && m.carrier_code === 'instore_pickup'));
  }

  if (!target) {
    return { ok: false, error: 'No suitable shipping method available' };
  }

  const gql = await (await client.mutateWrapped(SET_SHIPPING_METHODS_MUTATION, {
    cartId,
    carrierCode: target.carrier_code,
    methodCode: target.method_code,
  })).getGraphQLResponse();

  if (gql.errors?.length) {
    const error = gql.errors[0]?.message ?? 'unknown';
    logger?.action('Shipping method setup failed', error);
    return { ok: false, error };
  }

  logger?.action('Shipping method set', `${target.carrier_code}_${target.method_code}`);
  return { ok: true, selected: { carrierCode: target.carrier_code, methodCode: target.method_code } };
}

export interface BillingResult {
  ok: boolean;
  error?: string;
}

export async function setBillingAddress(
  client: GraphQLClient,
  cartId: string,
  billing: { sameAsShipping: true } | { address: CartAddressInput },
  logger?: TestLogger,
): Promise<BillingResult> {
  const billingAddress =
    'sameAsShipping' in billing
      ? { same_as_shipping: true }
      : { address: { ...billing.address, save_in_address_book: false } };

  const gql = await (await client.mutateWrapped(SET_BILLING_ADDRESS_MUTATION, { cartId, billingAddress })).getGraphQLResponse();

  if (gql.errors?.length) {
    const error = gql.errors[0]?.message ?? 'unknown';
    logger?.action('Billing address setup failed', error);
    return { ok: false, error };
  }
  return { ok: true };
}

export async function getAvailablePaymentCodes(client: GraphQLClient, cartId: string): Promise<string[]> {
  const data = await (await client.queryWrapped(GET_AVAILABLE_PAYMENT_METHODS_QUERY, { cartId })).getData();
  const methods: PaymentMethod[] = data?.cart?.available_payment_methods ?? [];
  return methods.map((m) => m.code);
}

// ── Braintree credit-card flow ─────────────────────────────────────────────────
// createBraintreeClientToken -> tokenizeCreditCard (Braintree's own GraphQL API, not the
// storefront one) -> setPaymentMethodOnCart. Verified working against sandbox during
// technical research; introspection is disabled on staging so this was derived by live
// probing, not documentation.

export interface BraintreeGraphQLConfig {
  url: string;
  date: string;
  features?: string[];
}

export interface BraintreeClientConfig {
  authorizationFingerprint: string;
  environment: string;
  merchantId?: string;
  merchantAccountId?: string;
  graphQL: BraintreeGraphQLConfig;
}

export async function getBraintreeClientConfig(
  client: GraphQLClient,
  logger?: TestLogger,
): Promise<BraintreeClientConfig> {
  const gql = await (await client.mutateWrapped(CREATE_BRAINTREE_CLIENT_TOKEN_MUTATION)).getGraphQLResponse();
  if (gql.errors?.length) {
    throw new Error(`getBraintreeClientConfig: createBraintreeClientToken failed: ${gql.errors[0]?.message ?? 'unknown'}`);
  }

  const rawToken: string = gql.data?.createBraintreeClientToken ?? '';
  if (!rawToken) throw new Error('getBraintreeClientConfig: createBraintreeClientToken returned an empty token');

  const config = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8')) as BraintreeClientConfig;

  // Mandatory safety guard: the only thing preventing a real charge if environment config
  // ever changes. Always throws (never a skip-signal) — a non-sandbox token must fail loudly.
  if (config.environment !== 'sandbox') {
    throw new Error(
      `getBraintreeClientConfig: refusing to proceed — client token environment is "${config.environment}", expected "sandbox"`,
    );
  }

  // Structural check, not defensive padding: without it a token missing the graphQL block
  // throws inside tokenizeCard's try and is misclassified as transport_error → silent skip.
  if (!config.graphQL?.url || !config.graphQL?.date) {
    throw new Error('getBraintreeClientConfig: decoded client token has no graphQL.url/date block');
  }

  logger?.action('Braintree client token decoded', `environment=${config.environment}`);
  return config;
}

const BRAINTREE_TOKENIZE_CREDIT_CARD_MUTATION = `
  mutation TokenizeCreditCard($input: TokenizeCreditCardInput!) {
    tokenizeCreditCard(input: $input) {
      token
      creditCard {
        bin
        last4
        __typename
      }
      __typename
    }
  }
`;

export type BraintreeTokenizeResult =
  | { outcome: 'success'; nonce: string }
  | { outcome: 'rejected'; error: string }
  | { outcome: 'transport_error'; error: string };

interface BraintreeTokenizeResponse {
  data?: { tokenizeCreditCard?: { token?: string } };
  errors?: { message?: string }[];
}

/**
 * Distinguishes a gateway rejection (bad card, malformed input — the calling test should fail)
 * from a transport/network failure (gateway unreachable — the calling test should skip). Both
 * are distinct from `getBraintreeClientConfig`'s environment check, which always throws.
 */
export async function tokenizeCard(
  config: BraintreeClientConfig,
  card: BraintreeTestCard,
  logger?: TestLogger,
): Promise<BraintreeTokenizeResult> {
  let context: APIRequestContext | undefined;
  try {
    context = await request.newContext({ timeout: TIMEOUTS.API_RESPONSE });

    const response = await context.post(config.graphQL.url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.authorizationFingerprint}`,
        'Braintree-Version': config.graphQL.date,
      },
      data: {
        query: BRAINTREE_TOKENIZE_CREDIT_CARD_MUTATION,
        variables: {
          input: {
            creditCard: {
              number: card.number,
              expirationMonth: card.expirationMonth,
              expirationYear: card.expirationYear,
              cvv: card.cvv,
            },
          },
        },
      },
    });

    const body = (await response.json()) as BraintreeTokenizeResponse;
    const nonce = body.data?.tokenizeCreditCard?.token;

    if (nonce) {
      logger?.action('Braintree card tokenized', 'nonce acquired');
      return { outcome: 'success', nonce };
    }

    const error =
      body.errors?.[0]?.message ?? `Braintree tokenizeCreditCard returned no token (status ${response.status()})`;
    logger?.action('Braintree tokenization rejected', error);
    return { outcome: 'rejected', error };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger?.action('Braintree tokenization transport error', error);
    return { outcome: 'transport_error', error };
  } finally {
    if (context) await context.dispose();
  }
}

export interface BraintreePaymentResult {
  ok: boolean;
  error?: string;
}

export async function setBraintreePaymentMethod(
  client: GraphQLClient,
  cartId: string,
  nonce: string,
  logger?: TestLogger,
): Promise<BraintreePaymentResult> {
  const gql = await (await client.mutateWrapped(SET_BRAINTREE_PAYMENT_METHOD_MUTATION, {
    cartId,
    nonce,
  })).getGraphQLResponse();

  if (gql.errors?.length) {
    const error = gql.errors[0]?.message ?? 'unknown';
    logger?.action('Braintree payment method setup failed', error);
    return { ok: false, error };
  }

  logger?.action('Braintree payment method set', 'braintree');
  return { ok: true };
}
