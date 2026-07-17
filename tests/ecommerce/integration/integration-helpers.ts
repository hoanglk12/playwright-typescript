import type { Page, Route } from '@playwright/test';
import { Storefront } from '@data/ecommerce/storefronts';
import { AtcAnalyticsData } from '@data/ecommerce/analytics-events';
import { EcommercePDPPage } from '@pages/ecommerce/pdp-page';

export interface AddToCartMutationCart {
  items?: unknown[];
}

export interface AddToCartMutationResult {
  cart?: AddToCartMutationCart;
}

// The GraphQL field name for this mutation varies by product type/storefront build
// (`addConfigurableProductsToCart`, `addSimpleProductsToCart`, the unified
// `addProductsToCart`, etc — see AtcAnalyticsData.ATC_MUTATION_BODY_MATCHER for the
// confirmed-live discriminator). Since the interceptor already filters down to exactly the
// add-to-cart mutation, `data` is guaranteed to contain exactly one field regardless of its
// name — so the response is read positionally rather than by a hardcoded key.
export interface AddToCartMutationResponse {
  data?: Record<string, AddToCartMutationResult | undefined>;
}

export interface AdobeDataLayerEvent {
  event?: string;
  [key: string]: unknown;
}

interface WindowWithDataLayers {
  adobeDataLayer?: AdobeDataLayerEvent[];
  dataLayer?: AdobeDataLayerEvent[];
}

// Captured via an object wrapper (not a bare `let`) — reassigning a bare closed-over `let`
// from inside an async route handler defeats TypeScript's control-flow narrowing at the
// read site (reads as `never` under optional chaining). The wrapper sidesteps this.
export interface AddToCartCaptureState {
  payload: AddToCartMutationResponse | null;
}

export interface AddToCartCapture {
  state: AddToCartCaptureState;
  stop: () => Promise<void>;
}

const GRAPHQL_ROUTE_PATTERN = '**/graphql*';

/**
 * Registers a pass-through capture of the add-to-cart GraphQL mutation response.
 * All 8 GRA storefronts send this mutation as a bare `POST /graphql` request with the
 * query/operationName inside the JSON body — never as a `?operationName=` URL query param
 * (that shape is only used for GET-based GraphQL queries on these storefronts). The route
 * pattern must therefore match the bare endpoint, and the handler inspects the POST body
 * itself to decide whether a request is the target mutation. Every other request matching
 * `**\/graphql*` (GET queries, other POST mutations) passes through untouched.
 *
 * Returns `{ state, stop }` mirroring NetworkHelper.monitorNetworkRequests' `{ requests,
 * stop }` contract. Kept as a folder-scoped helper (one consumer today) — promote to a
 * factory fixture in base-test/ApiTest style when a second integration spec needs it.
 */
export async function createAddToCartCapture(page: Page): Promise<AddToCartCapture> {
  const state: AddToCartCaptureState = { payload: null };
  const handler = async (route: Route): Promise<void> => {
    const req = route.request();
    if (req.method() !== 'POST') {
      await route.continue();
      return;
    }
    let isTargetMutation = false;
    try {
      const body = req.postDataJSON() as { query?: string } | undefined;
      isTargetMutation =
        typeof body?.query === 'string' &&
        body.query.includes(AtcAnalyticsData.ATC_MUTATION_BODY_MATCHER);
    } catch {
      isTargetMutation = false;
    }
    if (!isTargetMutation) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    state.payload = await response.json();
    await route.fulfill({ response });
  };
  await page.route(GRAPHQL_ROUTE_PATTERN, handler);
  return {
    state,
    stop: (): Promise<void> => page.unroute(GRAPHQL_ROUTE_PATTERN, handler),
  };
}

// Blocks third-party noise routes for an integration test. See
// AtcAnalyticsData.NOISE_ROUTE_PATTERNS for why the list is deliberately restricted.
export async function applyNoiseRouteBlocks(page: Page): Promise<void> {
  for (const pattern of AtcAnalyticsData.NOISE_ROUTE_PATTERNS) {
    await page.route(pattern, (route) => route.abort());
  }
}

// Reads the add-to-cart event out of adobeDataLayer, falling back to dataLayer. An array
// scan (not adobeDataLayer.getState()) is required here: getState() returns the merged
// state object, which is always truthy, so a naive `getState() ?? dataLayer?.find(...)`
// fallback never triggers and would vacuously pass whether or not the event actually fired.
export async function getAddToCartDataLayerEvent(page: Page): Promise<AdobeDataLayerEvent | undefined> {
  return page.evaluate(
    ({ eventNames }) => {
      const win = window as unknown as WindowWithDataLayers;
      const matches = (e: AdobeDataLayerEvent | undefined): boolean =>
        !!e && typeof e.event === 'string' && eventNames.includes(e.event);
      const fromAdobe = win.adobeDataLayer?.find(matches);
      if (fromAdobe) return fromAdobe;
      return win.dataLayer?.find(matches);
    },
    { eventNames: [...AtcAnalyticsData.ATC_EVENT_NAMES] },
  );
}

// Extracts a product-name-like string from an add-to-cart event, trying the most likely
// field paths across GRA/Magento storefronts. Returns '' if none of the known paths match —
// callers should fall back to atcEventContainsProductName() for a broad contains check.
export function extractProductNameFromAtcEvent(event: AdobeDataLayerEvent | undefined): string {
  if (!event) return '';
  // Confirmed live path for GRA's `cart_add` ACDL event: cart_items is a top-level array
  // with a `name` field per line item.
  const cartItems = event['cart_items'];
  if (Array.isArray(cartItems) && cartItems.length > 0) {
    const firstItem = cartItems[0];
    if (firstItem && typeof firstItem === 'object') {
      const itemName = (firstItem as Record<string, unknown>)['name'];
      if (typeof itemName === 'string' && itemName.length > 0) return itemName;
    }
  }
  const directName = event['name'];
  if (typeof directName === 'string' && directName.length > 0) return directName;
  const product = event['product'];
  if (product && typeof product === 'object') {
    const productName = (product as Record<string, unknown>)['name'];
    if (typeof productName === 'string' && productName.length > 0) return productName;
  }
  const data = event['data'];
  if (data && typeof data === 'object') {
    const dataProduct = (data as Record<string, unknown>)['product'];
    if (dataProduct && typeof dataProduct === 'object') {
      const dataProductName = (dataProduct as Record<string, unknown>)['name'];
      if (typeof dataProductName === 'string' && dataProductName.length > 0) return dataProductName;
    }
  }
  return '';
}

// Broad fallback: checks whether productName appears anywhere in the serialized event
// payload, for storefronts whose ACDL event shape doesn't match either known field path.
export function atcEventContainsProductName(
  event: AdobeDataLayerEvent | undefined,
  productName: string,
): boolean {
  if (!event || productName.length === 0) return false;
  return JSON.stringify(event).toLowerCase().includes(productName.toLowerCase());
}

// Parses a price string (e.g. "$139.99") into a number, mirroring parsePriceToken in
// checkout.spec.ts. Returns null when no numeric value can be extracted.
export function parsePriceToken(token: string): number | null {
  const cleaned = token.replace(/[^0-9.]/g, '');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

// Vans AU/NZ Bloomreach popup (#popup.popup.visible, z-index 200) can intercept the cart
// icon click after ATC. Gated to Vans storefronts only so the other 6 storefronts never
// pay a wait for a selector that never appears.
export async function dismissVansPostAtcPopup(
  pdpPage: EcommercePDPPage,
  site: Storefront,
): Promise<void> {
  if (!site.name.toLowerCase().includes('vans')) return;
  await pdpPage.dismissPostAtcPopup();
}
