import { test } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';

test.describe.serial('Ecommerce Homepage Smoke @ecommerce @smoke @homepage', () => {
  // These SPA staging sites need extra time to hydrate, especially in Firefox
  test.slow();

  for (const site of storefronts) {
    test(`E2E-HOME-001 - ${site.name} homepage loads with expected title and hero`, async ({ ecommerceHomePage }) => {
      await ecommerceHomePage.navigate(site.url);
      await ecommerceHomePage.assertTitleMatches(site.titleRegex);
      await ecommerceHomePage.assertMainContentVisible();
      await ecommerceHomePage.assertHeroVisible();
    });

    test(`E2E-HOME-002 - ${site.name} top bar promotional message is visible`, async ({ ecommerceHomePage }) => {
      await ecommerceHomePage.navigate(site.url);
      await ecommerceHomePage.assertPromoMessageVisible(site.name);
    });

    test(`E2E-HOME-003 - ${site.name} Qantas Points link is visible on AU sites only`, async ({ ecommerceHomePage }) => {
      await ecommerceHomePage.navigate(site.url);
      if (site.hasQantasPoints) {
        await ecommerceHomePage.assertQantasPointsVisible(site.name);
      } else {
        await ecommerceHomePage.assertQantasPointsAbsent(site.name);
      }
    });
  }
});