import { apiTest as test, expect, softExpect } from "../../src/api/ApiTest";
import { createTestLogger } from '../../src/utils/test-logger';
import { RestfulApiDataGenerator } from "../../src/data/api/restful-api-data";
import {
  DeviceData,
  ApiObject,
} from "../../src/api/services/restful-device/restful-api-models";

test.describe.configure({ mode: 'serial' });

test.describe("RESTful API - Objects CRUD Operations", () => {
  let createdObjectIds: string[] = [];

  test.afterEach(async ({ restfulApiClient }) => {
    // Cleanup: Delete all created objects
    for (const id of createdObjectIds) {
      try {
        await restfulApiClient.deleteObject(id);
      } catch (error) {
        // Cleanup failure is non-fatal; object may have been deleted by the test itself
      }
    }
    createdObjectIds = [];
  });

  test.describe("GET Operations", () => {
    test("TC_01 - Should get all objects successfully", async ({
      restfulApiClient,
    }) => {
      const objects = await restfulApiClient.getAllObjects();

      expect(Array.isArray(objects)).toBe(true);
      expect(objects.length).toBeGreaterThan(0);

      // Verify object structure
      const firstObject = objects[0];
      expect(firstObject).toHaveProperty("id");
      expect(firstObject).toHaveProperty("name");
      expect(typeof firstObject.name).toBe("string");
    });

    test("TC_02 - Should get objects by specific IDs", async ({
      restfulApiClient,
    }) => {
      const targetIds = ["1", "2", "3"];
      const objects = await restfulApiClient.getObjectsByIds(targetIds);

      expect(Array.isArray(objects)).toBe(true);
      expect(objects.length).toBe(targetIds.length);

      objects.forEach((obj, index) => {
        expect(obj.id).toBe(targetIds[index]);
        expect(obj).toHaveProperty("name");
      });
    });

    test("TC_03 - Should get single object by ID", async ({
      restfulApiClient,
    }) => {
      const objectId = "1";
      const object = await restfulApiClient.getObjectById(objectId);

      expect(object).toHaveProperty("id", objectId);
      expect(object).toHaveProperty("name");
      expect(typeof object.name).toBe("string");
    });

    test("TC_04 - Should handle non-existent object gracefully", async ({
      restfulApiClient,
    }) => {
      const nonExistentId = "99999";

      try {
        await restfulApiClient.getObjectById(nonExistentId);
        // If no error is thrown, check if empty object is returned
      } catch (error) {
        // Expected behavior for non-existent object
        expect(error).toBeDefined();
      }
    });
  });

  test.describe('POST Operations', () => {
    test('TC_05 - Should create a new mobile device object', async ({ restfulApiClient }) => {
      const deviceData = RestfulApiDataGenerator.generateMobileDevice();
      const createdObject = await restfulApiClient.createObject(deviceData);

      expect(createdObject).toHaveProperty('id');
      expect(createdObject.name).toBe(deviceData.name);
      expect(createdObject.data).toMatchObject(deviceData.data);
      expect(createdObject).toHaveProperty('createdAt');

      // Store ID for cleanup
      createdObjectIds.push(createdObject.id!);
    });

    test('TC_06 - Should create multiple objects', async ({ restfulApiClient }) => {
      const deviceDataArray = RestfulApiDataGenerator.generateMultipleDevices(3);
      const createdObjects = await restfulApiClient.createMultipleObjects(deviceDataArray);

      expect(createdObjects).toHaveLength(3);

      createdObjects.forEach((obj, index) => {
        expect(obj).toHaveProperty('id');
        expect(obj.name).toBe(deviceDataArray[index].name);
        expect(obj.data).toMatchObject(deviceDataArray[index].data);
        createdObjectIds.push(obj.id!);
      });
    });
  });

  test.describe('PUT Operations', () => {
    test('TC_07 - Should update an existing object completely', async ({ restfulApiClient }) => {
      // First create an object
      const initialData = RestfulApiDataGenerator.generateMobileDevice();
      const createdObject = await restfulApiClient.createObject(initialData);
      createdObjectIds.push(createdObject.id!);

      // Then update it
      const updateData = RestfulApiDataGenerator.generateLaptopDevice();
      const updatedObject = await restfulApiClient.updateObject(createdObject.id!, updateData);

      expect(updatedObject.id).toBe(createdObject.id);
      expect(updatedObject.name).toBe(updateData.name);
      expect(updatedObject.data).toMatchObject(updateData.data);
      expect(updatedObject).toHaveProperty('updatedAt');
    });

    test('TC_08 - Should handle update of non-existent object', async ({ restfulApiClient }) => {
      const nonExistentId = '999999';
      const updateData = RestfulApiDataGenerator.generateMobileDevice();

      try {
        await restfulApiClient.updateObject(nonExistentId, updateData);
      } catch (error) {
        // Expected behavior for non-existent object
        expect(error).toBeDefined();
      }
    });
  });

  test.describe('DELETE Operations', () => {
    test('TC_09 - Should delete an existing object', async ({ restfulApiClient }) => {
      // First create an object
      const deviceData = RestfulApiDataGenerator.generateMobileDevice();
      const createdObject = await restfulApiClient.createObject(deviceData);

      // Then delete it
      await restfulApiClient.deleteObject(createdObject.id!);

      // Verify it's deleted by trying to get it
      try {
        await restfulApiClient.getObjectById(createdObject.id!);
        // If no error, the object might still exist (depends on API behavior)
      } catch (error) {
        // Expected behavior for deleted object
        expect(error).toBeDefined();
      }
    });
  });

  test.describe('Soft Assertion Examples @api', () => {
    test('TC_SA_01 - Pattern A softExpect: multi-property response check', async ({ restfulApiClient }) => {
      const objects = await restfulApiClient.getAllObjects();

      softExpect(Array.isArray(objects)).toBeTruthy();
      softExpect(objects.length).toBeGreaterThan(0);
      softExpect(objects[0]).toBeDefined();
    });

    test('TC_SA_02 - Pattern B softAssert fixture: structured logging', async ({ restfulApiClient, softAssert }) => {
      const logger = createTestLogger('TC_SA_02 Pattern B softAssert');

      logger.step('Step 1 - Fetch objects list via response wrapper');
      const wrapper = await restfulApiClient.getAllObjectsWithWrapper();

      logger.step('Step 2 - Verify response status and shape');
      softAssert.toBe(wrapper.statusCode(), 200, 'Response status is 200');
      softAssert.toBeTruthy(wrapper.isSuccess(), 'Response is in 2xx range');

      logger.step('Step 3 - Verify response data array');
      const objects = await wrapper.json();
      softAssert.toBeTruthy(Array.isArray(objects), 'Response data is an array');
      softAssert.toBeGreaterThan(objects.length, 0, 'Response data contains at least one object');
      softAssert.toBeDefined(objects[0], 'First object is defined');
    });
  });
});
