import { test, expect, softExpect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { invalidCredentials } from '@data/ecommerce/test-accounts';
import { createTestLogger } from '@utils/test-logger';
import {
  navigateToPlp,
  findProductWithAvailableSizes,
  getPreferredNavLabel,
  shouldPreferMens,
  selectFirstPurchasableSize,
  ensureCartOverlayOpen,
} from './smoke-helpers';

test.describe('Ecommerce Error Handling Smoke @ecommerce @smoke @error-handling', () => {
  // These SPA staging sites need extra time to hydrate, especially in Firefox
  test.slow();

  for (const site of storefronts) {
    test(`E2E-ERR-001 - ${site.name} 404 page shows brand error UI with Back to Home`, async ({
      ecommerceErrorPage,
    }) => {
      const logger = createTestLogger(`E2E-ERR-001 - ${site.name} 404 page`);

      await logger.step('Step 1 - Navigate to a non-existent URL', async () => {
        await ecommerceErrorPage.navigateToNotFound(site.url);
      });

      await logger.step('Step 2 - Assert Back to Home button visible', async () => {
        await ecommerceErrorPage.assertBackToHomeVisible();
      });

      await logger.step('Step 3 - Assert brand error UI visible', async () => {
        await ecommerceErrorPage.assertBrandErrorUiVisible(site.brandName, site.name);
      });
    });
  }

  for (const site of storefronts) {
    test(`E2E-ERR-003 - ${site.name} - Add to Cart without size shows validation`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
    }) => {
      const logger = createTestLogger(`E2E-ERR-003 - ${site.name} - Add to Cart without size shows validation`);

      let navLabel!: string;
      await logger.step('Step 1 - Determine preferred nav label', async () => {
        const preferMens = shouldPreferMens(site);
        navLabel = getPreferredNavLabel(site, preferMens) ?? '';
      });
      if (!navLabel) {
        test.skip(true, `${site.name}: no nav label configured`);
        return;
      }

      await logger.step('Step 2 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 3 - Find product with available sizes and land on PDP', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found on PLP`);
        return;
      }

      await logger.step('Step 4 - Dismiss overlay if present', async () => {
        await ecommercePDPPage.ensureNoOverlay();
      });

      let initialCartCount = 0;
      await logger.step('Step 5 - Read initial cart count', async () => {
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
      });

      await logger.step('Step 6 - Click Add to Cart without selecting a size', async () => {
        await ecommercePDPPage.addToCart();
      });

      await logger.step('Step 7 - Assert size validation message appears', async () => {
        expect(
          await ecommercePDPPage.hasSizeValidationMessage(),
          'Expected size validation message after ATC without size selection',
        ).toBe(true);
      });

      await logger.step('Step 8 - Assert cart count did not increase (secondary signal)', async () => {
        softExpect(await ecommercePDPPage.getMiniCartCount()).toBe(initialCartCount);
      });
    });
  }

  for (const site of storefronts) {
    test(`E2E-ERR-005 - ${site.name} - Login with wrong password shows error`, async ({
      ecommerceAccountModalPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`E2E-ERR-005 - ${site.name} - Wrong Password Error`);

      await logger.step('Step 1 - Navigate to storefront homepage', async () => {
        await ecommerceAccountModalPage.navigate(site.url);
      });

      await logger.step('Step 2 - Click account icon to open login modal', async () => {
        await ecommerceAccountModalPage.openModal();
      });

      await logger.step('Step 3 - Wait for modal to appear', async () => {
        await ecommerceAccountModalPage.waitForModalVisible();
      });

      await logger.step('Step 4 - Assert login modal is visible before submitting', async () => {
        const modalVisible = await ecommerceAccountModalPage.isModalVisible();
        logger.verify('Login modal visible', true, modalVisible);
        expect(modalVisible).toBe(true);
      });

      let errorBeforeSubmit = '';
      await logger.step('Step 5 - Capture baseline (no error before submit)', async () => {
        errorBeforeSubmit = await ecommerceAccountModalPage.getLoginErrorMessage();
      });

      await logger.step('Step 6 - Fill wrong password credentials and click Login', async () => {
        const creds = invalidCredentials[site.name];
        await ecommerceAccountModalPage.login(creds.email, creds.password);
      });

      await logger.step('Step 7 - Wait for error message to appear', async () => {
        await ecommerceAccountModalPage.waitForLoginError();
      });

      await logger.step('Step 8 - Assert error appeared only after failed login', async () => {
        const errorAfterSubmit = await ecommerceAccountModalPage.getLoginErrorMessage();
        softAssert.toBeTruthy(
          errorBeforeSubmit.length === 0 && errorAfterSubmit.length > 0,
          `Error message appeared only after failed login on ${site.name}`,
        );

        const stillLoggedOut = !(await ecommerceAccountModalPage.isLoggedIn());
        softAssert.toBeTruthy(stillLoggedOut, `User remains logged out after failed login on ${site.name}`);
      });
    });
  }

  for (const site of storefronts) {
    test(`E2E-ERR-006 - ${site.name} - Checkout required fields blank shows validation`, async ({
      ecommerceNavPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
    }) => {
      const logger = createTestLogger(
        `E2E-ERR-006 - ${site.name} - Checkout required fields blank shows validation`,
      );

      let navLabel!: string;
      await logger.step('Step 1 - Determine preferred nav label', async () => {
        const preferMens = shouldPreferMens(site);
        navLabel = getPreferredNavLabel(site, preferMens) ?? '';
      });
      if (!navLabel) {
        test.skip(true, `${site.name}: no nav label configured`);
        return;
      }

      await logger.step('Step 2 - Navigate to PLP', async () => {
        await navigateToPlp(ecommerceNavPage, ecommercePLPPage, site, navLabel);
      });

      let availableSizes: string[] = [];
      await logger.step('Step 3 - Find product with available sizes and land on PDP', async () => {
        availableSizes = await findProductWithAvailableSizes(ecommercePLPPage, ecommercePDPPage);
      });
      if (availableSizes.length === 0) {
        test.skip(true, `${site.name}: no product with available sizes found on PLP`);
        return;
      }

      await logger.step('Step 4 - Dismiss overlay if present', async () => {
        await ecommercePDPPage.ensureNoOverlay();
      });

      let targetSize: string | null = null;
      await logger.step('Step 5 - Select first purchasable size and Add to Cart', async () => {
        targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
      });
      if (targetSize === null) {
        test.skip(true, `${site.name}: no purchasable size found after trying ${availableSizes.slice(0, 3).join(', ')}`);
        return;
      }

      let initialCartCount = 0;
      await logger.step('Step 6 - Wait for cart count to increment', async () => {
        logger.action('Add to Cart', `size ${targetSize}`);
        initialCartCount = await ecommercePDPPage.getMiniCartCount();
        await ecommercePDPPage.addToCart();
        await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
      });

      await logger.step('Step 7 - Ensure cart overlay is open', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
      });

      await logger.step('Step 8 - Click checkout CTA from overlay', async () => {
        await ecommerceCheckoutPage.clickCheckoutCtaFromOverlay();
      });

      await logger.step('Step 9 - Wait for checkout state to load', async () => {
        await ecommerceCheckoutPage.waitForCheckoutLoad();
      });

      await logger.step('Step 10 - Verify checkout state is active (hard precondition)', async () => {
        const onCheckout = await ecommerceCheckoutPage.isOnCheckoutPage();
        logger.verify('Checkout state active', true, onCheckout);
        expect(
          onCheckout,
          `${site.name}: expected checkout auth modal or /checkout URL after clicking checkout CTA`,
        ).toBe(true);
      });

      await logger.step('Step 11 - Submit current checkout step without filling required fields', async () => {
        await ecommerceCheckoutPage.submitCurrentStep();
      });

      await logger.step('Step 12 - Assert required field validation is visible', async () => {
        const hasValidation = await ecommerceCheckoutPage.hasRequiredFieldValidation();
        const messages = await ecommerceCheckoutPage.getValidationMessages();
        logger.verify(
          'Required field validation visible',
          true,
          hasValidation,
        );
        expect(
          hasValidation,
          `${site.name}: expected required-field validation after blank checkout submission. Messages found: ${JSON.stringify(messages)}`,
        ).toBe(true);
      });
    });
  }
});
