import * as  HomeData from '../../src/data/home-data';
import { test, expect } from '../../src/config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';



/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Home Page Verification', () => {
  test('TC_01 - Verify Header Logo and Highlighted Text Color', async ({ 
    homePage,
    
  }) => {
    //Declare logger for test steps
    const logger = createTestLogger('Verify Header Logo and Highlighted Text Color');


    logger.step('Step 1 - Navigate to home page');
    logger.action('Navigate', 'home page');
    await homePage.navigateToHomePage();
    await homePage.waitForAjaxRequestsCompleteAdvanced();
        
    logger.step('Step 2 - Verify FF logo is displayed');
    logger.action('Verify', 'FF logo is displayed');
    expect(await homePage.isLogoDisplayed()).toBeTruthy();

    logger.step('Step 3 - Click hamburger icon');
    logger.action('Click', 'hamburger icon');
    await homePage.clickHamburgerMenu();
    await homePage.waitForAjaxRequestsCompleteAdvanced();

    // Step 4: Verify highlighted text background color is #003f64
    logger.step('Step 4 - Verify highlighted text background color is HomeData.HeaderData.NAVIGATION_MENU.highlightedColor');
    logger.action('Verify', 'highlighted text background color is HomeData.HeaderData.NAVIGATION_MENU.highlightedColor');
    expect(await homePage.getAllHighlightedTextBackgroundColor()).toContain(HomeData.HeaderData.NAVIGATION_MENU.highlightedColor);
  
  });
});