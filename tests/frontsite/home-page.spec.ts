import { AdminData } from '@data/admin-data';
import { test, expect } from '../../src/config/base-test';
import * as AdminDataModule from '../../src/data/admin-data';


/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Home Page Verification', () => {
  

  test('TC_01 - Verify Header', async ({ 
    homePage,
    
  }) => {
    // Step 1: Navigate to admin login page
    await homePage.navigateToHomePage();
    await homePage.waitForFullPageLoad();
    
    // Step 2: Enter invalid credentials
    await homePage.clickHamburgerMenu();
    
    // Step 3: Verify logo is displayed
    expect(await homePage.isLogoDisplayed()).toBeTruthy();

      // Step 2: Enter invalid credentials
    await homePage.clickHamburgerMenu();
    await homePage.waitForPageLoad();

    // Step 4: Verify highlighted text background color
expect(await homePage.getAllHighlightedTextBackgroundColor()).toContain('#003f64');
  
  });

//   test('TC_02 - Login fails with wrong username and wrong password', async ({ 
//     loginPage,
    
//   }) => {
//     // Step 1: Navigate to admin login page
//     await loginPage.navigateToHomePage();
    
//     // Step 2: Enter invalid credentials
//   await loginPage.enterUserID(AdminData.INVALID_ADMIN.username);
//     await loginPage.enterPassword(AdminData.INVALID_ADMIN.password);
    
//     // Step 3: Click login button
//     await loginPage.clickLoginButton();
    
//     // Step 4: Verify error popup message contains AdminTestData.expectedMessages.errorLogin
//     expect(await loginPage.getErrorMessageFromPopup()).toContain(AdminDataModule.AdminTestData.expectedMessages.errorLogin);
    
//     // // Take screenshot for documentation
//     // await page.screenshot({ path: 'test-results/login-failure.png', fullPage: true });
//   });
});