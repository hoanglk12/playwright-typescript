import { apiTest as test, expect } from '../../src/api/ApiTest';
import { dummyJsonAuthData, DUMMYJSON_INVALID_TOKEN } from '../../src/data/api/dummyjson-data';
import { AuthResponse } from '../../src/api/services/dummyjson';
import { ApiResponseWrapper } from '../../src/api/ApiResponse';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('DummyJSON Auth API @api @regression', () => {
  test('TC_01 - Should login with valid credentials and return tokens', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_01 Should login with valid credentials and return tokens');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - POST /auth/login with valid credentials', async () => {
      response = await dummyjsonService.login(
        dummyJsonAuthData.VALID_USER.username,
        dummyJsonAuthData.VALID_USER.password
      );
    });

    await logger.step('Step 2 - Assert response status and token pair', async () => {
      await response.assertStatus(200);
      const auth = await response.json<AuthResponse>();
      softAssert.toBeTruthy(!!auth.accessToken, 'accessToken is present');
      softAssert.toBeTruthy(!!auth.refreshToken, 'refreshToken is present');
      softAssert.toBe(auth.username, dummyJsonAuthData.VALID_USER.username, 'username matches request');
    });
  });

  test('TC_02 - Should return 400 for invalid credentials', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_02 Should return 400 for invalid credentials');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - POST /auth/login with invalid credentials', async () => {
      response = await dummyjsonService.login(
        dummyJsonAuthData.INVALID_USER.username,
        dummyJsonAuthData.INVALID_USER.password
      );
    });

    await logger.step('Step 2 - Assert unauthorized status', async () => {
      await response.assertStatus(400);
    });
  });

  test('TC_03 - Should get authenticated user with a valid token', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_03 Should get authenticated user with a valid token');

    await logger.step('Step 1 - Login to obtain a fresh token', async () => {
      await dummyjsonService.login(dummyJsonAuthData.VALID_USER.username, dummyJsonAuthData.VALID_USER.password);
    });

    let response!: ApiResponseWrapper;
    await logger.step('Step 2 - GET /auth/me using the stored token', async () => {
      response = await dummyjsonService.getAuthenticatedUser();
    });

    await logger.step('Step 3 - Assert authenticated user is returned', async () => {
      await response.assertStatus(200);
      logger.verify('Authenticated username matches login', dummyJsonAuthData.VALID_USER.username, await response.extract('username'));
      expect(await response.extract('username')).toBe(dummyJsonAuthData.VALID_USER.username);
    });
  });

  test('TC_04 - Should return 401 for an invalid token', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_04 Should return 401 for an invalid token');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /auth/me with an obviously invalid bearer token', async () => {
      response = await dummyjsonService.getAuthenticatedUser(DUMMYJSON_INVALID_TOKEN);
    });

    await logger.step('Step 2 - Assert unauthorized status', async () => {
      await response.assertStatus(401);
    });
  });

  test('TC_05 - Should issue a new access token via refresh', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_05 Should issue a new access token via refresh');

    let loginAuth!: AuthResponse;
    await logger.step('Step 1 - Login to obtain a refresh token', async () => {
      const loginResponse = await dummyjsonService.login(
        dummyJsonAuthData.VALID_USER.username,
        dummyJsonAuthData.VALID_USER.password
      );
      loginAuth = await loginResponse.json<AuthResponse>();
    });

    let refreshResponse!: ApiResponseWrapper;
    await logger.step('Step 2 - POST /auth/refresh with the refresh token', async () => {
      refreshResponse = await dummyjsonService.refreshAccessToken(loginAuth.refreshToken);
    });

    await logger.step('Step 3 - Assert a new token pair is returned', async () => {
      await refreshResponse.assertStatus(200);
      const refreshed = await refreshResponse.json<{ accessToken: string; refreshToken: string }>();
      softAssert.toBeTruthy(!!refreshed.accessToken, 'new accessToken is present');
      softAssert.toBeTruthy(!!refreshed.refreshToken, 'new refreshToken is present');
    });
  });
});
