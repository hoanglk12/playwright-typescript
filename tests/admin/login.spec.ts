import { test, expect } from '../../src/config/base-test';
import { getEnvironment } from '../../src/config/environment';

/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Admin Login Tests', () => {
  
  test('TC_01 - Successful login with valid credentials', async ({ 
    loginPage,
    page
  }) => {
    const env = getEnvironment();
    
    // Step 1: Navigate to admin login page
    await loginPage.navigateToHomePage();
    
    // Step 2: Enter valid admin credentials
    await loginPage.enterUserID(env.username);
    await loginPage.enterPassword(env.password);
    
    // Step 3: Click login button
    await loginPage.clickLoginButton();
    
    // Step 4: Verify successful login
    const isHomeIconDisplayed = await loginPage.isHomeIconDisplayed();
    expect(isHomeIconDisplayed).toBe(true);
    
    // Take screenshot for documentation
    await page.screenshot({ path: 'test-results/login-success.png', fullPage: true });
  });

  test('TC_02 - Login fails with invalid credentials', async ({ 
    loginPage,
    page
  }) => {
    // Step 1: Navigate to admin login page
    await loginPage.navigateToHomePage();
    
    // Step 2: Enter invalid credentials
    await loginPage.enterUserID('invalid_user');
    await loginPage.enterPassword('invalid_password');
    
    // Step 3: Click login button
    await loginPage.clickLoginButton();
    
    // Step 4: Verify login failure
    const isHomeIconDisplayed = await loginPage.isHomeIconDisplayed();
    expect(isHomeIconDisplayed).toBe(false);
    
    // // Take screenshot for documentation
    // await page.screenshot({ path: 'test-results/login-failure.png', fullPage: true });
  });
});