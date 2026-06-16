import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe('Ecommerce Auth Smoke @ecommerce @smoke @auth', () => {
  // SPA staging sites need extra time to hydrate, especially in Firefox
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-AUTH-001-${String(index + 1).padStart(3, '0')}`;
    test(`${tcId} - ${site.name} Login modal opens via account icon in header`, async ({
      ecommerceAccountModalPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Login Modal`);

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 2 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 3 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 4 - Assert login modal is visible');
      const modalVisible = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible', true, modalVisible);
      expect(modalVisible).toBe(true);

      logger.step('Step 5 - Assert login form inputs and button are visible');
      await expect(ecommerceAccountModalPage.getEmailInput()).toBeVisible();
      await expect(ecommerceAccountModalPage.getPasswordInput()).toBeVisible();
      await expect(ecommerceAccountModalPage.getLoginButton()).toBeVisible();

      logger.step('Step 6 - Assert modal title is non-empty');
      const modalTitle = await ecommerceAccountModalPage.getModalTitle();
      softAssert.toBeTruthy(modalTitle.length > 0, `Modal title non-empty on ${site.name}`);
    });
  }
});
