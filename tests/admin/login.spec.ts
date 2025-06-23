import { AdminData } from '@data/admin-data';
import { test, expect } from '../../src/config/base-test';
import * as AdminDataModule from '../../src/data/admin-data';
import { getEnvironment } from '../../src/config/environment';

/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Admin Login Tests', () => {
  

  test('TC_01 - Login fails with empty username and empty password', async ({ 
    loginPage,
    
  }) => {
    // Step 1: Navigate to admin login page
    await loginPage.navigateToHomePage();
    
    // Step 2: Enter invalid credentials
    await loginPage.enterUserID(AdminData.EMPTY_CREDENTIALS.username);
    await loginPage.enterPassword(AdminData.EMPTY_CREDENTIALS.password);
    
    // Step 3: Click login button
    await loginPage.clickLoginButton();
    
    // Step 4: Verify error popup message contains AdminTestData.expectedMessages.errorLogin
    expect(await loginPage.getErrorMessageFromPopup()).toContain(AdminDataModule.AdminTestData.expectedMessages.errorLogin);

    
    // // Take screenshot for documentation
    // await page.screenshot({ path: 'test-results/login-failure.png', fullPage: true });
  });

  test('TC_02 - Login fails with wrong username and wrong password', async ({ 
    loginPage,
    
  }) => {
    // Step 1: Navigate to admin login page
    await loginPage.navigateToHomePage();
    
    // Step 2: Enter invalid credentials
  await loginPage.enterUserID(AdminData.INVALID_ADMIN.username);
    await loginPage.enterPassword(AdminData.INVALID_ADMIN.password);
    
    // Step 3: Click login button
    await loginPage.clickLoginButton();
    
    // Step 4: Verify error popup message contains AdminTestData.expectedMessages.errorLogin
    expect(await loginPage.getErrorMessageFromPopup()).toContain(AdminDataModule.AdminTestData.expectedMessages.errorLogin);
    
    // // Take screenshot for documentation
    // await page.screenshot({ path: 'test-results/login-failure.png', fullPage: true });
  });
});