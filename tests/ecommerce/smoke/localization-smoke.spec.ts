import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { LocalizationExpectations } from '@data/ecommerce/localization-data';
import { createTestLogger } from '@utils/test-logger';
import { getPreferredNavLabel, navigateToPlp } from './smoke-helpers';

// E2E-LOC-001 scope: Platypus AU and Skechers AU only
const LOC_001_SITES = ['Platypus AU', 'Skechers AU'];
const auSites = storefronts.filter((s) => LOC_001_SITES.includes(s.name));

// E2E-LOC-004 scope: Skechers AU and Skechers NZ only
const LOC_004_SITES = ['Skechers AU', 'Skechers NZ'];
const loc004Sites = storefronts.filter((s) => LOC_004_SITES.includes(s.name));

// E2E-LOC-002 scope: Platypus NZ and Skechers NZ only
const LOC_002_SITES = ['Platypus NZ', 'Skechers NZ'];
const nzSites = storefronts.filter((s) => LOC_002_SITES.includes(s.name));

test.describe('Ecommerce Localization Smoke @ecommerce @smoke @localization', () => {
  test.slow();

  for (const site of auSites) {
    // Skechers AU is a preferMens site — WOMENS PLP leads to non-footwear
    const preferMens = site.name.toLowerCase().includes('skechers');
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`E2E-LOC-001 - ${site.name} AU site displays AUD prices`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`E2E-LOC-001 - ${site.name} AU site displays AUD prices`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Step 1 - Navigate to PLP via nav link', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let priceText = '';
      await logger.step('Step 2 - Get first visible price from product grid', async () => {
        priceText = await ecommercePLPPage.getPriceText();
        logger.verify(
          `${site.name} price matches AUD format $X.XX`,
          LocalizationExpectations.auPricePattern.toString(),
          priceText,
        );
      });

      await logger.step('Step 3 - Assert price matches AUD format', async () => {
        expect(
          priceText,
          `Expected a price in $X.XX format on the ${site.name} PLP — got: "${priceText}"`,
        ).toMatch(LocalizationExpectations.auPricePattern);
      });
    });
  }

  for (const site of nzSites) {
    // Skechers NZ is a preferMens site — WOMENS PLP leads to non-footwear
    // Platypus NZ has no womensNavLabel; getPreferredNavLabel falls back to mensNavLabel
    const preferMens = site.name.toLowerCase().includes('skechers');
    const navLabel = getPreferredNavLabel(site, preferMens);

    test(`E2E-LOC-002 - ${site.name} NZ site displays NZD prices`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`E2E-LOC-002 - ${site.name} NZ site displays NZD prices`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Step 1 - Navigate to PLP via nav link', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let priceText = '';
      await logger.step('Step 2 - Get first visible price from product grid', async () => {
        priceText = await ecommercePLPPage.getPriceText();
        logger.verify(
          `${site.name} price matches NZD format $X.XX`,
          LocalizationExpectations.nzPricePattern.toString(),
          priceText,
        );
      });

      await logger.step('Step 3 - Assert price matches NZD format', async () => {
        expect(
          priceText,
          `Expected a price in $X.XX format on the ${site.name} PLP — got: "${priceText}"`,
        ).toMatch(LocalizationExpectations.nzPricePattern);
      });
    });
  }

  for (const site of storefronts) {
    test(`E2E-LOC-003 - ${site.name} AU sites show Qantas Points NZ sites do not`, async ({ ecommerceHomePage }) => {
      const logger = createTestLogger(`E2E-LOC-003 - ${site.name} AU sites show Qantas Points NZ sites do not`);

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceHomePage.navigate(site.url);
      });

      await logger.step('Step 2 - Assert Qantas Points presence or absence', async () => {
        if (site.hasQantasPoints) {
          await ecommerceHomePage.assertQantasPointsVisible(site.name);
        } else {
          await ecommerceHomePage.assertQantasPointsAbsent(site.name);
        }
      });

      await logger.step(`Step 3 - ${site.name} hasQantasPoints=${site.hasQantasPoints} assertion passed`, async () => {});
    });
  }

  for (const site of loc004Sites) {
    test(`E2E-LOC-004 - ${site.name} CLOTHING nav presence matches regional config`, async ({ ecommerceNavPage }) => {
      const logger = createTestLogger(`E2E-LOC-004 - ${site.name} CLOTHING nav presence matches regional config`);
      const shouldHaveClothing = site.navLinks.includes('CLOTHING');

      await logger.step('Step 1 - Navigate to storefront homepage', async () => {
        await ecommerceNavPage.navigate(site.url);
      });

      await logger.step('Step 2 - Wait for SPA nav hydration', async () => {
        await ecommerceNavPage.waitForNavHydration();
      });

      await logger.step('Step 3 - Assert WOMEN nav link is visible (proves nav rendered)', async () => {
        const womenVisible = await ecommerceNavPage.isNavLinkVisible('WOMEN');
        logger.verify(`${site.name} WOMEN nav link is visible after hydration`, true, womenVisible);
        expect(womenVisible, `${site.name} nav did not render — WOMEN link not found after hydration`).toBe(true);
      });

      await logger.step('Step 4 - Assert CLOTHING nav link is present or absent based on regional config', async () => {
        const clothingVisible = await ecommerceNavPage.isNavLinkVisible('CLOTHING');
        logger.verify(
          `${site.name} CLOTHING nav link visibility matches navLinks config (expected: ${shouldHaveClothing})`,
          shouldHaveClothing,
          clothingVisible,
        );
        expect(
          clothingVisible,
          `${site.name} CLOTHING nav link visibility was ${clothingVisible} but expected ${shouldHaveClothing} based on navLinks config`,
        ).toBe(shouldHaveClothing);
      });

      await logger.step(`Step 5 - ${site.name} CLOTHING nav shouldHaveClothing=${shouldHaveClothing} assertion passed`, async () => {});
    });
  }

  for (const site of storefronts) {
    test(`E2E-LOC-007 - ${site.name} displays correct brand name and loyalty program`, async ({
      ecommerceHomePage,
    }) => {
      const logger = createTestLogger(
        `E2E-LOC-007 - ${site.name} displays correct brand name and loyalty program`,
      );

      await logger.step('Step 1 - Navigate to homepage', async () => {
        await ecommerceHomePage.navigate(site.url);
      });

      await logger.step('Step 2 - Assert brand name visible in page body', async () => {
        await ecommerceHomePage.assertBrandNameVisible(site.brandName, site.name);
        logger.verify(`${site.name} page body contains brand "${site.brandName}"`, site.brandName, 'found');
      });

      const loyaltyProgramName = site.loyaltyProgramName;
      if (!loyaltyProgramName) {
        await logger.step('Step 3 - Skip loyalty program assertion (not configured for this site)', async () => {});
        return;
      }

      await logger.step('Step 3 - Assert loyalty program name visible on page', async () => {
        await ecommerceHomePage.assertLoyaltyProgramVisible(loyaltyProgramName, site.name);
        logger.verify(`${site.name} loyalty program name visible`, loyaltyProgramName, 'found');
      });
    });
  }
});
