import { apiTest as test, expect } from '../../src/api/ApiTest';
import {
  DummyJsonDataGenerator,
  DUMMYJSON_KNOWN_PRODUCT_ID,
  DUMMYJSON_UNKNOWN_ID,
} from '../../src/data/api/dummyjson-data';
import { ProductsListResponse, Product, DeletedResource } from '../../src/api/services/dummyjson';
import { ApiResponseWrapper } from '../../src/api/ApiResponse';
import { createTestLogger } from '../../src/utils/test-logger';

test.describe('DummyJSON Products API @api @regression', () => {
  test('TC_01 - Should list products with pagination metadata', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_01 Should list products with pagination metadata');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /products', async () => {
      response = await dummyjsonService.getAllProducts();
    });

    await logger.step('Step 2 - Assert response shape and pagination metadata', async () => {
      await response.assertStatus(200);
      const body = await response.json<ProductsListResponse>();
      softAssert.toBeTruthy(Array.isArray(body.products), 'products is an array');
      softAssert.toBeGreaterThan(body.total, 0, 'total is greater than 0');
      softAssert.toBe(body.skip, 0, 'skip defaults to 0');
      softAssert.toBeTruthy(body.products.length <= body.limit, 'products length does not exceed limit');
    });
  });

  test('TC_02 - Should get a product by known ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_02 Should get a product by known ID');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /products/{id}', async () => {
      response = await dummyjsonService.getProductById(DUMMYJSON_KNOWN_PRODUCT_ID);
    });

    await logger.step('Step 2 - Assert product returned matches requested ID', async () => {
      await response.assertStatus(200);
      await response.assertJsonPath('id', DUMMYJSON_KNOWN_PRODUCT_ID);
    });
  });

  test('TC_03 - Should return 404 for an unknown product ID', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_03 Should return 404 for an unknown product ID');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /products/{unknownId}', async () => {
      response = await dummyjsonService.getProductById(DUMMYJSON_UNKNOWN_ID);
    });

    await logger.step('Step 2 - Assert not found', async () => {
      await response.assertStatus(404);
    });
  });

  test('TC_04 - Should search products by query string', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_04 Should search products by query string');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - GET /products/search?q=phone', async () => {
      response = await dummyjsonService.searchProducts('phone');
    });

    await logger.step('Step 2 - Assert search results are returned', async () => {
      await response.assertStatus(200);
      const body = await response.json<ProductsListResponse>();
      expect(Array.isArray(body.products)).toBe(true);
    });
  });

  test('TC_05 - Should add a new product (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_05 Should add a new product (simulated)');
    const newProduct = DummyJsonDataGenerator.generateProduct();

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - POST /products/add', async () => {
      response = await dummyjsonService.addProduct(newProduct);
    });

    await logger.step('Step 2 - Assert simulated product echoes submitted data', async () => {
      await response.assertStatus(201);
      const created = await response.json<Product>();
      softAssert.toBeDefined(created.id, 'simulated product has an id');
      softAssert.toBe(created.title, newProduct.title, 'title echoes submitted value');
    });
  });

  test('TC_06 - Should update a product (simulated)', async ({ dummyjsonService }) => {
    const logger = createTestLogger('TC_06 Should update a product (simulated)');
    const update = DummyJsonDataGenerator.generateProductUpdate();

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - PUT /products/{id}', async () => {
      response = await dummyjsonService.updateProduct(DUMMYJSON_KNOWN_PRODUCT_ID, update);
    });

    await logger.step('Step 2 - Assert simulated update echoes submitted title', async () => {
      await response.assertStatus(200);
      await response.assertJsonPath('title', update.title);
    });
  });

  test('TC_07 - Should delete a product (simulated)', async ({ dummyjsonService, softAssert }) => {
    const logger = createTestLogger('TC_07 Should delete a product (simulated)');

    let response!: ApiResponseWrapper;
    await logger.step('Step 1 - DELETE /products/{id}', async () => {
      response = await dummyjsonService.deleteProduct(DUMMYJSON_KNOWN_PRODUCT_ID);
    });

    await logger.step('Step 2 - Assert isDeleted/deletedOn markers on the mutation response only', async () => {
      await response.assertStatus(200);
      const deleted = await response.json<Product & DeletedResource>();
      softAssert.toBeTruthy(deleted.isDeleted, 'isDeleted is true');
      softAssert.toBeDefined(deleted.deletedOn, 'deletedOn is present');
    });
  });
});
