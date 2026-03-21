import { test } from '@playwright/test';
import { storefronts } from '@data/ecommerce/storefronts';
import { EcommerceHomePage } from '@pages/ecommerce/home-page';

test.describe('Ecommerce Homepage Smoke @ecommerce @smoke @homepage', () => {
  test.describe.configure({ mode: 'serial' });

  for (const site of storefronts) {
    test(`E2E-HOME-001 - ${site.name} homepage loads with expected title and hero`, async ({ page, browserName }) => {
      if (browserName === 'firefox') {
        test.slow();
      }

      const homePage = new EcommerceHomePage(page);

      await homePage.navigate(site.url);
      await homePage.assertTitleMatches(site.titleRegex);
      await homePage.assertMainContentVisible();
      await homePage.assertHeroVisible();
    });

    test(`E2E-HOME-002 - ${site.name} top bar promotional message is visible`, async ({ page, browserName }) => {
      if (browserName === 'firefox') {
        test.slow();
      }

      const homePage = new EcommerceHomePage(page);

      await homePage.navigate(site.url);
      await homePage.assertPromoMessageVisible(site.name, site.promoRegex);
    });
  }
});