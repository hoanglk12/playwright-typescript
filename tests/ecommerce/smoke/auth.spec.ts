import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import {
  invalidCredentials,
  nonExistentCredentials,
} from '@data/ecommerce/test-accounts';
import { createFreshAccountViaGraphQL } from './smoke-helpers';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';

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
      request,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Successful Login`);

      logger.step('Steps 1-2 - Create fresh account via GraphQL API');
      const { creds, created, skipReason } = await createFreshAccountViaGraphQL(request, site);
      if (!created) {
        test.skip(true, `Account creation failed for ${site.name}: ${skipReason}`);
        return;
      }

      logger.step('Step 3 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 4 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 5 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 6 - Assert login modal is visible before submitting credentials');
      const modalVisibleBeforeLogin = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible before login', true, modalVisibleBeforeLogin);
      expect(modalVisibleBeforeLogin).toBe(true);

      logger.step('Step 7 - Fill fresh credentials and click Login');
      await ecommerceAccountModalPage.login(creds.email, creds.password);

      logger.step('Step 8 - Wait for login to complete (best-effort)');
      await ecommerceAccountModalPage.waitForLoginComplete();

      logger.step('Step 9 - Assert login success signals');
      const modalClosedAfterLogin = !(await ecommerceAccountModalPage.isModalVisible());
      const overallLoggedIn = await ecommerceAccountModalPage.isLoggedIn();

      softAssert.toBeTruthy(modalClosedAfterLogin, `Account panel closed after login on ${site.name}`);

      logger.verify('At least one login success signal confirmed', true, overallLoggedIn);
      expect(overallLoggedIn).toBe(true);
    });
  }
});

test.describe('Ecommerce Auth - Invalid Login @ecommerce @smoke @auth', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-AUTH-003-${String(index + 1).padStart(3, '0')}`;
    test(`${tcId} - ${site.name} Failed login with invalid password shows error`, async ({
      ecommerceAccountModalPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Failed Login`);

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 2 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 3 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 4 - Assert login modal is visible before submitting');
      const modalVisible = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible', true, modalVisible);
      expect(modalVisible).toBe(true);

      logger.step('Step 5 - Capture baseline (no error before submit)');
      const errorBeforeSubmit = await ecommerceAccountModalPage.getLoginErrorMessage();

      logger.step('Step 6 - Fill invalid credentials and click Login');
      const creds = invalidCredentials[site.name];
      await ecommerceAccountModalPage.login(creds.email, creds.password);

      logger.step('Step 7 - Wait for error message to appear');
      await ecommerceAccountModalPage.waitForLoginError();

      logger.step('Step 8 - Assert error appeared only after failed login');
      const errorAfterSubmit = await ecommerceAccountModalPage.getLoginErrorMessage();
      softAssert.toBeTruthy(
        errorBeforeSubmit.length === 0 && errorAfterSubmit.length > 0,
        `Error message appeared only after failed login on ${site.name}`,
      );

      const stillLoggedOut = !(await ecommerceAccountModalPage.isLoggedIn());
      softAssert.toBeTruthy(stillLoggedOut, `User remains logged out after failed login on ${site.name}`);
    });
  }
});

test.describe('Ecommerce Auth - Non-existent Email Login @ecommerce @smoke @auth', () => {
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-AUTH-004-${String(index + 1).padStart(3, '0')}`;
    test(`${tcId} - ${site.name} Failed login with non-existent email shows error`, async ({
      ecommerceAccountModalPage,
      softAssert,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Non-existent Email Login`);

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 2 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 3 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 4 - Assert login modal is visible before submitting');
      const modalVisible = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible', true, modalVisible);
      expect(modalVisible).toBe(true);

      logger.step('Step 5 - Capture baseline (no error before submit)');
      const errorBeforeSubmit = await ecommerceAccountModalPage.getLoginErrorMessage();

      logger.step('Step 6 - Fill non-existent email credentials and click Login');
      const creds = nonExistentCredentials[site.name];
      await ecommerceAccountModalPage.login(creds.email, creds.password);

      logger.step('Step 7 - Wait for error message to appear');
      await ecommerceAccountModalPage.waitForLoginError();

      logger.step('Step 8 - Assert error appeared only after failed login attempt');
      const errorAfterSubmit = await ecommerceAccountModalPage.getLoginErrorMessage();
      softAssert.toBeTruthy(
        errorBeforeSubmit.length === 0 && errorAfterSubmit.length > 0,
        `Error message appeared only after failed login with non-existent email on ${site.name}`,
      );

      const stillLoggedOut = !(await ecommerceAccountModalPage.isLoggedIn());
      softAssert.toBeTruthy(stillLoggedOut, `User remains logged out after non-existent email attempt on ${site.name}`);
    });
  }
});

test.describe('Ecommerce Auth - Brand Title @ecommerce @smoke @auth', () => {
  // SPA staging sites need extra time to hydrate before the account panel loads
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-AUTH-011-${String(index + 1).padStart(3, '0')}`;
    test(`${tcId} - ${site.name} Login modal title matches brand`, async ({
      ecommerceAccountModalPage,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Login Modal Brand Title`);

      logger.step('Step 1 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 2 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 3 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 4 - Assert login modal is visible (precondition guard)');
      const modalVisible = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible', true, modalVisible);
      expect(modalVisible).toBe(true);

      logger.step('Step 5 - Assert login panel contains the brand name (retrying until CMS block renders)');

      // Derive the brand token from site.name by stripping the market suffix (" AU" / " NZ").
      // Use only the last word of the brand token so that multi-word brands like
      // "Dr. Martens" also match panel headings that show only the last word
      // (e.g. "LOGIN TO MARTENS"). Single-word brands are unaffected.
      // toContainText with a timeout retries until the lazily-loaded CMS block
      // injects the branded heading — avoids the race where a single innerText()
      // snapshot reads "Email Address" before "LOGIN TO {BRAND}" renders.
      const brandToken = site.name.replace(/\s+(AU|NZ)$/i, '').trim();
      const brandLastWord = brandToken.split(/\s+/).pop() ?? brandToken;
      const escapedToken = brandLastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const brandRegex = new RegExp(escapedToken, 'i');

      logger.verify(
        `Login panel contains brand identifier "${brandLastWord}"`,
        brandRegex.toString(),
        `(retrying via expect(locator).toContainText until ${TIMEOUTS.ELEMENT_VISIBLE}ms)`,
      );
      await expect(ecommerceAccountModalPage.getModalPanel()).toContainText(brandRegex, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      });
    });
  }
});

test.describe('Ecommerce Auth - Logout @ecommerce @smoke @auth', () => {
  // SPA staging sites need extra time for login + logout round-trips
  test.slow();

  for (const [index, site] of storefronts.entries()) {
    const tcId = `E2E-AUTH-010-${String(index + 1).padStart(3, '0')}`;
    test(`${tcId} - ${site.name} Logout clears session and redirects`, async ({
      ecommerceAccountModalPage,
      softAssert,
      request,
    }) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Logout`);

      logger.step('Steps 1-2 - Create fresh account via GraphQL API');
      const { creds, created, skipReason } = await createFreshAccountViaGraphQL(request, site);
      if (!created) {
        test.skip(true, `Account creation failed for ${site.name}: ${skipReason}`);
        return;
      }

      logger.step('Step 3 - Navigate to storefront homepage');
      await ecommerceAccountModalPage.navigate(site.url);

      logger.step('Step 4 - Click account icon to open login modal');
      await ecommerceAccountModalPage.openModal();

      logger.step('Step 5 - Wait for modal to appear');
      await ecommerceAccountModalPage.waitForModalVisible();

      logger.step('Step 6 - Assert login modal is visible before submitting credentials');
      const modalVisibleBeforeLogin = await ecommerceAccountModalPage.isModalVisible();
      logger.verify('Login modal visible before login', true, modalVisibleBeforeLogin);
      expect(modalVisibleBeforeLogin).toBe(true);

      logger.step('Step 7 - Fill fresh credentials and click Login');
      await ecommerceAccountModalPage.login(creds.email, creds.password);

      logger.step('Step 8 - Wait for login to complete');
      await ecommerceAccountModalPage.waitForLoginComplete();

      logger.step('Step 9 - Assert login success signal (precondition for logout test)');
      const isLoggedIn = await ecommerceAccountModalPage.isLoggedIn();
      logger.verify('User is logged in before logout attempt', true, isLoggedIn);
      expect(isLoggedIn).toBe(true);

      logger.step('Step 10 - Open account panel while authenticated');
      await ecommerceAccountModalPage.openModalWhenLoggedIn();

      logger.step('Step 11 - Click logout button');
      await ecommerceAccountModalPage.logout();

      logger.step('Step 12 - Wait for login form — panel transitions in place on most storefronts');
      await ecommerceAccountModalPage.waitForLoginFormVisible();

      logger.step('Step 13 - Re-open account panel only if it closed post-logout');
      if (!(await ecommerceAccountModalPage.isLoginFormVisible())) {
        await ecommerceAccountModalPage.openModalPostLogout();
        await ecommerceAccountModalPage.waitForLoginFormVisible();
      }

      logger.step('Step 14 - Assert login form is visible (positive logout confirmation)');
      const loginFormVisible = await ecommerceAccountModalPage.isLoginFormVisible();
      logger.verify('Login form visible after logout', true, loginFormVisible);
      expect(loginFormVisible).toBe(true);

      logger.step('Step 15 - Soft-assert individual login form inputs are visible');
      await softAssert.toBeVisible(
        ecommerceAccountModalPage.getEmailInput(),
        `Email input visible after logout on ${site.name}`,
      );
      await softAssert.toBeVisible(
        ecommerceAccountModalPage.getPasswordInput(),
        `Password input visible after logout on ${site.name}`,
      );
    });
  }
});
