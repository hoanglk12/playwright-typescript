import { apiTest as test, expect } from '../../src/api/ApiTest';
import {
  DummyJsonDataGenerator,
  DUMMYJSON_KNOWN_CART_ID,
  DUMMYJSON_KNOWN_USER_ID,
  DUMMYJSON_UNKNOWN_ID,
} from '../../src/data/api/dummyjson-data';
import { CartsListResponse, Cart, DeletedResource } from '../../src/api/services/dummyjson';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('DummyJSON Carts API @api @regression', () => {
  test('TC_01 - Should list carts with pagination metadata', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_01 Should list carts with pagination metadata');

    logger.step('Step 1 - GET /carts');
    const response = await dummyjsonService.getAllCarts();

    logger.step('Step 2 - Assert response shape and pagination metadata');
    await response.assertStatus(200);
    const body = await response.json<CartsListResponse>();
    softAssert.toBeTruthy(Array.isArray(body.carts), 'carts is an array');
    softAssert.toBeGreaterThan(body.total, 0, 'total is greater than 0');
    softAssert.toBe(body.skip, 0, 'skip defaults to 0');
    softAssert.toBeTruthy(body.carts.length <= body.limit, 'carts length does not exceed limit');
  });

  test('TC_02 - Should get a cart by known ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_02 Should get a cart by known ID');

    logger.step('Step 1 - GET /carts/{id}');
    const response = await dummyjsonService.getCartById(DUMMYJSON_KNOWN_CART_ID);

    logger.step('Step 2 - Assert cart returned matches requested ID');
    await response.assertStatus(200);
    await response.assertJsonPath('id', DUMMYJSON_KNOWN_CART_ID);
  });

  test('TC_03 - Should return 404 for an unknown cart ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_03 Should return 404 for an unknown cart ID');

    logger.step('Step 1 - GET /carts/{unknownId}');
    const response = await dummyjsonService.getCartById(DUMMYJSON_UNKNOWN_ID);

    logger.step('Step 2 - Assert not found');
    await response.assertStatus(404);
  });

  test('TC_04 - Should get carts for a user discovered from a known cart', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_04 Should get carts for a user discovered from a known cart');

    logger.step('Step 1 - GET /carts/{id} to discover a valid userId');
    const knownCartResponse = await dummyjsonService.getCartById(DUMMYJSON_KNOWN_CART_ID);
    const userId = await knownCartResponse.extract<number>('userId');
    test.skip(!userId, 'No userId available on the known cart to discover');

    logger.step('Step 2 - GET /carts/user/{userId}');
    const response = await dummyjsonService.getCartsByUser(userId);

    logger.step('Step 3 - Assert carts belonging to the discovered user are returned');
    await response.assertStatus(200);
    const body = await response.json<CartsListResponse>();
    expect(Array.isArray(body.carts)).toBe(true);
    expect(body.carts.every((cart) => cart.userId === userId)).toBe(true);
  });

  test('TC_05 - Should add a new cart (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_05 Should add a new cart (simulated)');
    const newCart = DummyJsonDataGenerator.generateCart(DUMMYJSON_KNOWN_USER_ID);

    logger.step('Step 1 - POST /carts/add');
    const response = await dummyjsonService.addCart(newCart);

    logger.step('Step 2 - Assert simulated cart echoes submitted userId');
    await response.assertStatus(201);
    const created = await response.json<Cart>();
    softAssert.toBeDefined(created.id, 'simulated cart has an id');
    softAssert.toBe(created.userId, newCart.userId, 'userId echoes submitted value');
  });

  test('TC_06 - Should update a cart (simulated)', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_06 Should update a cart (simulated)');
    const update = DummyJsonDataGenerator.generateCart(DUMMYJSON_KNOWN_USER_ID);

    logger.step('Step 1 - PUT /carts/{id}');
    const response = await dummyjsonService.updateCart(DUMMYJSON_KNOWN_CART_ID, { products: update.products });

    logger.step('Step 2 - Assert simulated update returns the cart ID');
    await response.assertStatus(200);
    await response.assertJsonPath('id', DUMMYJSON_KNOWN_CART_ID);
  });

  test('TC_07 - Should delete a cart (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_07 Should delete a cart (simulated)');

    logger.step('Step 1 - DELETE /carts/{id}');
    const response = await dummyjsonService.deleteCart(DUMMYJSON_KNOWN_CART_ID);

    logger.step('Step 2 - Assert isDeleted/deletedOn markers on the mutation response only');
    await response.assertStatus(200);
    const deleted = await response.json<Cart & DeletedResource>();
    softAssert.toBeTruthy(deleted.isDeleted, 'isDeleted is true');
    softAssert.toBeDefined(deleted.deletedOn, 'deletedOn is present');
  });
});
