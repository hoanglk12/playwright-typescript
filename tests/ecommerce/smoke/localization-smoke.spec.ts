import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { LocalizationExpectations } from '@data/ecommerce/localization-data';
import { createTestLogger } from '@utils/test-logger';
import { getPreferredNavLabel, navigateToPlp } from './smoke-helpers';

// E2E-LOC-001 scope: Platypus AU and Skechers AU only
const LOC_001_SITES = ['Platypus AU', 'Skechers AU'];
const auSites = storefronts.filter((s) => LOC_001_SITES.includes(s.name));

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

      logger.step('Step 1 - Navigate to PLP via nav link');
      await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);

      logger.step('Step 2 - Get first visible price from product grid');
      const priceText = await ecommercePLPPage.getPriceText();
      logger.verify(
        `${site.name} price matches AUD format $X.XX`,
        LocalizationExpectations.auPricePattern.toString(),
        priceText,
      );

      logger.step('Step 3 - Assert price matches AUD format');
      expect(
        priceText,
        `Expected a price in $X.XX format on the ${site.name} PLP — got: "${priceText}"`,
      ).toMatch(LocalizationExpectations.auPricePattern);
    });
  }
});
