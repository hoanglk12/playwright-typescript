import type { APIRequestContext } from '@playwright/test';
import { Storefront } from '@data/ecommerce/storefronts';
import { createFreshAccountCredentials, FreshAccountCredentials } from '@data/ecommerce/test-accounts';
import { EcommerceCartOverlayPage } from '@pages/ecommerce/cart-overlay-page';
import { EcommerceNavPage } from '@pages/ecommerce/nav-page';
import { EcommercePDPPage } from '@pages/ecommerce/pdp-page';
import { EcommercePLPPage } from '@pages/ecommerce/plp-page';
import { TIMEOUTS } from '../../../src/constants/timeouts';

const BRAND_CODES: Record<string, string> = {
  'Platypus AU': 'pla-au',
  'Platypus NZ': 'pla-nz',
  'Skechers AU': 'skx-au',
  'Skechers NZ': 'skx-nz',
  'Vans AU': 'van-au',
  'Vans NZ': 'van-nz',
  'Dr. Martens AU': 'drm-au',
  'Dr. Martens NZ': 'drm-nz',
};

const CREATE_CUSTOMER_MUTATION = `
  mutation CreateAccount(
    $email: String!,
    $firstname: String!,
    $lastname: String!,
    $password: String!,
    $phone_number: String!,
    $is_subscribed: Boolean!,
    $loyalty_program_status: Boolean,
    $order_number: String,
    $gender: Int,
    $date_of_birth: String
  ) {
    createCustomer(input: {
      email: $email,
      firstname: $firstname,
      lastname: $lastname,
      password: $password,
      phone_number: $phone_number,
      is_subscribed: $is_subscribed,
      loyalty_program_status: $loyalty_program_status,
      order_number: $order_number,
      gender: $gender,
      date_of_birth: $date_of_birth
    }) {
      customer {
        id
        firstname
        lastname
        email
        __typename
      }
    }
  }
`;

export interface AccountCreationResult {
  creds: FreshAccountCredentials;
  created: boolean;
  skipReason?: string;
}

// E2E-CHKOUT-009 — GraphQL sign-in mutation, used to obtain a fresh bearer token for the
// address-book read-back below. Kept separate from GraphQLClient/gra-test.ts (API-suite
// infrastructure, not available to UI specs) — mirrors createFreshAccountViaGraphQL's own raw
// request-fixture pattern in this file.
const GENERATE_CUSTOMER_TOKEN_MUTATION = `
  mutation GenerateCustomerToken($email: String!, $password: String!) {
    generateCustomerToken(email: $email, password: $password) {
      token
    }
  }
`;

const GET_CUSTOMER_ADDRESSES_QUERY = `
  query GetCustomerAddresses {
    customer {
      addresses {
        id
        firstname
        lastname
        default_shipping
      }
    }
  }
`;

interface CustomerAddressSummary {
  id: number;
  firstname: string;
  lastname: string;
  default_shipping: boolean;
}

export interface DefaultShippingAddressCheckResult {
  hasDefaultShippingAddress: boolean;
  matchedAddress: CustomerAddressSummary | null;
}

/**
 * Signs in fresh via GraphQL (never reuses a stored token) and confirms a saved address matching
 * `expectedFirstName`/`expectedLastName` is marked default_shipping. Used as the authoritative,
 * non-visual confirmation that EcommerceMyDetailsPage.setAsDefaultAddress() + submitNewAddress()
 * actually persisted the default flag server-side.
 */
export async function confirmDefaultShippingAddressViaGraphQL(
  request: APIRequestContext,
  site: Storefront,
  creds: { email: string; password: string },
  expectedFirstName: string,
  expectedLastName: string,
): Promise<DefaultShippingAddressCheckResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (site.storeHeader) headers['Store'] = site.storeHeader;

  const tokenResponse = await request.post(site.graphqlUrl, {
    headers,
    data: {
      query: GENERATE_CUSTOMER_TOKEN_MUTATION,
      variables: { email: creds.email, password: creds.password },
    },
  });
  const tokenBody = (await tokenResponse.json()) as {
    data?: { generateCustomerToken?: { token?: string } };
    errors?: Array<{ message?: string }>;
  };
  if (!tokenResponse.ok() || (tokenBody.errors?.length ?? 0) > 0) {
    return { hasDefaultShippingAddress: false, matchedAddress: null };
  }
  const token = tokenBody.data?.generateCustomerToken?.token;
  if (!token) {
    return { hasDefaultShippingAddress: false, matchedAddress: null };
  }

  const addressResponse = await request.post(site.graphqlUrl, {
    headers: { ...headers, Authorization: `Bearer ${token}` },
    data: { query: GET_CUSTOMER_ADDRESSES_QUERY },
  });
  const addressBody = (await addressResponse.json()) as {
    data?: { customer?: { addresses?: CustomerAddressSummary[] } };
    errors?: Array<{ message?: string }>;
  };
  if (!addressResponse.ok() || (addressBody.errors?.length ?? 0) > 0) {
    return { hasDefaultShippingAddress: false, matchedAddress: null };
  }
  const addresses = addressBody.data?.customer?.addresses ?? [];
  const matchedAddress =
    addresses.find(
      (addr) =>
        addr.default_shipping && addr.firstname === expectedFirstName && addr.lastname === expectedLastName,
    ) ?? null;

  return { hasDefaultShippingAddress: matchedAddress !== null, matchedAddress };
}

const GET_CUSTOMER_CART_QUERY = `
  query GetCustomerCart {
    customerCart {
      id
      items {
        id
        quantity
      }
    }
  }
`;

// Same UpdateCartItemsInput/updateCartItems shape as gra-cart-minicart.spec.ts's
// UPDATE_CART_ITEMS_MUTATION — quantity: 0 removes an item, confirmed live against
// the known-dirty Skechers AU QA account (2026-09-11).
const CLEAR_CART_ITEMS_MUTATION = `
  mutation ClearCartItems($input: UpdateCartItemsInput!) {
    updateCartItems(input: $input) {
      cart {
        items {
          id
          quantity
        }
      }
    }
  }
`;

interface CustomerCartItemSummary {
  id: string;
  quantity: number;
}

export interface CartClearResult {
  cleared: boolean;
  itemsRemoved: number;
  reason?: string;
}

const MAX_CLEAR_ATTEMPTS = 3;

function clearFailure(reason: string): CartClearResult {
  return { cleared: false, itemsRemoved: 0, reason };
}

/**
 * Clears every item from `credentials`' cart. RECON FINDING (live, 2026-09-11, against
 * the known-dirty Skechers AU QA account): a single pass does not always remove every item — one
 * leftover reappeared under a regenerated cart_item_id after its quantity-0 update, and needed a
 * second pass to actually clear. Each attempt therefore re-submits whatever the previous
 * mutation's own response reports as still present, up to `MAX_CLEAR_ATTEMPTS`, rather than
 * assuming one round trip is sufficient.
 *
 * Never throws and never asserts — an already-empty cart, an auth failure, or a leftover item
 * after all attempts are all valid non-fatal outcomes surfaced via the returned result. Callers
 * use this as precondition hygiene (log and continue), not a test assertion.
 */
export async function clearCustomerCartViaGraphQL(
  request: APIRequestContext,
  site: Storefront,
  credentials: { email: string; password: string },
): Promise<CartClearResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (site.storeHeader) headers['Store'] = site.storeHeader;

  try {
    const tokenResponse = await request.post(site.graphqlUrl, {
      headers,
      data: {
        query: GENERATE_CUSTOMER_TOKEN_MUTATION,
        variables: { email: credentials.email, password: credentials.password },
      },
      timeout: TIMEOUTS.API_RESPONSE,
    });
    const tokenBody = (await tokenResponse.json()) as {
      data?: { generateCustomerToken?: { token?: string } };
      errors?: Array<{ message?: string }>;
    };
    if (!tokenResponse.ok() || (tokenBody.errors?.length ?? 0) > 0) {
      return clearFailure(
        tokenBody.errors?.[0]?.message ?? `token request failed with HTTP ${tokenResponse.status()}`,
      );
    }
    const token = tokenBody.data?.generateCustomerToken?.token;
    if (!token) {
      return clearFailure('no token returned from generateCustomerToken');
    }
    const authHeaders = { ...headers, Authorization: `Bearer ${token}` };

    const cartResponse = await request.post(site.graphqlUrl, {
      headers: authHeaders,
      data: { query: GET_CUSTOMER_CART_QUERY },
      timeout: TIMEOUTS.API_RESPONSE,
    });
    const cartBody = (await cartResponse.json()) as {
      data?: { customerCart?: { id?: string; items?: CustomerCartItemSummary[] } };
      errors?: Array<{ message?: string }>;
    };
    if (!cartResponse.ok() || (cartBody.errors?.length ?? 0) > 0) {
      return clearFailure(
        cartBody.errors?.[0]?.message ?? `customerCart query failed with HTTP ${cartResponse.status()}`,
      );
    }
    const cartId = cartBody.data?.customerCart?.id;
    let remainingItems = cartBody.data?.customerCart?.items ?? [];
    const totalToRemove = remainingItems.length;
    if (!cartId || totalToRemove === 0) {
      return { cleared: true, itemsRemoved: 0 };
    }

    for (let attempt = 1; attempt <= MAX_CLEAR_ATTEMPTS && remainingItems.length > 0; attempt++) {
      const clearResponse = await request.post(site.graphqlUrl, {
        headers: authHeaders,
        data: {
          query: CLEAR_CART_ITEMS_MUTATION,
          variables: {
            input: {
              cart_id: cartId,
              cart_items: remainingItems.map((item) => ({ cart_item_id: Number(item.id), quantity: 0 })),
            },
          },
        },
        timeout: TIMEOUTS.API_RESPONSE,
      });
      const clearBody = (await clearResponse.json()) as {
        data?: { updateCartItems?: { cart?: { items?: CustomerCartItemSummary[] } } };
        errors?: Array<{ message?: string }>;
      };
      if (!clearResponse.ok() || (clearBody.errors?.length ?? 0) > 0) {
        return clearFailure(
          clearBody.errors?.[0]?.message ??
            `updateCartItems mutation failed with HTTP ${clearResponse.status()} (started with ${totalToRemove} item(s))`,
        );
      }
      remainingItems = clearBody.data?.updateCartItems?.cart?.items ?? [];
    }

    if (remainingItems.length > 0) {
      // IDs can regenerate between passes (see docblock above), so a leftover count cannot be
      // reliably diffed against totalToRemove — report both counts as observed instead.
      return clearFailure(
        `${remainingItems.length} of ${totalToRemove} item(s) still in cart after ${MAX_CLEAR_ATTEMPTS} clear attempts`,
      );
    }

    return { cleared: true, itemsRemoved: totalToRemove };
  } catch (error) {
    return clearFailure(error instanceof Error ? error.message : String(error));
  }
}

/**
 * When `preferMens` is true (Skechers, Vans NZ) the MENS nav is tried first
 * because the WOMENS PLP does not lead to footwear with size selectors.
 */
export function getPreferredNavLabel(site: Storefront, preferMens = false): string | undefined {
  if (preferMens) {
    return site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel;
  }
  return site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel;
}

/**
 * The "Steps 1-5" referenced by spec logger.step labels: navigate → waitForNavHydration →
 * clickNavLink → waitForPlpUrl → waitForProductGrid.
 */
export async function navigateToPlp(
  navPage: EcommerceNavPage,
  plpPage: EcommercePLPPage,
  site: Storefront,
  navLabel: string,
): Promise<void> {
  await navPage.navigate(site.url);
  await navPage.waitForNavHydration();
  await navPage.clickNavLink(navLabel);
  await plpPage.waitForPlpUrl();
  await plpPage.waitForProductGrid();
}

/**
 * Returns true for storefronts where the MENS nav must be preferred over WOMENS
 * to reach footwear PDPs with size selectors (Skechers, Vans NZ).
 */
export function shouldPreferMens(site: Storefront): boolean {
  const name = site.name.toLowerCase();
  return name.includes('skechers') || name.includes('vans nz');
}

/**
 * The caller must call test.skip() and return when `created` is false.
 */
export async function createFreshAccountViaGraphQL(
  request: APIRequestContext,
  site: Storefront,
): Promise<AccountCreationResult> {
  const brandCode = BRAND_CODES[site.name] ?? site.name.toLowerCase().replace(/\s+/g, '-');
  const creds = createFreshAccountCredentials(brandCode);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (site.storeHeader) headers['Store'] = site.storeHeader;
  const response = await request.post(site.graphqlUrl, {
    headers,
    data: {
      query: CREATE_CUSTOMER_MUTATION,
      variables: {
        email: creds.email,
        firstname: creds.firstname,
        lastname: creds.lastname,
        password: creds.password,
        phone_number: creds.phone_number,
        is_subscribed: false,
        loyalty_program_status: false,
        order_number: null,
        gender: null,
        date_of_birth: null,
      },
    },
  });
  const body = await response.json() as { errors?: Array<{ message?: string }> };
  if (!response.ok() || (body.errors?.length ?? 0) > 0) {
    const skipReason = body.errors?.[0]?.message ?? `HTTP ${response.status()}`;
    return { creds, created: false, skipReason };
  }
  return { creds, created: true };
}

export async function ensureCartOverlayOpen(cartOverlayPage: EcommerceCartOverlayPage): Promise<void> {
  const autoOpened = await cartOverlayPage.isOverlayVisible();
  if (!autoOpened) {
    await cartOverlayPage.clickCartIcon();
    await cartOverlayPage.waitForOverlayVisible();
  }
}

/**
 * Fast in-loop check per product; post-loop waitForSizeButtonsToRender() covers async rendering lag.
 * An empty result means no purchasable product found; caller must test.skip().
 */
export async function findProductWithAvailableSizes(
  plpPage: EcommercePLPPage,
  pdpPage: EcommercePDPPage,
  maxProducts = 10,
): Promise<string[]> {
  let availableSizes: string[] = [];
  for (let i = 0; i < maxProducts; i++) {
    if (i > 0) {
      // WHY: return-to-PLP after goBack(), not initial nav from homepage.
      // navigateToPlp() would break the scan loop by re-navigating from the homepage.
      await pdpPage.goBack();
      await plpPage.waitForPlpUrl();
      await plpPage.waitForProductGrid();
    }
    await plpPage.clickProductCard(i);
    await pdpPage.waitForPdpLoad();
    await pdpPage.ensureNoOverlay();
    availableSizes = await pdpPage.getAvailableSizes();
    if (availableSizes.length > 0) break;
  }
  if (availableSizes.length === 0) {
    await pdpPage.waitForSizeButtonsToRender();
    availableSizes = await pdpPage.getAvailableSizes();
  }
  return availableSizes;
}

/**
 * Returns the swatch count on the last PDP visited. A result < 2 means no multi-colour
 * product was found; caller must test.skip().
 */
export async function findPdpWithColourSwatches(
  plpPage: EcommercePLPPage,
  pdpPage: EcommercePDPPage,
  maxProducts = 10,
): Promise<number> {
  let swatchCount = 0;
  for (let i = 0; i < maxProducts; i++) {
    await plpPage.clickProductCard(i);
    await pdpPage.waitForPdpLoad();
    swatchCount = await pdpPage.getColourSwatchCount();
    if (swatchCount >= 2) break;
    if (i < maxProducts - 1) {
      await pdpPage.goBack();
      await plpPage.waitForPlpUrl();
      await plpPage.waitForProductGrid();
    }
  }
  return swatchCount;
}

/**
 * Returns true when two size labels are identical or when one is a token-boundary substring
 * of the other (e.g. "8" within "8.5"). Used to guard against treating two candidates as
 * distinct sizes when a plain substring check would wrongly flag them (or wrongly pass them —
 * a naive `.includes()` would also skip genuinely distinct sizes like "4" vs "14"). Boundaries
 * are non-word characters (`[^\w]`, so a dot IS a boundary) — this exactly mirrors the
 * `tokenPattern` boundary class used by `overlayContainsSizeLabel` on
 * `EcommerceCartOverlayPage`, so any sizeB that would false-match sizeA's overlay line is
 * correctly caught here too.
 */
export function sizesOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const escapedA = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedB = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const aTokenInB = new RegExp(`(^|[^\\w])${escapedA}([^\\w]|$)`).test(b);
  const bTokenInA = new RegExp(`(^|[^\\w])${escapedB}([^\\w]|$)`).test(a);
  return aTokenInB || bTokenInA;
}

/**
 * Caller must call test.skip() and return when null is returned.
 * Do NOT use for tests that call addToCart() immediately inside the isAddToCartEnabled check
 * (Vans AU hot-path pattern — keep those loops inline to minimise the timing window).
 */
export async function selectFirstPurchasableSize(
  pdpPage: EcommercePDPPage,
  sizes: string[],
  maxToTry = 3,
): Promise<string | null> {
  for (const size of sizes.slice(0, maxToTry)) {
    await pdpPage.selectSize(size);
    if (await pdpPage.isAddToCartEnabled()) {
      return size;
    }
  }
  return null;
}
