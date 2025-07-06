export interface DeviceData {
  id?: string;
  name: string;
  data: {
    color?: string;
    capacity?: string;
    'capacity GB'?: number;
    price?: number;
    generation?: string;
    year?: number;
    'CPU model'?: string;
    'Hard disk size'?: string;
  };
}

export interface ApiObject {
  id?: string;
  name: string;
  data?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  data: T[];
  page: number;
  per_page: number;
  total_pages: number;
}