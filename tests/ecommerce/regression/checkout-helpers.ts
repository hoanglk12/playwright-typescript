import { test, expect } from '@config/base-test';
import type { Storefront } from '@data/ecommerce/storefronts';
import type { TestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import type { EcommerceNavPage } from '../../../src/pages/ecommerce/nav-page';
import type { EcommercePLPPage } from '../../../src/pages/ecommerce/plp-page';
import type { EcommercePDPPage } from '../../../src/pages/ecommerce/pdp-page';
import type { EcommerceCartOverlayPage } from '../../../src/pages/ecommerce/cart-overlay-page';
import type { EcommerceCheckoutPage } from '../../../src/pages/ecommerce/checkout-page';
import type { APIRequestContext } from '@playwright/test';
import {
  navigateToPlp,
  ensureCartOverlayOpen,
  findProductWithAvailableSizes,
} from '../smoke/smoke-helpers';

// E2E-CHKOUT-006 — Product identity captured during ATC, surfaced on the 'ok' outcome so
// callers can verify the order-review surface later shows the SAME product/quantity that was
// actually added (rather than merely asserting a row exists).
export interface CheckoutCtaOkResult {
  status: 'ok';
  productName: string;
  productPrice: string;
  size: string;
}

export interface CheckoutCtaSkippedResult {
  status: 'skipped';
}

export type CheckoutCtaResult = CheckoutCtaOkResult | CheckoutCtaSkippedResult;

// Matches the same digit/decimal-point extraction strategy as
// EcommerceCheckoutPage.getOrderSummaryTotals()'s internal parsePrice().
export function parsePriceToken(token: string): number | null {
  const cleaned = token.replace(/[^0-9.]/g, '');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

// Stops short of the final checkout-state assertion — each test supplies its own after this
// returns. On `{ status: 'skipped' }` the caller must `return` immediately, since `test.skip()`
// has already been called internally.
export async function addToCartAndReachCheckoutCta(params: {
  site: Storefront;
  navLabel: string | undefined;
  request: APIRequestContext;
  ecommerceNavPage: EcommerceNavPage;
  ecommercePLPPage: EcommercePLPPage;
  ecommercePDPPage: EcommercePDPPage;
  ecommerceCartOverlayPage: EcommerceCartOverlayPage;
  ecommerceCheckoutPage: EcommerceCheckoutPage;
  logger: TestLogger;
}): Promise<CheckoutCtaResult> {
  const {
    site,
    navLabel,
    request,
    ecommerceNavPage,
    ecommercePLPPage,
    ecommercePDPPage,
    ecommerceCartOverlayPage,
    ecommerceCheckoutPage,
    logger,
  } = params;

  if (!navLabel) {
    test.skip(true, `${site.name} has no nav link configured for PDP navigation`);
    return { status: 'skipped' };
  }

  let originHealthy = false;
  await logger.step('Step 0 - Verify storefront origin is reachable before running the full flow', async () => {
    originHealthy = await request
      .get(site.url, { timeout: TIMEOUTS.TIMEOUT_SHORT })
      .then((response) => response.ok())
      .catch(() => false);
  });
  if (!originHealthy) {
    test.skip(
      true,
      `${site.name}: origin failed health check (unreachable or non-2xx within ${TIMEOUTS.TIMEOUT_SHORT}ms) — skipping to avoid burning the retry/test.slow() budget on a dead backend`,
    );
    return { status: 'skipped' };
  }

  await logger.step('Steps 1-5 - Navigate to PLP', async () => {
    await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
  });

  let availableSizes: string[] = [];
  await logger.step('Step 6 - Scan PLP for a product with available sizes', async () => {
    availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
  });
  if (availableSizes.length === 0) {
    test.skip(true, `${site.name}: no product with available sizes found in first 10 ${navLabel} PLP products`);
    return { status: 'skipped' };
  }

  let initialCartCount = 0;
  let productName = '';
  let productPrice = '';
  await logger.step('Step 7 - Capture initial mini cart count before ATC', async () => {
    initialCartCount = await ecommercePDPPage.getMiniCartCount();
    logger.verify('Initial cart count before ATC', '>= 0', String(initialCartCount));

    // E2E-CHKOUT-006 — Capture product identity BEFORE the size-selection loop, not inside it:
    // name/price are already rendered on the PDP and are stable across which size gets picked, so
    // capturing here keeps the isAddToCartEnabled() -> addToCart() adjacency in Step 8-9 tight
    // (inserting awaits between those two calls would reintroduce the timing gap documented below).
    productName = await ecommercePDPPage.getProductName();
    productPrice = await ecommercePDPPage.getPrice();
  });

  // Some sizes show as non-disabled in the DOM but are sold-out (show "NOTIFY ME" not ATC).
  // addToCart is called immediately after isAddToCartEnabled to minimise the window in which
  // the SPA can lose the button (observed on Vans AU with ~400ms gap). Do NOT split this into
  // selectFirstPurchasableSize() + a separate addToCart() call — that reintroduces the timing
  // gap and addToCart() silently no-ops against a stale/removed button.
  let targetSize: string | null = null;
  await logger.step('Step 8-9 - Select a size, then Add to Cart immediately (try up to 3 sizes)', async () => {
    for (const size of availableSizes.slice(0, 3)) {
      await ecommercePDPPage.selectSize(size);
      if (await ecommercePDPPage.isAddToCartEnabled()) {
        targetSize = size;
        await ecommercePDPPage.addToCart();
        break;
      }
    }
  });
  if (targetSize === null) {
    test.skip(true, `${site.name}: first 3 sizes all resulted in sold-out state — no purchasable size found`);
    return { status: 'skipped' };
  }
  logger.verify('Size that enabled Add to Cart', 'non-empty string', targetSize);

  let postAddCount = 0;
  await logger.step('Step 10 - Poll for mini cart count to increment after ATC', async () => {
    postAddCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
  });

  await logger.step('Step 11 - Assert cart count incremented by 1 (precondition for checkout check)', async () => {
    expect(
      postAddCount,
      `${site.name}: Cart count must increment by 1 after ATC before checkout check is meaningful (was ${initialCartCount}, expected ${initialCartCount + 1}, got ${postAddCount})`,
    ).toBe(initialCartCount + 1);
  });

  await logger.step('Step 12 - Open the mini cart overlay', async () => {
    await ensureCartOverlayOpen(ecommerceCartOverlayPage);
  });

  await logger.step('Step 13 - Click CHECKOUT CTA in the mini cart overlay', async () => {
    await ecommerceCheckoutPage.clickCheckoutCtaFromOverlay();
  });

  await logger.step('Step 14 - Wait for checkout to load', async () => {
    await ecommerceCheckoutPage.waitForCheckoutLoad();
  });

  return { status: 'ok', productName, productPrice, size: targetSize };
}
