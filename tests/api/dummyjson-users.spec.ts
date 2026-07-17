import { apiTest as test, expect } from '../../src/api/ApiTest';
import {
  DummyJsonDataGenerator,
  DUMMYJSON_KNOWN_USER_ID,
  DUMMYJSON_UNKNOWN_ID,
} from '../../src/data/api/dummyjson-data';
import { UsersListResponse, User, DeletedResource } from '../../src/api/services/dummyjson';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('DummyJSON Users API @api @regression', () => {
  test('TC_01 - Should list users with pagination metadata', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_01 Should list users with pagination metadata');

    logger.step('Step 1 - GET /users');
    const response = await dummyjsonService.getAllUsers();

    logger.step('Step 2 - Assert response shape and pagination metadata');
    await response.assertStatus(200);
    const body = await response.json<UsersListResponse>();
    softAssert.toBeTruthy(Array.isArray(body.users), 'users is an array');
    softAssert.toBeGreaterThan(body.total, 0, 'total is greater than 0');
    softAssert.toBe(body.skip, 0, 'skip defaults to 0');
    softAssert.toBeTruthy(body.users.length <= body.limit, 'users length does not exceed limit');
  });

  test('TC_02 - Should get a user by known ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_02 Should get a user by known ID');

    logger.step('Step 1 - GET /users/{id}');
    const response = await dummyjsonService.getUserById(DUMMYJSON_KNOWN_USER_ID);

    logger.step('Step 2 - Assert user returned matches requested ID');
    await response.assertStatus(200);
    await response.assertJsonPath('id', DUMMYJSON_KNOWN_USER_ID);
  });

  test('TC_03 - Should return 404 for an unknown user ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_03 Should return 404 for an unknown user ID');

    logger.step('Step 1 - GET /users/{unknownId}');
    const response = await dummyjsonService.getUserById(DUMMYJSON_UNKNOWN_ID);

    logger.step('Step 2 - Assert not found');
    await response.assertStatus(404);
  });

  test('TC_04 - Should search users by query string', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_04 Should search users by query string');

    logger.step('Step 1 - GET /users/search?q=emily');
    const response = await dummyjsonService.searchUsers('emily');

    logger.step('Step 2 - Assert search results are returned');
    await response.assertStatus(200);
    const body = await response.json<UsersListResponse>();
    expect(Array.isArray(body.users)).toBe(true);
  });

  test('TC_05 - Should add a new user (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_05 Should add a new user (simulated)');
    const newUser = DummyJsonDataGenerator.generateUser();

    logger.step('Step 1 - POST /users/add');
    const response = await dummyjsonService.addUser(newUser);

    logger.step('Step 2 - Assert simulated user echoes submitted data');
    await response.assertStatus(201);
    const created = await response.json<User>();
    softAssert.toBeDefined(created.id, 'simulated user has an id');
    softAssert.toBe(created.firstName, newUser.firstName, 'firstName echoes submitted value');
    softAssert.toBe(created.lastName, newUser.lastName, 'lastName echoes submitted value');
  });

  test('TC_06 - Should update a user (simulated)', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_06 Should update a user (simulated)');
    const update = DummyJsonDataGenerator.generateUserUpdate();

    logger.step('Step 1 - PUT /users/{id}');
    const response = await dummyjsonService.updateUser(DUMMYJSON_KNOWN_USER_ID, update);

    logger.step('Step 2 - Assert simulated update echoes submitted firstName');
    await response.assertStatus(200);
    await response.assertJsonPath('firstName', update.firstName);
  });

  test('TC_07 - Should delete a user (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_07 Should delete a user (simulated)');

    logger.step('Step 1 - DELETE /users/{id}');
    const response = await dummyjsonService.deleteUser(DUMMYJSON_KNOWN_USER_ID);

    logger.step('Step 2 - Assert isDeleted/deletedOn markers on the mutation response only');
    await response.assertStatus(200);
    const deleted = await response.json<User & DeletedResource>();
    softAssert.toBeTruthy(deleted.isDeleted, 'isDeleted is true');
    softAssert.toBeDefined(deleted.deletedOn, 'deletedOn is present');
  });
});
