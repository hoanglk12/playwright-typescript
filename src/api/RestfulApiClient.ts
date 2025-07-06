import { APIRequestContext, APIResponse } from '@playwright/test';
import { ApiClient } from './ApiClient';
import { DeviceData, ApiObject, PaginatedResponse } from '../api/services/restful-device/restful-api-models';

export class RestfulApiClient extends ApiClient {
  
  constructor(options: { baseURL: string; timeout?: number }) {
    super(options);
  }

  /**
   * Get all objects with pagination
   */
  async getAllObjects(): Promise<ApiObject[]> {
    const response = await this.get('/objects');
    return response.json();
  }

  /**
   * Get objects by IDs
   */
  async getObjectsByIds(ids: string[]): Promise<ApiObject[]> {
    const idsParam = ids.join(',');
    const response = await this.get(`/objects?id=${idsParam}`);
    return response.json();
  }

  /**
   * Get single object by ID
   */
  async getObjectById(id: string): Promise<ApiObject> {
    const response = await this.get(`/objects/${id}`);
    return response.json();
  }

  /**
   * Create a new object
   */
  async createObject(data: DeviceData): Promise<ApiObject> {
    const response = await this.post('/objects', data);
    return response.json();
  }

  /**
   * Update an existing object (PUT)
   */
  async updateObject(id: string, data: DeviceData): Promise<ApiObject> {
    const response = await this.put(`/objects/${id}`, data);
    return response.json();
  }

  /**
   * Partially update an object (PATCH)
   */
  async partialUpdateObject(id: string, data: Partial<DeviceData>): Promise<ApiObject> {
    const response = await this.patch(`/objects/${id}`, data);
    return response.json();
  }

  /**
   * Delete an object
   */
  async deleteObject(id: string): Promise<void> {
    await this.delete(`/objects/${id}`);
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
   * Search objects by name
   */
  async searchObjectsByName(name: string): Promise<ApiObject[]> {
    const allObjects = await this.getAllObjects();
    return allObjects.filter(obj => 
      obj.name.toLowerCase().includes(name.toLowerCase())
    );
  }
}