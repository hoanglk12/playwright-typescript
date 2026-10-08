import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { PlpRatingData } from '@data/ecommerce/review-data';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import { getPreferredNavLabel, navigateToPlp } from './smoke-helpers';

test.describe('Ecommerce PLP Star Rating Smoke @ecommerce @smoke @plp @reviews', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-REV-001-${String(index + 1).padStart(3, '0')}`;
    const navLabel = getPreferredNavLabel(site);

    test(`${tcId} - ${site.name} star rating displays on PLP cards`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} PLP star rating`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      await logger.step('Step 6 - Assert product count is greater than zero', async () => {
        const count = await ecommercePLPPage.getProductCount();
        logger.verify(`${site.name} PLP product count > 0`, '>0', String(count));
        expect(count, `Expected at least 1 product card on the PLP for ${site.name}`).toBeGreaterThan(0);
      });

      await logger.step('Step 7 - Wait for Bazaarvoice inline ratings to render', async () => {
        await expect
          .poll(async () => {
            const rendered = await ecommercePLPPage.getRenderedInlineRatingCount();
            if (rendered === 0) await ecommercePLPPage.triggerInlineRatingRender();
            return rendered;
          }, {
            message: `Expected at least 1 rendered inline rating on the ${site.name} PLP`,
            timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          })
          .toBeGreaterThan(0);
      });

      await logger.step('Step 8 - Assert rendered rating carries a valid value', async () => {
        await expect
          .poll(() => ecommercePLPPage.getFirstInlineRatingLabel(), {
            message: `Expected the first rendered rating on ${site.name} to carry a rating label`,
            timeout: TIMEOUTS.ELEMENT_VISIBLE,
          })
          .toMatch(PlpRatingData.ratingLabelPattern);
        const label = await ecommercePLPPage.getFirstInlineRatingLabel();
        const match = PlpRatingData.ratingLabelPattern.exec(label);
        const rating = match ? Number(match[1]) : Number.NaN;
        logger.verify(`${site.name} first rating within range`, `${PlpRatingData.minRating}-${PlpRatingData.maxRating}`, String(rating));
        expect(rating, `Rating parsed from "${label}"`).toBeGreaterThanOrEqual(PlpRatingData.minRating);
        expect(rating, `Rating parsed from "${label}"`).toBeLessThanOrEqual(PlpRatingData.maxRating);
      });
    });
  }
});
