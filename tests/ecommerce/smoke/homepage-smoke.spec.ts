import { test } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe.serial('Ecommerce Homepage Smoke @ecommerce @smoke @homepage', () => {
  // These SPA staging sites need extra time to hydrate, especially in Firefox
  test.slow();

  for (const site of storefronts) {
    test(`E2E-HOME-001 - ${site.name} homepage loads with expected title and hero`, async ({ ecommerceHomePage }) => {
      const logger = createTestLogger(`${site.name} - Homepage Load`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceHomePage.navigate(site.url);

      logger.step('Step 2 - Assert title matches');
      await ecommerceHomePage.assertTitleMatches(site.titleRegex);

      logger.step('Step 3 - Assert main content visible');
      await ecommerceHomePage.assertMainContentVisible();

      logger.step('Step 4 - Assert hero visible');
      await ecommerceHomePage.assertHeroVisible();
    });

    test(`E2E-HOME-002 - ${site.name} top bar promotional message is visible`, async ({ ecommerceHomePage }) => {
      const logger = createTestLogger(`${site.name} - Promo Message`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceHomePage.navigate(site.url);

      logger.step('Step 2 - Assert promo message visible');
      await ecommerceHomePage.assertPromoMessageVisible(site.name);
    });

    test(`E2E-HOME-003 - ${site.name} Qantas Points link is visible on AU sites only`, async ({ ecommerceHomePage }) => {
      const logger = createTestLogger(`${site.name} - Qantas Points`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceHomePage.navigate(site.url);

      logger.step('Step 2 - Assert Qantas Points visibility');
      if (site.hasQantasPoints) {
        await ecommerceHomePage.assertQantasPointsVisible(site.name);
      } else {
        await ecommerceHomePage.assertQantasPointsAbsent(site.name);
      }
    });
  }
});
