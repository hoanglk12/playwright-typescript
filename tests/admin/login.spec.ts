import { AdminData } from '@data/admin-data';
import { test, expect } from '../../src/config/base-test';
import * as AdminDataModule from '../../src/data/admin-data';
import { getEnvironment } from '../../src/config/environment';
import { createTestLogger } from '../../src/utils/test-logger';
/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Admin Login Tests', () => {
  

  test('TC_01 - Login fails with empty username and empty password', async ({ 
    loginPage,
    
  }) => {
    //Declare logger for test steps
    const logger = createTestLogger('User cannot login with empty credentials');

    
    logger.step('Step 1 - Navigate to login page');
    logger.action('Navigate', 'login page');
    await loginPage.navigateToHomePage();
    
    logger.step('Step 2 - Enter empty credentials');
    logger.action('Fill', 'username field with empty value');
    await loginPage.enterUserID(AdminData.EMPTY_CREDENTIALS.username);

    logger.action('Fill', 'password field with empty value');
    await loginPage.enterPassword(AdminData.EMPTY_CREDENTIALS.password);
    
    logger.step('Step 3 - Click login button to attempt login');
    logger.action('Click', 'login button');
    await loginPage.clickLoginButton();
    await loginPage.waitForFullPageLoad();
    
    logger.verify('Step 4 - Verify Error message contains expected text', await loginPage.getErrorMessageFromPopup(), AdminDataModule.AdminTestData.expectedMessages.errorLogin);
    expect(await loginPage.getErrorMessageFromPopup()).toContain(AdminDataModule.AdminTestData.expectedMessages.errorLogin);
      
 });

  test('TC_02 - Login fails with wrong username and wrong password', async ({ 
    loginPage,
    
  }) => {
    //Declare logger for test steps
    const logger = createTestLogger('User cannot login with wrong credentials');
    
    logger.step('Step 1 - Navigate to login page');
    logger.action('Navigate', 'login page');
    await loginPage.navigateToHomePage();
    
    logger.step('Step 2 - Enter wrong credentials');
    logger.action('Fill', 'username field with wrong value');
    await loginPage.enterUserID(AdminData.INVALID_ADMIN.username);
    logger.action('Fill', 'username field with wrong value');
    await loginPage.enterPassword(AdminData.INVALID_ADMIN.password);
    
    logger.step('Step 3 - Click login button to attempt login');
    logger.action('Click', 'login button');
    await loginPage.clickLoginButton();
    await loginPage.waitForFullPageLoad();
    
    logger.verify('Step 4 - Verify Error message contains expected text', await loginPage.getErrorMessageFromPopup(), AdminDataModule.AdminTestData.expectedMessages.errorLogin);
    expect(await loginPage.getErrorMessageFromPopup()).toContain(AdminDataModule.AdminTestData.expectedMessages.errorLogin);
       
  });
});