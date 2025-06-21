import { test as base } from '@playwright/test';
import { PageGenerator as FrontSitePageGenerator } from '../pages/front site/page-generator';
import { PageGenerator as AdminPageGenerator } from '../pages/admin/page-generator';
import { HomePage } from '../pages/front site/home-page';
import { LoginPage } from '../pages/admin/login-page';


type CustomFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;

};

export const test = base.extend<CustomFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = FrontSitePageGenerator.getHomePage(page);
    await use(homePage);
  },

  loginPage: async ({ page }, use) => {
    const loginPage = AdminPageGenerator.getLoginPage(page);
    await use(loginPage);
  }

 
});

export { expect } from '@playwright/test';