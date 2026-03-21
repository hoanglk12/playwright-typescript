import { test } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';

test.describe('Ecommerce Homepage Smoke @ecommerce @smoke @homepage', () => {
  for (const site of storefronts) {
    test(`E2E-HOME-001 - ${site.name} homepage loads with expected title and hero`, async ({ ecommerceHomePage, browserName }) => {
      if (browserName === 'firefox') {
        test.slow();
      }

      await ecommerceHomePage.navigate(site.url);
      await ecommerceHomePage.assertTitleMatches(site.titleRegex);
      await ecommerceHomePage.assertMainContentVisible();
      await ecommerceHomePage.assertHeroVisible();
    });

    test(`E2E-HOME-002 - ${site.name} top bar promotional message is visible`, async ({ ecommerceHomePage, browserName }) => {
      if (browserName === 'firefox') {
        test.slow();
      }

      await ecommerceHomePage.navigate(site.url);
      await ecommerceHomePage.assertPromoMessageVisible(site.name, site.promoRegex);
    });
  }
});