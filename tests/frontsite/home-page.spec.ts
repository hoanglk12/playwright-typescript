import { test, expect } from '../../src/config/base-test';
import { HeaderData } from '../../src/data/home-data';
import { createTestLogger } from '../../src/utils/test-logger';

/**
 * Home Page Tests
 * @feature Header Logo and Highlighted Text Color
 * @story Home Page Functionality
 */
test.describe('Home Page Verification @homepage @frontsite', () => {
  test('TC_01 - Verify Header Logo and Highlighted Text Color', async ({
    homePage,
  }) => {
    // Declare logger for test steps
    const logger = createTestLogger('Verify Header Logo and Highlighted Text Color');

    logger.step('Step 1 - Navigate to home page');
    logger.action('Navigate', 'home page');
    await homePage.navigateToHomePage();
    await homePage.waitForAjaxRequestsComplete();

    logger.step('Step 2 - Verify FF logo is displayed');
    logger.action('Verify', 'FF logo is displayed');
    expect(await homePage.isLogoDisplayed()).toBeTruthy();

    logger.step('Step 3 - Click hamburger icon');
    logger.action('Click', 'hamburger icon');
    await homePage.clickHamburgerMenu();
    await homePage.waitForAjaxRequestsComplete();

    // Step 4: Hover over navigation links and verify background color matches brand colour
    logger.step(`Step 4 - Hover over navigation links and verify background colour is ${HeaderData.NAVIGATION_MENU.highlightedColor}`);
    logger.action('Hover', 'navigation links');
    await homePage.hoverNavigationLinks();
    logger.action('Verify', `background colour is ${HeaderData.NAVIGATION_MENU.highlightedColor}`);
    // toHaveCSS retries until the CSS transition settles — avoids one-shot race on :hover
    await expect(homePage.firstNavLink).toHaveCSS('background-color', 'rgb(0, 63, 100)');
  });
});