import { ApiClient } from '../../ApiClient';
import { ApiResponseWrapper } from '../../ApiResponse';
import { 
    AuthRequest, 
    AuthResponse, 
    BookingFilterParams, 
    BookingRequest,
    UpdateBookingRequest,
    PartialUpdateBookingRequest,

} from './models';

/**
 * Implementation of https://restful-booker.herokuapp.com/apidoc/index.html
 *
 * Most operations use token-based auth (stored in a cookie); delete operations may also
 * need basic auth depending on the API's state, hence the extra Authorization header below.
 */
export class RestfulBookerService extends ApiClient {
    private tokenKey = 'restful-booker-token';

    constructor(options: { baseURL: string; timeout?: number }) {
        super(options);
    }

    async authenticate(username: string, password: string): Promise<ApiResponseWrapper> {
        const authReq: AuthRequest = { username, password };
        
        const response = await this.post('/auth', authReq, {
            'Content-Type': 'application/json'
        });
        
        const wrapper = new ApiResponseWrapper(response);
        const data = await wrapper.json<AuthResponse>();
        
        if (data && data.token) {
            ApiClient.storeToken(this.tokenKey, data.token);
        }
        
        return wrapper;
    }
    
    async getBookingIds(filters?: BookingFilterParams): Promise<ApiResponseWrapper> {
        const response = await this.get('/booking', filters);
        return new ApiResponseWrapper(response);
    }
    
    async getBooking(id: number): Promise<ApiResponseWrapper> {
        const response = await this.get(`/booking/${id}`, undefined);
        return new ApiResponseWrapper(response);
    }
    
    async createBooking(booking: BookingRequest): Promise<ApiResponseWrapper> {
        const response = await this.post('/booking', booking, {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        });
        return new ApiResponseWrapper(response);
    }
    async updateBooking(id: number, booking: UpdateBookingRequest): Promise<ApiResponseWrapper> {
        const token = ApiClient.getToken(this.tokenKey);
        if (!token) {
            throw new Error('Authentication token not found. Please authenticate first.');
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': `token=${token}`
        };
        
        const response = await this.put(`/booking/${id}`, booking, headers);
        return new ApiResponseWrapper(response);
    }
    async partialUpdateBooking(id: number, partialBooking: PartialUpdateBookingRequest): Promise<ApiResponseWrapper> {
        const token = ApiClient.getToken(this.tokenKey);
        if (!token) {
            throw new Error('Authentication token not found. Please authenticate first.');
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': `token=${token}`
        };
        
        const response = await this.patch(`/booking/${id}`, partialBooking, headers);
        return new ApiResponseWrapper(response);
    }
    async deleteBooking(id: number): Promise<ApiResponseWrapper> {
        const token = ApiClient.getToken(this.tokenKey);
        if (!token) {
            throw new Error('Authentication token not found. Please authenticate first.');
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Cookie': `token=${token}`,
            'Authorization': `Basic YWRtaW46cGFzc3dvcmQxMjM=` // admin:password123 in base64
        };
        
        const response = await this.delete(`/booking/${id}`, headers);
        return new ApiResponseWrapper(response);
    }
    
    async healthCheck(): Promise<ApiResponseWrapper> {
        const response = await this.get('/ping');
        return new ApiResponseWrapper(response);
    }
}
