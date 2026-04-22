import { AdminData, AdminTestData } from '../../src/data/admin-data';
import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';
/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Admin Login Tests', () => {

  test('TC_01 - Login fails with empty username and empty password', async ({
    loginPage,
    percyHelper,
  }) => {
    //Declare logger for test steps
    const logger = createTestLogger('User cannot login with empty credentials');

    
    logger.step('Step 1 - Navigate to login page');
    logger.action('Navigate', 'login page');
    await loginPage.navigateToCMSLoginPage();
    
    logger.step('Step 2 - Enter empty credentials');
    logger.action('Fill', 'username field with empty value');
    await loginPage.enterUserID(AdminData.EMPTY_CREDENTIALS.username);

    logger.action('Fill', 'password field with empty value');
    await loginPage.enterPassword(AdminData.EMPTY_CREDENTIALS.password);
    
    logger.step('Step 3 - Click login button to attempt login');
    logger.action('Click', 'login button');
    await loginPage.clickLoginButton();

    logger.verify('Step 4 - Verify Error message contains expected text', AdminTestData.expectedMessages.errorLogin, AdminTestData.expectedMessages.errorLogin);
    await expect(loginPage.errorPopup).toContainText(AdminTestData.expectedMessages.errorLogin);

    logger.step('Step 5 - Percy snapshot');
    await percyHelper.snapshot('Admin Login - Empty Credentials Error');
  });

  test('TC_02 - Login fails with wrong username and wrong password', async ({
    loginPage,
    percyHelper,
  }) => {

    //Declare logger for test steps
    const logger = createTestLogger('User cannot login with wrong credentials');

    logger.step('Step 1 - Navigate to login page');
    logger.action('Navigate', 'login page');
    await loginPage.navigateToCMSLoginPage();

    logger.step('Step 2 - Enter wrong credentials');
    logger.action('Fill', 'username field with wrong value');
    await loginPage.enterUserID(AdminData.INVALID_ADMIN.username);
    logger.action('Fill', 'password field with wrong value');
    await loginPage.enterPassword(AdminData.INVALID_ADMIN.password);

    logger.step('Step 3 - Click login button to attempt login');
    logger.action('Click', 'login button');
    await loginPage.clickLoginButton();

    logger.verify('Step 4 - Verify Error message contains expected text', AdminTestData.expectedMessages.errorLogin, AdminTestData.expectedMessages.errorLogin);
    await expect(loginPage.errorPopup).toContainText(AdminTestData.expectedMessages.errorLogin);

    logger.step('Step 5 - Percy snapshot');
    await percyHelper.snapshot('Admin Login - Wrong Credentials Error');
  });
});