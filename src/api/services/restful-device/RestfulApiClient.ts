import { ApiResponseWrapper } from '../../ApiResponse';
import { ApiClient } from '../../ApiClient';
import { DeviceData, ApiObject } from './restful-api-models';
export class RestfulApiClient extends ApiClient {
  
  constructor(options: { baseURL: string; timeout?: number }) {
    super(options);
  }

  async getAllObjects(): Promise<ApiObject[]> {
    const response = await this.get('/objects');
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject[]>();
  }

  async getAllObjectsWithWrapper(): Promise<ApiResponseWrapper> {
    const response = await this.get('/objects');
    return new ApiResponseWrapper(response);
  }

  async getObjectsByIds(ids: string[]): Promise<ApiObject[]> {
    const idsParam = ids.join(',');
    const response = await this.get(`/objects?id=${idsParam}`);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject[]>();
  }

  async getObjectsByIdsWithWrapper(ids: string[]): Promise<ApiResponseWrapper> {
    const idsParam = ids.join(',');
    const response = await this.get(`/objects?id=${idsParam}`);
    return new ApiResponseWrapper(response);
  }

  async getObjectById(id: string): Promise<ApiObject> {
    const response = await this.get(`/objects/${id}`);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  async getObjectByIdWithWrapper(id: string): Promise<ApiResponseWrapper> {
    const response = await this.get(`/objects/${id}`);
    return new ApiResponseWrapper(response);
  }

  async createObject(data: DeviceData): Promise<ApiObject> {
    const response = await this.post('/objects', data);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  async createObjectWithWrapper(data: DeviceData): Promise<ApiResponseWrapper> {
    const response = await this.post('/objects', data);
    return new ApiResponseWrapper(response);
  }

  async updateObject(id: string, data: DeviceData): Promise<ApiObject> {
    const response = await this.put(`/objects/${id}`, data);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  async updateObjectWithWrapper(id: string, data: DeviceData): Promise<ApiResponseWrapper> {
    const response = await this.put(`/objects/${id}`, data);
    return new ApiResponseWrapper(response);
  }

  async partialUpdateObject(id: string, data: Partial<DeviceData>): Promise<ApiObject> {
    const response = await this.patch(`/objects/${id}`, data);
    const wrapper = new ApiResponseWrapper(response);
    return wrapper.json<ApiObject>();
  }

  async partialUpdateObjectWithWrapper(id: string, data: Partial<DeviceData>): Promise<ApiResponseWrapper> {
    const response = await this.patch(`/objects/${id}`, data);
    return new ApiResponseWrapper(response);
  }

  async deleteObject(id: string): Promise<void> {
    const response = await this.delete(`/objects/${id}`);
    const wrapper = new ApiResponseWrapper(response);
    
    if (!wrapper.isSuccess()) {
      throw new Error(`Failed to delete object ${id}. Status: ${wrapper.statusCode()}`);
    }
  }

  async deleteObjectWithWrapper(id: string): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/objects/${id}`);
    return new ApiResponseWrapper(response);
  }

  async createMultipleObjects(devices: DeviceData[]): Promise<ApiObject[]> {
    const createdObjects: ApiObject[] = [];
    
    for (const device of devices) {
      const created = await this.createObject(device);
      createdObjects.push(created);
    }
    
    return createdObjects;
  }

  async createMultipleObjectsWithWrappers(devices: DeviceData[]): Promise<ApiResponseWrapper[]> {
    const responseWrappers: ApiResponseWrapper[] = [];
    
    for (const device of devices) {
      const wrapper = await this.createObjectWithWrapper(device);
      responseWrappers.push(wrapper);
    }
    
    return responseWrappers;
  }

  async searchObjectsByName(name: string): Promise<ApiObject[]> {
    const allObjects = await this.getAllObjects();
    return allObjects.filter(obj => 
      obj.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  async searchObjectsByNameWithWrapper(name: string): Promise<{ wrapper: ApiResponseWrapper; filteredObjects: ApiObject[] }> {
    const wrapper = await this.getAllObjectsWithWrapper();
    const allObjects = await wrapper.json<ApiObject[]>();
    const filteredObjects = allObjects.filter(obj => 
      obj.name.toLowerCase().includes(name.toLowerCase())
    );
    
    return { wrapper, filteredObjects };
  }
}