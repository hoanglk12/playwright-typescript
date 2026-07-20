import { test, expect } from '@config/base-test';
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
    softAssert,
  }) => {
    // Declare logger for test steps
    const logger = createTestLogger('Verify Header Logo and Highlighted Text Color');

    await logger.step('Step 1 - Navigate to home page', async () => {
      logger.action('Navigate', 'home page');
      await homePage.navigateToHomePage();
      await homePage.waitForAjaxRequestsComplete();
    });

    await logger.step('Step 2 - Verify FF logo is displayed', async () => {
      softAssert.toBeTruthy(await homePage.isLogoDisplayed(), 'FF logo is displayed');
    });

    await logger.step('Step 3 - Click hamburger icon', async () => {
      logger.action('Click', 'hamburger icon');
      await homePage.clickHamburgerMenu();
      await homePage.waitForAjaxRequestsComplete();
    });

    // Step 4: Hover over navigation links and verify background color matches brand colour
    await logger.step(`Step 4 - Hover over navigation links and verify background colour is ${HeaderData.NAVIGATION_MENU.highlightedColor}`, async () => {
      logger.action('Hover', 'navigation links');
      await homePage.hoverNavigationLinks();
      logger.action('Verify', `background colour is ${HeaderData.NAVIGATION_MENU.highlightedColor}`);
      // toHaveCSS retries until the CSS transition settles — avoids one-shot race on :hover
      await expect(homePage.firstNavLink).toHaveCSS('background-color', 'rgb(0, 63, 100)');
    });
  });
});