import { test } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe('Ecommerce Homepage Smoke @ecommerce @smoke @homepage', () => {
  // These SPA staging sites need extra time to hydrate, especially in Firefox
  test.slow();

  for (const site of storefronts) {
    test(`E2E-HOME-001 - ${site.name} homepage loads with expected title and hero`, async ({ ecommerceHomePage, percyHelper }) => {
      const logger = createTestLogger(`${site.name} - Homepage Load`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceHomePage.navigate(site.url);
      });

      await logger.step('Step 2 - Assert title matches', async () => {
        await ecommerceHomePage.assertTitleMatches(site.titleRegex);
      });

      await logger.step('Step 3 - Assert main content visible', async () => {
        await ecommerceHomePage.assertMainContentVisible();
      });

      await logger.step('Step 4 - Assert hero visible', async () => {
        await ecommerceHomePage.assertHeroVisible();
      });

      await logger.step('Step 5 - Percy snapshot', async () => {
        await percyHelper.snapshot(`${site.name} - Homepage Hero`);
      });
    });

    test(`E2E-HOME-002 - ${site.name} top bar promotional message is visible`, async ({ ecommerceHomePage, percyHelper }) => {
      const logger = createTestLogger(`${site.name} - Promo Message`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceHomePage.navigate(site.url);
      });

      await logger.step('Step 2 - Assert promo message visible', async () => {
        await ecommerceHomePage.assertPromoMessageVisible(site.name);
      });

      await logger.step('Step 3 - Percy snapshot', async () => {
        await percyHelper.snapshot(`${site.name} - Promo Message`);
      });
    });

    test(`E2E-HOME-003 - ${site.name} Qantas Points link is visible on AU sites only`, async ({ ecommerceHomePage, percyHelper }) => {
      const logger = createTestLogger(`${site.name} - Qantas Points`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceHomePage.navigate(site.url);
      });

      await logger.step('Step 2 - Assert Qantas Points visibility', async () => {
        if (site.hasQantasPoints) {
          await ecommerceHomePage.assertQantasPointsVisible(site.name);
        } else {
          await ecommerceHomePage.assertQantasPointsAbsent(site.name);
        }
      });

      await logger.step('Step 3 - Percy snapshot', async () => {
        await percyHelper.snapshot(`${site.name} - Qantas Points`);
      });
    });
  }
});
