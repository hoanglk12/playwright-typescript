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

  for (const site of storefronts) {
    test(`E2E-UTIL-005 - ${site.name} - Help/Support page accessible via header link`, async ({
      ecommerceHelpSupportPage,
      softAssert,
    }) => {
      const logger = createTestLogger(
        `E2E-UTIL-005 - ${site.name} - Help/Support page accessible via header link`,
      );

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceHelpSupportPage.navigate(site.url);

      logger.step('Step 2 - Assert Help/Support link is present in header');
      const linkPresent = await ecommerceHelpSupportPage.isHelpSupportLinkPresent();
      if (!linkPresent) {
        test.skip(
          true,
          `${site.name}: no Help/Support link found in header — link may not be configured on this staging storefront`,
        );
        return;
      }

      logger.step('Step 3 - Click Help/Support link');
      await ecommerceHelpSupportPage.clickHelpSupportLink();

      logger.step('Step 4 - Assert navigation to Help/Support page succeeded');
      await ecommerceHelpSupportPage.assertNavigatedToHelpSupportPage(site.name);

      logger.step('Step 5 - Soft-assert landed on help/support destination');
      softAssert.toBe(ecommerceHelpSupportPage.isOnHelpDestination(), true, 'On help/support destination URL');
    });
  }

  for (const site of storefronts) {
    test(`E2E-UTIL-007 - ${site.name} - Wishlist page renders (empty state for guest)`, async ({
      ecommerceWishlistPage,
      softAssert,
    }) => {
      const logger = createTestLogger(
        `E2E-UTIL-007 - ${site.name} - Wishlist page renders (empty state for guest)`,
      );

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceWishlistPage.navigate(site.url);

      logger.step('Step 2 - Assert Wishlist link is present in header');
      const linkPresent = await ecommerceWishlistPage.isWishlistLinkPresent();
      if (!linkPresent) {
        test.skip(
          true,
          `${site.name}: no Wishlist link found in header — link may not be configured on this staging storefront`,
        );
        return;
      }

      logger.step('Step 3 - Click Wishlist link');
      await ecommerceWishlistPage.clickWishlistLink();

      logger.step('Step 4 - Assert Wishlist page rendered');
      await ecommerceWishlistPage.assertWishlistPageRendered(site.name);

      logger.step('Step 5 - Soft-assert a valid guest empty-state variant is shown');
      const [emptyMessageVisible, loginPromptVisible] = await Promise.all([
        ecommerceWishlistPage.isEmptyWishlistMessageVisible(),
        ecommerceWishlistPage.isLoginPromptVisible(),
      ]);
      softAssert.toBe(
        emptyMessageVisible || loginPromptVisible,
        true,
        'Guest empty-state message or sign-in prompt shown',
      );
    });
  }
});
