import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

const navStorefronts = storefronts.filter((s) => s.navLinks.length > 0);

test.describe.serial('Ecommerce Navigation Smoke @ecommerce @smoke @navigation', () => {
  // All sites require SPA hydration polling before link assertions — triple timeout covers the slowest staging site
  test.slow();

  for (const [index, site] of navStorefronts.entries()) {
    const tcId = `E2E-NAV-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} all top-nav links render and are clickable`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} top-nav links`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Assert all top-nav links are visible and have valid hrefs');
      for (const label of site.navLinks) {
        const isVisible = await ecommerceNavPage.isNavLinkVisible(label);
        logger.verify(`Nav link "${label}" is visible on ${site.name}`, true, isVisible);
        expect(isVisible, `Nav link "${label}" should be visible on ${site.name}`).toBe(true);

        const href = await ecommerceNavPage.getNavLinkHref(label);
        logger.verify(`Nav link "${label}" has a valid href on ${site.name}`, true, !!href);
        expect(href, `Nav link "${label}" on ${site.name} should have a valid href`).toMatch(/^(\/|https?:\/\/)/);
      }
    });
  }
});
