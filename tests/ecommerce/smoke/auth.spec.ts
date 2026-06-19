import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { testAccounts } from '@data/ecommerce/test-accounts';
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

test.describe('Ecommerce Auth - Login @ecommerce @smoke @auth', () => {
  // SPA staging sites need extra time for login round-trips and React hydration
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-AUTH-002-${String(index + 1).padStart(3, '0')}`;
    test(`${tcId} - ${site.name} Successful login with valid credentials`, async ({
      ecommerceAccountModalPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Successful Login`);

      logger.step('Step 1 - Look up test credentials for this site');
      const creds = testAccounts[site.name];
      if (!creds) {
        test.skip(true, `No test account configured for ${site.name}`);
        return;
      }
      if (!creds.password) {
        test.skip(true, `GRA_TEST_PASSWORD env var is not set — skipping login test for ${site.name}`);
        return;
      }

      logger.step('Step 2 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 3 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 4 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 5 - Assert login modal is visible before submitting credentials');
      const modalVisibleBeforeLogin = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible before login', true, modalVisibleBeforeLogin);
      expect(modalVisibleBeforeLogin).toBe(true);

      logger.step('Step 6 - Fill credentials and click Login');
      await ecommerceAccountModalPage.login(creds.email, creds.password);

      logger.step('Step 7 - Wait for login to complete (best-effort)');
      await ecommerceAccountModalPage.waitForLoginComplete();

      logger.step('Step 8 - Assert login success signals');
      const modalClosedAfterLogin = !(await ecommerceAccountModalPage.isModalVisible());
      const overallLoggedIn = await ecommerceAccountModalPage.isLoggedIn();

      softAssert.toBeTruthy(modalClosedAfterLogin, `Account panel closed after login on ${site.name}`);

      logger.verify('At least one login success signal confirmed', true, overallLoggedIn);
      expect(overallLoggedIn).toBe(true);
    });
  }
});
