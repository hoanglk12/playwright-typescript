import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe.serial('Ecommerce Cart Smoke @ecommerce @smoke @cart', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-CART-001-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} Mini cart shows 0 items on fresh session`, async ({
      ecommerceNavPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Mini cart empty`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for SPA nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Get mini cart count');
      const count = await ecommercePDPPage.getMiniCartCount();
      logger.verify('Mini cart count on fresh session', '0', String(count));

      logger.step('Step 4 - Assert mini cart count is 0');
      expect(count).toBe(0);
    });
  }
});
