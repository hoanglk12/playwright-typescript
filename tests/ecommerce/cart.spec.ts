/**
 * E2E Cart Tests — Platypus / Skechers / Vans / Dr. Martens storefronts
 *
 * E2E-CART-010: Promo/discount code field is visible at checkout entry
 *   Priority: P1  Phase: 2  Sites: All
 *
 * Requires a cart with at least one item — seeded via GraphQL API in beforeEach.
 * An empty cart redirects away from checkout (discovery report §3, constraint 1).
 *
 * Auth strategy: signInAndStoreToken (create account if needed, then sign in fresh).
 */

import { test, expect } from '@playwright/test';
import { GraphQLClient } from '../../src/api/GraphQLClient';
import { getApiEnvironment } from '../../src/api/config/environment';
import { siteRegistry, SiteContext } from '../../src/data/api/sites';
import { TestState } from '../api/shared-state';
import { signInAndStoreToken } from '../api/api-test-helpers';
import { EcommerceCheckoutPage } from '../../src/pages/ecommerce/checkout-page';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';

// ── GraphQL operations ────────────────────────────────────────────────────────

const GET_PRODUCTS_QUERY = `
  query GetTestProducts($search: String!) {
    products(search: $search, pageSize: 10, currentPage: 1) {
      items {
        sku
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

const CREATE_CART_MUTATION = `mutation CreateCart { cartId: createEmptyCart }`;

const ADD_PRODUCTS_MUTATION = `
  mutation AddProductsToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
    addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
      cart { total_quantity __typename }
      user_errors { code message __typename }
      __typename
    }
  }
`;

// ── Local types ───────────────────────────────────────────────────────────────

interface ProductVariant {
  product: { sku: string; stock_status: string; __typename: string };
}

interface ProductItem {
  sku: string;
  stock_status: string;
  __typename: string;variants?: ProductVariant[];
}

interface UserError {
  code: string;
  message: string;
}

// ── Helper: resolve SiteContext from Playwright project name ──────────────────

function resolveSiteContext(projectName: string): SiteContext {
  // Maps playwright.config.ts project names to siteRegistry keys.
  // Falls back to 'pla-au' when running without a multi-project config.
  const projectToSiteCode: Record<string, string> = {
    'platypus-au':  'pla-au',
    'platypus-nz':  'pla-nz',
    'skechers-au':  'skx-au',
    'skechers-nz':  'skx-nz',
    'vans-au':      'van-au',
    'vans-nz':      'van-nz',
    'drmartens-au': 'drm-au',
    'drmartens-nz': 'drm-nz',
  };
  const siteCode = projectToSiteCode[projectName] ?? 'pla-au';
  const ctx = siteRegistry[siteCode];
  if (!ctx) {
    throw new Error(
      `resolveSiteContext: unknown siteCode "${siteCode}" — add it to siteRegistry in sites.ts`,
    );
  }
  return ctx;
}

// ── Helper: seed a cart with one in-stock item via GraphQL API ────────────────

async function seedCartWithItem(
  site: SiteContext,
  token: string,
): Promise<{ cartId: string; sku: string }> {
  const apiEnv = getApiEnvironment();
  const authClient = new GraphQLClient({
    baseURL: site.baseURL,
    timeout: apiEnv.timeout,
    authType: AuthType.BEARER,
    token,
    ...(site.storeHeader ? { customHeaders: { Store: site.storeHeader } } : {}),
  });
  await authClient.init();

  try {
    // 1. Create cart
    const cartGql = await (
      await authClient.mutateWrapped(CREATE_CART_MUTATION)
    ).getGraphQLResponse();
    if (cartGql.errors?.length) {
      throw new Error(
        `seedCartWithItem: createEmptyCart failed: ${cartGql.errors[0]?.message ?? 'unknown'}`,
      );
    }
    const cartId: string = cartGql.data?.cartId ?? '';
    if (!cartId) throw new Error('seedCartWithItem: cartId is empty after createEmptyCart');

    // 2. Find an in-stock SKU (mirrors beforeAll discovery in gra-cart-minicart.spec.ts)
    let validSku = '';
    for (const term of ['', 'shoe', 'a']) {
      const res = await authClient.queryWrapped(GET_PRODUCTS_QUERY, { search: term });
      const items: ProductItem[] = (await res.getData())?.products?.items ?? [];
      for (const item of items) {
        if (item.stock_status === 'IN_STOCK' && item.__typename === 'SimpleProduct') {
          validSku = item.sku;
          break;
        }
        if (item.__typename === 'ConfigurableProduct' && Array.isArray(item.variants)) {
          const inStock = item.variants.find((v) => v.product?.stock_status === 'IN_STOCK');
          if (inStock) {
            validSku = inStock.product.sku;
            break;
          }
        }
      }
      if (validSku) break;
    }
    if (!validSku) throw new Error('seedCartWithItem: no in-stock product found');

    // 3. Add item to cart
    const addGql = await (
      await authClient.mutateWrapped(ADD_PRODUCTS_MUTATION, {
        cartId,
        cartItems: [{ sku: validSku, quantity: 1 }],
      })
    ).getGraphQLResponse();
    const userErrors: UserError[] = addGql.data?.addProductsToCart?.user_errors ?? [];
    if (userErrors.length) {
      throw new Error(
        `seedCartWithItem: addProductsToCart user_error: ${userErrors[0]?.message}`,
      );
    }
    if (addGql.errors?.length) {
      throw new Error(
        `seedCartWithItem: addProductsToCart gql error: ${addGql.errors[0]?.message}`,
      );
    }

    return { cartId, sku: validSku };
  } finally {
    await authClient.dispose();
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('E2E Cart @e2e @cart @regression', () => {

  /**
   * E2E-CART-010
   * Promo/discount code field is visible at checkout entry
   *
   * Preconditions: Staging env accessible, valid test credentials in site.testData.
   * Steps:
   *   1. Authenticate via GraphQL API (sign in fresh; create account first if needed)
   *   2. Seed cart with one in-stock product via GraphQL API
   *   3. Navigate browser to /checkout (token injected into localStorage)
   *   4. Assert a promo/coupon code input field is visible on the page
   * Expected: Promo/discount code input field is rendered at checkout entry.
   */
  test('E2E-CART-010 - Promo/discount code field is visible at checkout entry', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);

    const logger = createTestLogger('E2E-CART-010 promo code field visible at checkout entry');
    const site = resolveSiteContext(testInfo.project.name);
    const state = new TestState();

    // ── Step 1: Authenticate ─────────────────────────────────────────────────
    logger.step('Step 1 - Authenticate via GraphQL API');
    const apiEnv = getApiEnvironment();
    const anonClient = new GraphQLClient({
      baseURL: site.baseURL,
      timeout: apiEnv.timeout,
      ...(site.storeHeader ? { customHeaders: { Store: site.storeHeader } } : {}),
    });
    await anonClient.init();

    let token: string;
    try {
      token = await signInAndStoreToken(anonClient, logger, site, state);
    } finally {
      await anonClient.dispose();
    }
    logger.action('Token acquired', '');

    // ── Step 2: Seed cart with one in-stock item ──────────────────────────────
    logger.step('Step 2 - Seed cart with one in-stock item via GraphQL API');
    const { cartId, sku } = await seedCartWithItem(site, token);
    logger.action('Cart seeded', `cartId=${cartId}, sku=${sku}`);

    // ── Step 3: Navigate to checkout ─────────────────────────────────────────
    // Inject the auth token into localStorage before navigating to /checkout so
    // the Magento PWA storefront recognises the logged-in session.
    const siteBaseUrl = (baseURL ?? site.baseURL).replace(/\/graphql\/?$/, '').replace(/\/$/, '');
    const checkoutUrl = `${siteBaseUrl}/checkout`;

    logger.step(`Step 3 - Navigate browser to ${checkoutUrl}`);
    await page.goto(siteBaseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t: string) => {
      localStorage.setItem('signin_token', t);
      // Magento PWA / Venia also stores under this namespaced key
      localStorage.setItem(
        'M2_VENIA_BROWSER_PERSISTENCE__signin_token',
        JSON.stringify({ value: `"${t}"`, ttl: null }),
      );
    }, token);

    await page.goto(checkoutUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.PAGE_LOAD,
    });

    const checkoutPage = new EcommerceCheckoutPage(page);
    await checkoutPage.waitForCheckoutLoad();

    // ── Step 4: Assert promo code field is visible ───────────────────────────
    logger.step('Step 4 - Assert promo/discount code input field is visible');
    const hasPromo = await checkoutPage.hasPromoCodeField();

    logger.verify('Promo code field visible', true, hasPromo);
    expect(
      hasPromo,
      'Expected a promo/discount code input field to be visible at checkout entry',
    ).toBe(true);
  });

});
