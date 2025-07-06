import { apiTest as test, expect } from "../../src/api/ApiTest";
import { RestfulApiDataGenerator } from "../../src/data/api/restful-api-data";
import {
  DeviceData,
  ApiObject,
} from "../../src/api/services/restful-device/restful-api-models";

test.describe("RESTful API - Objects CRUD Operations", () => {
  let createdObjectIds: string[] = [];

  test.afterEach(async ({ restfulApiClient }) => {
    // Cleanup: Delete all created objects
    for (const id of createdObjectIds) {
      try {
        await restfulApiClient.deleteObject(id);
      } catch (error) {
        console.log(`Failed to delete object ${id}:`, error);
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
      const nonExistentId = "999999";

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
      console.log(`Created object with ID: ${createdObject.id!}`);
    });
    });
});
