import { test as base } from '@playwright/test';
import { PageGenerator as FrontSitePageGenerator } from '../pages/front site/page-generator';
import { PageGenerator as AdminPageGenerator } from '../pages/admin/page-generator';
import { HomePage } from '../pages/front site/home-page';
import { LoginPage } from '../pages/admin/login-page';
import { FormDragAndDropPage } from '@pages/front site/form-drag-and-drop';


type CustomFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  formDragAndDropPage: FormDragAndDropPage;

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


 
});

export { expect } from '@playwright/test';