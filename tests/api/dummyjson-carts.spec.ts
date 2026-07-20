import { apiTest as test, expect } from '../../src/api/ApiTest';
import {
  DummyJsonDataGenerator,
  DUMMYJSON_KNOWN_CART_ID,
  DUMMYJSON_KNOWN_USER_ID,
  DUMMYJSON_UNKNOWN_ID,
} from '../../src/data/api/dummyjson-data';
import { CartsListResponse, Cart, DeletedResource } from '../../src/api/services/dummyjson';
import { ApiResponseWrapper } from '../../src/api/ApiResponse';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('DummyJSON Carts API @api @regression', () => {
  test('TC_01 - Should list carts with pagination metadata', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_01 Should list carts with pagination metadata');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /carts', async () => {
      response = await dummyjsonService.getAllCarts();
    });

    await logger.step('Step 2 - Assert response shape and pagination metadata', async () => {
      await response.assertStatus(200);
      const body = await response.json<CartsListResponse>();
      softAssert.toBeTruthy(Array.isArray(body.carts), 'carts is an array');
      softAssert.toBeGreaterThan(body.total, 0, 'total is greater than 0');
      softAssert.toBe(body.skip, 0, 'skip defaults to 0');
      softAssert.toBeTruthy(body.carts.length <= body.limit, 'carts length does not exceed limit');
    });
  });

  test('TC_02 - Should get a cart by known ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_02 Should get a cart by known ID');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /carts/{id}', async () => {
      response = await dummyjsonService.getCartById(DUMMYJSON_KNOWN_CART_ID);
    });

    await logger.step('Step 2 - Assert cart returned matches requested ID', async () => {
      await response.assertStatus(200);
      await response.assertJsonPath('id', DUMMYJSON_KNOWN_CART_ID);
    });
  });

  test('TC_03 - Should return 404 for an unknown cart ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_03 Should return 404 for an unknown cart ID');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /carts/{unknownId}', async () => {
      response = await dummyjsonService.getCartById(DUMMYJSON_UNKNOWN_ID);
    });

    await logger.step('Step 2 - Assert not found', async () => {
      await response.assertStatus(404);
    });
  });

  test('TC_04 - Should get carts for a user discovered from a known cart', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_04 Should get carts for a user discovered from a known cart');

    let userId!: number;
    await logger.step('Step 1 - GET /carts/{id} to discover a valid userId', async () => {
      const knownCartResponse = await dummyjsonService.getCartById(DUMMYJSON_KNOWN_CART_ID);
      userId = await knownCartResponse.extract<number>('userId');
      test.skip(!userId, 'No userId available on the known cart to discover');
    });

    let response!: ApiResponseWrapper;
    await logger.step('Step 2 - GET /carts/user/{userId}', async () => {
      response = await dummyjsonService.getCartsByUser(userId);
    });

    await logger.step('Step 3 - Assert carts belonging to the discovered user are returned', async () => {
      await response.assertStatus(200);
      const body = await response.json<CartsListResponse>();
      expect(Array.isArray(body.carts)).toBe(true);
      expect(body.carts.every((cart) => cart.userId === userId)).toBe(true);
    });
  });

  test('TC_05 - Should add a new cart (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_05 Should add a new cart (simulated)');
    const newCart = DummyJsonDataGenerator.generateCart(DUMMYJSON_KNOWN_USER_ID);

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - POST /carts/add', async () => {
      response = await dummyjsonService.addCart(newCart);
    });

    await logger.step('Step 2 - Assert simulated cart echoes submitted userId', async () => {
      await response.assertStatus(201);
      const created = await response.json<Cart>();
      softAssert.toBeDefined(created.id, 'simulated cart has an id');
      softAssert.toBe(created.userId, newCart.userId, 'userId echoes submitted value');
    });
  });

  test('TC_06 - Should update a cart (simulated)', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_06 Should update a cart (simulated)');
    const update = DummyJsonDataGenerator.generateCart(DUMMYJSON_KNOWN_USER_ID);

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - PUT /carts/{id}', async () => {
      response = await dummyjsonService.updateCart(DUMMYJSON_KNOWN_CART_ID, { products: update.products });
    });

    await logger.step('Step 2 - Assert simulated update returns the cart ID', async () => {
      await response.assertStatus(200);
      await response.assertJsonPath('id', DUMMYJSON_KNOWN_CART_ID);
    });
  });

  test('TC_07 - Should delete a cart (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_07 Should delete a cart (simulated)');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - DELETE /carts/{id}', async () => {
      response = await dummyjsonService.deleteCart(DUMMYJSON_KNOWN_CART_ID);
    });

    await logger.step('Step 2 - Assert isDeleted/deletedOn markers on the mutation response only', async () => {
      await response.assertStatus(200);
      const deleted = await response.json<Cart & DeletedResource>();
      softAssert.toBeTruthy(deleted.isDeleted, 'isDeleted is true');
      softAssert.toBeDefined(deleted.deletedOn, 'deletedOn is present');
    });
  });
});
