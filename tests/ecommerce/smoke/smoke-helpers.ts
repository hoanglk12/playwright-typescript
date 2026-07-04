import type { APIRequestContext } from '@playwright/test';
import { Storefront } from '@data/ecommerce/storefronts';
import { createFreshAccountCredentials, FreshAccountCredentials } from '@data/ecommerce/test-accounts';
import { EcommerceCartOverlayPage } from '@pages/ecommerce/cart-overlay-page';
import { EcommerceNavPage } from '@pages/ecommerce/nav-page';
import { EcommercePDPPage } from '@pages/ecommerce/pdp-page';
import { EcommercePLPPage } from '@pages/ecommerce/plp-page';

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

/**
 * Returns the preferred nav label for a site.
 * When `preferMens` is true (Skechers, Vans NZ) the MENS nav is tried first
 * because the WOMENS PLP does not lead to footwear with size selectors.
 * Defaults to WOMENS → MENS → SALE fallback chain.
 */
export function getPreferredNavLabel(site: Storefront, preferMens = false): string | undefined {
  if (preferMens) {
    return site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel;
  }
  return site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel;
}

/**
 * Navigates from the storefront homepage to a PLP via `navLabel`.
 * Executes the standard 5-step navigation: navigate → waitForNavHydration →
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
 * Creates a fresh GRA customer account via the storefront GraphQL API.
 * Returns the generated credentials and whether creation succeeded.
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

/**
 * Opens the mini cart overlay if it did not auto-open after an ATC action.
 */
export async function ensureCartOverlayOpen(cartOverlayPage: EcommerceCartOverlayPage): Promise<void> {
  const autoOpened = await cartOverlayPage.isOverlayVisible();
  if (!autoOpened) {
    await cartOverlayPage.clickCartIcon();
    await cartOverlayPage.waitForOverlayVisible();
  }
}

/**
 * Scans the current PLP for a product with available (non-sold-out) sizes.
 * Fast in-loop check per product; post-loop waitForSizeButtonsToRender() covers async rendering lag.
 * Returns the sizes array — empty means no purchasable product found; caller must test.skip().
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
 * Selects the first size from `sizes` that enables the Add to Cart button.
 * Returns the selected size string, or null if none of the tried sizes enabled ATC.
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
