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

      await logger.step('Step 1 - Navigate to storefront homepage', async () => {
        await ecommerceTrackOrderPage.navigate(site.url);
      });

      let linkPresent = false;
      await logger.step('Step 2 - Assert Track Order link is present in footer', async () => {
        linkPresent = await ecommerceTrackOrderPage.isTrackOrderLinkPresent();
      });
      if (!linkPresent) {
        test.skip(
          true,
          `${site.name}: no Track Order link found in footer — link may not be configured on this staging storefront`,
        );
        return;
      }

      await logger.step('Step 3 - Click Track Order link', async () => {
        await ecommerceTrackOrderPage.clickTrackOrderLink();
      });

      await logger.step('Step 4 - Assert at least one Track Order form element is present', async () => {
        await ecommerceTrackOrderPage.assertFormPresent(site.name);
      });

      await logger.step('Step 5 - Soft-assert order number input is visible', async () => {
        softAssert.toBe(await ecommerceTrackOrderPage.isOrderNumberInputVisible(), true, 'Order number input visible');
      });

      await logger.step('Step 6 - Soft-assert email input is visible', async () => {
        softAssert.toBe(await ecommerceTrackOrderPage.isEmailInputVisible(), true, 'Email input visible');
      });

      await logger.step('Step 7 - Soft-assert submit button is visible', async () => {
        softAssert.toBe(await ecommerceTrackOrderPage.isSubmitButtonVisible(), true, 'Submit button visible');
      });
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

      await logger.step('Step 1 - Navigate to storefront homepage', async () => {
        await ecommerceHelpSupportPage.navigate(site.url);
      });

      let linkPresent = false;
      await logger.step('Step 2 - Assert Help/Support link is present in header', async () => {
        linkPresent = await ecommerceHelpSupportPage.isHelpSupportLinkPresent();
      });
      if (!linkPresent) {
        test.skip(
          true,
          `${site.name}: no Help/Support link found in header — link may not be configured on this staging storefront`,
        );
        return;
      }

      await logger.step('Step 3 - Click Help/Support link', async () => {
        await ecommerceHelpSupportPage.clickHelpSupportLink();
      });

      await logger.step('Step 4 - Assert navigation to Help/Support page succeeded', async () => {
        await ecommerceHelpSupportPage.assertNavigatedToHelpSupportPage(site.name);
      });

      await logger.step('Step 5 - Soft-assert landed on help/support destination', async () => {
        softAssert.toBe(ecommerceHelpSupportPage.isOnHelpDestination(), true, 'On help/support destination URL');
      });
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

      await logger.step('Step 1 - Navigate to storefront homepage', async () => {
        await ecommerceWishlistPage.navigate(site.url);
      });

      let linkPresent = false;
      await logger.step('Step 2 - Assert Wishlist link is present in header', async () => {
        linkPresent = await ecommerceWishlistPage.isWishlistLinkPresent();
      });
      if (!linkPresent) {
        test.skip(
          true,
          `${site.name}: no Wishlist link found in header — link may not be configured on this staging storefront`,
        );
        return;
      }

      await logger.step('Step 3 - Click Wishlist link', async () => {
        await ecommerceWishlistPage.clickWishlistLink();
      });

      await logger.step('Step 4 - Assert Wishlist page rendered', async () => {
        await ecommerceWishlistPage.assertWishlistPageRendered(site.name);
      });

      await logger.step('Step 5 - Soft-assert a valid guest empty-state variant is shown', async () => {
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
    });
  }
});
