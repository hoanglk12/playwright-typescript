import { test, expect } from '@config/base-test';
import { ServicesAZData } from '../../src/data/services-az-data';
import { createTestLogger } from '../../src/utils/test-logger';

/**
 * Services A-Z List Tests
 * @feature Services A-Z List
 * @story Navigate via hamburger menu and filter services by letter
 */
test.describe('Services A-Z List Tests @services @frontsite', () => {
  test('Navigate to Services A-Z via hamburger menu and click a random enabled letter', async ({
    servicesAZPage,
  }) => {
    // Logger is scoped to this test to avoid shared mutable state between tests
    const logger = createTestLogger('Services A-Z List Scenarios');
    // ── Step 1: Navigate to Home page ───────────────────────────────
    logger.step('Step 1 - Navigate to Home page');
    logger.action('Navigate', 'home page');
    await servicesAZPage.navigateToHomePage();

    // ── Step 2: Open the hamburger menu ─────────────────────────────
    logger.step('Step 2 - Click the hamburger menu');
    logger.action('Click', 'hamburger menu');
    await servicesAZPage.openHamburgerMenu();

    // ── Step 3: Expand Services and click "Services A-Z List" ───────
    logger.step('Step 3 - Navigate Services → Services A-Z List');
    logger.action('Click', 'Services expand → Services A-Z List');
    await servicesAZPage.expandServicesSubMenu();
    await servicesAZPage.clickServicesAZLink();

    // ── Step 4: Verify the page heading ─────────────────────────────
    logger.step('Step 4 - Verify page heading is "Services A-Z List"');
    logger.action('Verify', 'page heading');
    const heading = await servicesAZPage.getPageHeading();
    expect(heading).toBe(ServicesAZData.pageHeading);

    // ── Step 5: Collect enabled letters & click a random one ────────
    logger.step('Step 5 - Click a random enabled letter in the A-Z filter');
    const enabledLetters = await servicesAZPage.getEnabledLetters();
    logger.action('Found enabled letters', enabledLetters.map((l) => l.letter).join(', '));
    expect(enabledLetters.length).toBeGreaterThan(0);

    const clickedLetter = await servicesAZPage.clickRandomEnabledLetter();
    logger.action('Clicked letter', clickedLetter);

    // ── Step 6: Verify the page scrolls to the correct section ──────
    logger.step(`Step 6 - Verify page scrolled to section "${clickedLetter}"`);
    logger.action('Verify', `section heading "${clickedLetter}" is in viewport`);
    // toBeInViewport retries until scroll animation completes — avoids one-shot race
    await expect(servicesAZPage.getSectionHeading(clickedLetter)).toBeInViewport({ timeout: 10000 });

    // ── Step 7: Verify the section has at least one service link ─────
    logger.step(`Step 7 - Verify section "${clickedLetter}" has services`);
    logger.action('Verify', 'service links present');
    const services = await servicesAZPage.getServiceNamesForLetter(clickedLetter);
    logger.action('Services found', services.join(', '));
    expect(services.length).toBeGreaterThan(0);
  });
});
