import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

const navStorefronts = storefronts.filter((s) => s.navLinks.length > 0);
const womensSites = storefronts.filter((s) => !!s.womensNavLabel);
const mensSites = storefronts.filter((s) => !!s.mensNavLabel);
const kidsSites = storefronts.filter((s) => !!s.kidsNavLabel);
const saleSites = storefronts.filter((s) => !!s.saleNavLabel);

test.describe.serial('Ecommerce Navigation Smoke @ecommerce @smoke @navigation', () => {
  // All sites require SPA hydration polling before link assertions — triple timeout covers the slowest staging site
  test.slow();

  for (const [index, site] of navStorefronts.entries()) {
    const tcId = `E2E-NAV-${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} all top-nav links render and are clickable`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} top-nav links`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Assert all top-nav links are visible and have valid hrefs');
      for (const label of site.navLinks) {
        const isVisible = await ecommerceNavPage.isNavLinkVisible(label);
        logger.verify(`Nav link "${label}" is visible on ${site.name}`, true, isVisible);
        expect(isVisible, `Nav link "${label}" should be visible on ${site.name}`).toBe(true);

        const href = await ecommerceNavPage.getNavLinkHref(label);
        logger.verify(`Nav link "${label}" has a valid href on ${site.name}`, true, !!href);
        expect(href, `Nav link "${label}" on ${site.name} should have a valid href`).toMatch(/^(\/|https?:\/\/)/);
      }
    });
  }

  for (const [index, site] of womensSites.entries()) {
    const tcId = `E2E-NAV-W${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} ${site.womensNavLabel} link navigates to womens PLP`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} women nav`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Click women\'s nav link');
      await ecommerceNavPage.clickNavLink(site.womensNavLabel!);

      logger.step('Step 4 - Assert URL navigates to women\'s PLP');
      await ecommerceNavPage.waitForUrlContaining(/women/i);

      const currentUrl = await ecommerceNavPage.getCurrentUrl();
      logger.verify(`${site.name} URL contains women PLP path`, true, /women/i.test(currentUrl));
      expect(currentUrl, `URL should indicate women's PLP on ${site.name}`).toMatch(/women/i);
    });
  }

  // E2E-NAV-003 — MENS link navigates to mens PLP
  for (const [index, site] of mensSites.entries()) {
    const tcId = `E2E-NAV-M${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} ${site.mensNavLabel} link navigates to mens PLP`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} mens nav`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Click men\'s nav link');
      await ecommerceNavPage.clickNavLink(site.mensNavLabel!);

      logger.step('Step 4 - Assert URL navigates to men\'s PLP');
      await ecommerceNavPage.waitForUrlContaining(/\/men/i);

      const currentUrl = await ecommerceNavPage.getCurrentUrl();
      logger.verify(`${site.name} URL contains mens PLP path`, true, /\/men/i.test(currentUrl));
      expect(currentUrl, `URL should indicate men's PLP on ${site.name}`).toMatch(/\/men/i);
    });
  }

  // E2E-NAV-004 — KIDS link navigates to kids PLP
  for (const [index, site] of kidsSites.entries()) {
    const tcId = `E2E-NAV-K${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} ${site.kidsNavLabel} link navigates to kids PLP`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} kids nav`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Click kids nav link');
      await ecommerceNavPage.clickNavLink(site.kidsNavLabel!);

      logger.step('Step 4 - Assert URL navigates to kids PLP');
      await ecommerceNavPage.waitForUrlContaining(/\/kids/i);

      const currentUrl = await ecommerceNavPage.getCurrentUrl();
      logger.verify(`${site.name} URL contains kids PLP path`, true, /\/kids/i.test(currentUrl));
      expect(currentUrl, `URL should indicate kids PLP on ${site.name}`).toMatch(/\/kids/i);
    });
  }

  // E2E-NAV-005 — SALE link (label varies per site: SALE, OUTLET, BLACK FRIDAY) navigates to sale PLP
  for (const [index, site] of saleSites.entries()) {
    const tcId = `E2E-NAV-S${String(index + 1).padStart(3, '0')}`;

    test(`${tcId} - ${site.name} ${site.saleNavLabel} link navigates to sale PLP`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} sale nav`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step('Step 3 - Click sale nav link');
      await ecommerceNavPage.clickNavLink(site.saleNavLabel!);

      logger.step('Step 4 - Assert URL navigates to sale PLP');
      await ecommerceNavPage.waitForUrlContaining(/\/sale/i);

      const currentUrl = await ecommerceNavPage.getCurrentUrl();
      logger.verify(`${site.name} URL contains sale PLP path`, true, /\/sale/i.test(currentUrl));
      expect(currentUrl, `URL should indicate sale PLP on ${site.name}`).toMatch(/\/sale/i);
    });
  }

  // E2E-NAV-009 — Logo click returns to homepage from any page (all 8 storefronts)
  for (const site of storefronts) {
    const interiorLabel = site.womensNavLabel ?? site.mensNavLabel ?? site.kidsNavLabel;
    if (!interiorLabel) continue;

    test(`E2E-NAV-009 - ${site.name} logo click returns to homepage`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`E2E-NAV-009 - ${site.name} logo click`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceNavPage.navigate(site.url);

      logger.step('Step 2 - Wait for nav hydration');
      await ecommerceNavPage.waitForNavHydration();

      logger.step(`Step 3 - Click "${interiorLabel}" nav link to leave homepage`);
      await ecommerceNavPage.clickNavLink(interiorLabel);

      logger.step('Step 4 - Confirm we navigated away from root');
      const plpUrl = await ecommerceNavPage.getCurrentUrl();
      const rootPattern = new RegExp(`^${site.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      logger.verify(`${site.name} is no longer at site root`, true, !rootPattern.test(plpUrl));
      expect(plpUrl, `Should have navigated away from root on ${site.name}`).not.toMatch(rootPattern);

      logger.step('Step 5 - Click the site logo');
      await ecommerceNavPage.clickLogo();

      logger.step('Step 6 - Assert URL returned to site root');
      await ecommerceNavPage.waitForHomepage(site.url);

      const homeUrl = await ecommerceNavPage.getCurrentUrl();
      const homePattern = new RegExp(`^${site.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '')}\\/?$`);
      logger.verify(`${site.name} URL returned to homepage after logo click`, site.url, homeUrl);
      expect(homeUrl, `Logo click should return to homepage on ${site.name}`).toMatch(homePattern);
    });
  }
});
