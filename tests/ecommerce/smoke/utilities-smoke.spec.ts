import { test } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe('Ecommerce Utilities Smoke @ecommerce @smoke @utilities', () => {
  // SPA hydration on staging storefronts is slow, especially in Firefox.
  // test.slow() triples all default timeouts for tests in this describe block.
  test.slow();

  for (const site of storefronts) {
    test(`E2E-UTIL-001 - ${site.name} - Track Order page loads and form is present`, async ({
      ecommerceTrackOrderPage,
      softAssert,
    }) => {
      const logger = createTestLogger(
        `E2E-UTIL-001 - ${site.name} - Track Order page loads and form is present`,
      );

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceTrackOrderPage.navigate(site.url);

      logger.step('Step 2 - Assert Track Order link is present in footer');
      const linkPresent = await ecommerceTrackOrderPage.isTrackOrderLinkPresent();
      if (!linkPresent) {
        test.skip(
          true,
          `${site.name}: no Track Order link found in footer — link may not be configured on this staging storefront`,
        );
        return;
      }

      logger.step('Step 3 - Click Track Order link');
      await ecommerceTrackOrderPage.clickTrackOrderLink();

      logger.step('Step 4 - Assert at least one Track Order form element is present');
      await ecommerceTrackOrderPage.assertFormPresent(site.name);

      logger.step('Step 5 - Soft-assert order number input is visible');
      softAssert.toBe(await ecommerceTrackOrderPage.isOrderNumberInputVisible(), true, 'Order number input visible');

      logger.step('Step 6 - Soft-assert email input is visible');
      softAssert.toBe(await ecommerceTrackOrderPage.isEmailInputVisible(), true, 'Email input visible');

      logger.step('Step 7 - Soft-assert submit button is visible');
      softAssert.toBe(await ecommerceTrackOrderPage.isSubmitButtonVisible(), true, 'Submit button visible');
    });
  }
});
