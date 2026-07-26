import { test, expect } from '@config/base-test';
import { ServicesAZData } from '../../src/data/services-az-data';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';

test.describe('Services A-Z List Tests @services @frontsite', () => {
  test('Navigate to Services A-Z via hamburger menu and click a random enabled letter', async ({
    servicesAZPage,
    softAssert,
  }) => {
    const logger = createTestLogger('Services A-Z List Scenarios');
    let clickedLetter!: string;

    await logger.step('Step 1 - Navigate to Home page', async () => {
      logger.action('Navigate', 'home page');
      await servicesAZPage.navigateToHomePage();
    });

    await logger.step('Step 2 - Click the hamburger menu', async () => {
      logger.action('Click', 'hamburger menu');
      await servicesAZPage.openHamburgerMenu();
    });

    await logger.step('Step 3 - Navigate Services → Services A-Z List', async () => {
      logger.action('Click', 'Services expand → Services A-Z List');
      await servicesAZPage.expandServicesSubMenu();
      await servicesAZPage.clickServicesAZLink();
    });

    await logger.step('Step 4 - Verify page heading is "Services A-Z List"', async () => {
      const heading = await servicesAZPage.getPageHeading();
      softAssert.toBe(heading, ServicesAZData.pageHeading, 'Page heading correct');
    });

    await logger.step('Step 5 - Click a random enabled letter in the A-Z filter', async () => {
      const enabledLetters = await servicesAZPage.getEnabledLetters();
      logger.action('Found enabled letters', enabledLetters.map((l) => l.letter).join(', '));
      softAssert.toBeGreaterThan(enabledLetters.length, 0, 'At least one enabled letter');

      clickedLetter = await servicesAZPage.clickRandomEnabledLetter();
      logger.action('Clicked letter', clickedLetter);
    });

    await logger.step(`Step 6 - Verify page scrolled to section "${clickedLetter}"`, async () => {
      logger.action('Verify', `section heading "${clickedLetter}" is in viewport`);
      // toBeInViewport retries until scroll animation completes — avoids one-shot race
      await expect(servicesAZPage.getSectionHeading(clickedLetter)).toBeInViewport({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    });

    await logger.step(`Step 7 - Verify section "${clickedLetter}" has services`, async () => {
      logger.action('Verify', 'service links present');
      const services = await servicesAZPage.getServiceNamesForLetter(clickedLetter);
      logger.action('Services found', services.join(', '));
      softAssert.toBeGreaterThan(services.length, 0, `Section "${clickedLetter}" has services`);
    });
  });
});
