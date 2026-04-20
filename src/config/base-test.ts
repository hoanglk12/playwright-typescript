import { test as base } from '@playwright/test';
import { PageGenerator as FrontSitePageGenerator } from '../pages/frontsite/page-generator';
import { PageGenerator as AdminPageGenerator } from '../pages/admin/page-generator';
import { PageGenerator as EcommercePageGenerator } from '../pages/ecommerce/page-generator';
import { HomePage } from '../pages/frontsite/home-page';
import { LoginPage } from '../pages/admin/login-page';
import { FormDragAndDropPage } from '@pages/frontsite/form-drag-and-drop';
import { ProfileListingPage } from '@pages/frontsite/profile-listing-page';
import { InsightsPage } from '@pages/frontsite/insights-page';
import { ServicesAZPage } from '@pages/frontsite/services-az-page';
import { EcommerceHomePage } from '@pages/ecommerce/home-page';
import { PercyHelper } from '../pages/helpers';

type CustomFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  formDragAndDropPage: FormDragAndDropPage;
  profileListingPage: ProfileListingPage;
  insightsPage: InsightsPage;
  servicesAZPage: ServicesAZPage;
  ecommerceHomePage: EcommerceHomePage;
  percyHelper: PercyHelper;
};

export const test = base.extend<CustomFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = FrontSitePageGenerator.getHomePage(page);
    await use(homePage);
  },

  loginPage: async ({ page }, use) => {
    const loginPage = AdminPageGenerator.getLoginPage(page);
    await use(loginPage);
  },

  formDragAndDropPage: async ({ page }, use) => {
    const formDragAndDropPage = FrontSitePageGenerator.getFormDragAndDropPage(page);
    await use(formDragAndDropPage);
  },

  profileListingPage: async ({ page }, use) => {
    const profileListingPage = FrontSitePageGenerator.getProfileListingPage(page);
    await use(profileListingPage);
  },

  insightsPage: async ({ page }, use) => {
    const insightsPage = FrontSitePageGenerator.getInsightsPage(page);
    await use(insightsPage);
  },

  servicesAZPage: async ({ page }, use) => {
    const servicesAZPage = FrontSitePageGenerator.getServicesAZPage(page);
    await use(servicesAZPage);
  },

  percyHelper: async ({ page }, use) => {
    await use(new PercyHelper(page));
  },

  ecommerceHomePage: async ({ page }, use) => {
    const ecommerceHomePage = EcommercePageGenerator.getEcommerceHomePage(page);
    await use(ecommerceHomePage);
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
});

export { expect } from '@playwright/test';