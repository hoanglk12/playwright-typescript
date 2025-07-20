import { ApiResponseWrapper } from '../../ApiResponse';
import { ApiClient } from '../../ApiClient';
import { DeviceData, ApiObject } from './restful-api-models';
/**
 * RestfulApiClient for interacting with the device API
 * Provides methods for CRUD operations on device objects
 */
export class RestfulApiClient extends ApiClient {
  
  constructor(options: { baseURL: string; timeout?: number }) {
    super(options);
  }

  /**
   * Get all objects with pagination
   */
  async getAllObjects(): Promise<ApiObject[]> {
    const response = await this.get('/objects');
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject[]>();
  }

  /**
   * Get all objects with response wrapper for advanced assertions
   */
  async getAllObjectsWithWrapper(): Promise<ApiResponseWrapper> {
    const response = await this.get('/objects');
    return new ApiResponseWrapper(response);
  }

  /**
   * Get objects by IDs
   */
  async getObjectsByIds(ids: string[]): Promise<ApiObject[]> {
    const idsParam = ids.join(',');
    const response = await this.get(`/objects?id=${idsParam}`);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject[]>();
  }

  /**
   * Get objects by IDs with response wrapper for advanced assertions
   */
  async getObjectsByIdsWithWrapper(ids: string[]): Promise<ApiResponseWrapper> {
    const idsParam = ids.join(',');
    const response = await this.get(`/objects?id=${idsParam}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Get single object by ID
   */
  async getObjectById(id: string): Promise<ApiObject> {
    const response = await this.get(`/objects/${id}`);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  /**
   * Get single object by ID with response wrapper for advanced assertions
   */
  async getObjectByIdWithWrapper(id: string): Promise<ApiResponseWrapper> {
    const response = await this.get(`/objects/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Create a new object
   */
  async createObject(data: DeviceData): Promise<ApiObject> {
    const response = await this.post('/objects', data);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  /**
   * Create a new object with response wrapper for advanced assertions
   */
  async createObjectWithWrapper(data: DeviceData): Promise<ApiResponseWrapper> {
    const response = await this.post('/objects', data);
    return new ApiResponseWrapper(response);
  }

  /**
   * Update an existing object (PUT)
   */
  async updateObject(id: string, data: DeviceData): Promise<ApiObject> {
    const response = await this.put(`/objects/${id}`, data);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  /**
   * Update an existing object with response wrapper for advanced assertions
   */
  async updateObjectWithWrapper(id: string, data: DeviceData): Promise<ApiResponseWrapper> {
    const response = await this.put(`/objects/${id}`, data);
    return new ApiResponseWrapper(response);
  }

  /**
   * Partially update an object (PATCH)
   */
  async partialUpdateObject(id: string, data: Partial<DeviceData>): Promise<ApiObject> {
    const response = await this.patch(`/objects/${id}`, data);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  /**
   * Partially update an object with response wrapper for advanced assertions
   */
  async partialUpdateObjectWithWrapper(id: string, data: Partial<DeviceData>): Promise<ApiResponseWrapper> {
    const response = await this.patch(`/objects/${id}`, data);
    return new ApiResponseWrapper(response);
  }

  /**
   * Delete an object
   */
  async deleteObject(id: string): Promise<void> {
    const response = await this.delete(`/objects/${id}`);
    const wrapper = new ApiResponseWrapper(response);
    
    // Verify the deletion was successful
    if (!wrapper.isSuccess()) {
      throw new Error(`Failed to delete object ${id}. Status: ${wrapper.statusCode()}`);
    }
  }

  /**
   * Delete an object with response wrapper for advanced assertions
   */
  async deleteObjectWithWrapper(id: string): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/objects/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Create multiple objects at once
   */
  async createMultipleObjects(devices: DeviceData[]): Promise<ApiObject[]> {
    const createdObjects: ApiObject[] = [];
    
    for (const device of devices) {
      const created = await this.createObject(device);
      createdObjects.push(created);
    }
    
    return createdObjects;
  }

  /**
   * Create multiple objects at once with response wrappers for advanced assertions
   */
  async createMultipleObjectsWithWrappers(devices: DeviceData[]): Promise<ApiResponseWrapper[]> {
    const responseWrappers: ApiResponseWrapper[] = [];
    
    for (const device of devices) {
      const wrapper = await this.createObjectWithWrapper(device);
      responseWrappers.push(wrapper);
    }
    
    return responseWrappers;
  }

  /**
   * Search objects by name
   */
  async searchObjectsByName(name: string): Promise<ApiObject[]> {
    const allObjects = await this.getAllObjects();
    return allObjects.filter(obj => 
      obj.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  /**
   * Search objects by name with response wrapper for advanced assertions
   */
  async searchObjectsByNameWithWrapper(name: string): Promise<{ wrapper: ApiResponseWrapper; filteredObjects: ApiObject[] }> {
    const wrapper = await this.getAllObjectsWithWrapper();
    const allObjects = await wrapper.json<ApiObject[]>();
    const filteredObjects = allObjects.filter(obj => 
      obj.name.toLowerCase().includes(name.toLowerCase())
    );
    
    return { wrapper, filteredObjects };
  }
}