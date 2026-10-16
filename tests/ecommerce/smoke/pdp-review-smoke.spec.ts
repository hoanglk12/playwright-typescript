import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { PdpReviewSectionData } from '@data/ecommerce/review-data';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';
import { getPreferredNavLabel, navigateToPlp } from './smoke-helpers';

test.describe('Ecommerce PDP Review Section Smoke @ecommerce @smoke @pdp @reviews', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-REV-002-${String(index + 1).padStart(3, '0')}`;
    const navLabel = getPreferredNavLabel(site);

    test(`${tcId} - ${site.name} review section renders on PDP`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} PDP review section`);

      if (!navLabel) {
        test.skip(true, `${site.name} has no nav link configured for PLP navigation`);
        return;
      }

      await logger.step('Steps 1-5 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      await logger.step('Step 6 - Wait for a product with a non-zero rating', async () => {
        await expect
          .poll(async () => {
            const rated = await ecommercePLPPage.getRatedInlineRatingCount();
            if (rated === 0) await ecommercePLPPage.triggerInlineRatingRender();
            return rated;
          }, {
            message: `Expected at least 1 product with a non-zero rating on the ${site.name} PLP`,
            timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          })
          .toBeGreaterThan(0);
      });

      await logger.step('Step 7 - Open the first rated product', async () => {
        await ecommercePLPPage.clickFirstRatedProductCard();
        await ecommercePDPPage.waitForPdpLoad();
      });

      await logger.step('Step 8 - Assert Rating Snapshot is shown', async () => {
        await expect
          .poll(() => ecommercePDPPage.reviewSectionContains(PdpReviewSectionData.ratingSnapshotPattern), {
            message: `Expected the ${site.name} PDP review section to show Rating Snapshot`,
            timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          })
          .toBe(true);
      });

      await logger.step('Step 9 - Assert Overall Rating is shown', async () => {
        await expect
          .poll(() => ecommercePDPPage.reviewSectionContains(PdpReviewSectionData.overallRatingPattern), {
            message: `Expected the ${site.name} PDP review section to show Overall Rating`,
            timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          })
          .toBe(true);
      });
    });
  }
});
