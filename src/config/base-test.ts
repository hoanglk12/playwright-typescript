import { test as base } from '@playwright/test';
import { PageGenerator as FrontSitePageGenerator } from '../pages/front site/page-generator';
import { PageGenerator as AdminPageGenerator } from '../pages/admin/page-generator';
import { HomePage } from '../pages/front site/home-page';
import { LoginPage } from '../pages/admin/login-page';
import { FormDragAndDropPage } from '@pages/front site/form-drag-and-drop';
import { ProfileListingPage } from '@pages/front site/profile-listing-page';
import { InsightsPage } from '@pages/front site/insights-page';


type CustomFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  formDragAndDropPage: FormDragAndDropPage;
  profileListingPage: ProfileListingPage;
  insightsPage: InsightsPage;
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


 
});

export { expect } from '@playwright/test';