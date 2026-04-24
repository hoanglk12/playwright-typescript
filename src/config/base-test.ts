import { test as base } from '@playwright/test';
import { HomePage } from '../pages/frontsite/home-page';
import { LoginPage } from '../pages/admin/login-page';
import { FormDragAndDropPage } from '@pages/frontsite/form-drag-and-drop';
import { ProfileListingPage } from '@pages/frontsite/profile-listing-page';
import { InsightsPage } from '@pages/frontsite/insights-page';
import { ServicesAZPage } from '@pages/frontsite/services-az-page';
import { EcommerceHomePage } from '@pages/ecommerce/home-page';
import { EcommerceNavPage } from '@pages/ecommerce/nav-page';
import { PercyHelper } from '../pages/helpers';

type CustomFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  formDragAndDropPage: FormDragAndDropPage;
  profileListingPage: ProfileListingPage;
  insightsPage: InsightsPage;
  servicesAZPage: ServicesAZPage;
  ecommerceHomePage: EcommerceHomePage;
  ecommerceNavPage: EcommerceNavPage;
  percyHelper: PercyHelper;
};

export const test = base.extend<CustomFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  formDragAndDropPage: async ({ page }, use) => {
    await use(new FormDragAndDropPage(page));
  },

  profileListingPage: async ({ page }, use) => {
    await use(new ProfileListingPage(page));
  },

  insightsPage: async ({ page }, use) => {
    await use(new InsightsPage(page));
  },

  servicesAZPage: async ({ page }, use) => {
    await use(new ServicesAZPage(page));
  },

  percyHelper: async ({ page }, use) => {
    await use(new PercyHelper(page));
  },

  ecommerceHomePage: async ({ page }, use) => {
    await use(new EcommerceHomePage(page));
    // Firefox only: navigate to about:blank before fixture teardown so the
    // browser context closes cleanly. Firefox's Juggler protocol hangs on
    // context.close() when staging SPAs have active service workers and
    // persistent analytics/WebSocket connections. about:blank triggers the
    // unload lifecycle (deregisters service workers, closes connections).
    // Chromium handles context teardown cleanly without this workaround.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceNavPage: async ({ page }, use) => {
    await use(new EcommerceNavPage(page));
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },
});

export { expect } from '@playwright/test';