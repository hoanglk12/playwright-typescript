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
 * RestfulBooker API Service
 * Implementation of https://restful-booker.herokuapp.com/apidoc/index.html
 * 
 * Note: The Restful Booker API has some specific authentication requirements:
 * 1. For most operations, a token-based auth is used (stored in a cookie)
 * 2. For delete operations, both token-based and basic auth may be needed depending on the API state
 * 3. The API resets every 10 minutes, which can affect test stability
 */
export class RestfulBookerService extends ApiClient {
    private tokenKey = 'restful-booker-token';

    /**
     * Creates a new RestfulBookerService
     * @param options - Configuration options including baseURL and timeout
     */
    constructor(options: { baseURL: string; timeout?: number }) {
        super(options);
    }

    /**
     * Authenticate with the API and get a token
     * @param username - Username for authentication
     * @param password - Password for authentication
     * @returns Auth response with token
     */
    async authenticate(username: string, password: string): Promise<ApiResponseWrapper> {
        const authReq: AuthRequest = { username, password };
        
        const response = await this.post('/auth', authReq, {
            'Content-Type': 'application/json'
        });
        
        const wrapper = new ApiResponseWrapper(response);
        const data = await wrapper.json<AuthResponse>();
        
        // Store the token for reuse
        if (data && data.token) {
            ApiClient.storeToken(this.tokenKey, data.token);
        }
        
        return wrapper;
    }
    
    /**
     * Get all booking IDs
     * @param filters - Optional filters for the bookings
     * @returns Response with booking IDs
     */
    async getBookingIds(filters?: BookingFilterParams): Promise<ApiResponseWrapper> {
        const response = await this.get('/booking', filters);
        return new ApiResponseWrapper(response);
    }
    
    /**
     * Get a specific booking by ID
     * @param id - Booking ID to retrieve
     * @returns Response with booking details
     */
    async getBooking(id: number): Promise<ApiResponseWrapper> {
        const response = await this.get(`/booking/${id}`, undefined);
        return new ApiResponseWrapper(response);
    }
    
    /**
     * Create a new booking
     * @param booking - Booking data to create
     * @returns Response with created booking
     */
    async createBooking(booking: BookingRequest): Promise<ApiResponseWrapper> {
        const response = await this.post('/booking', booking, {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        });
        return new ApiResponseWrapper(response);
    }
      /**
     * Update a booking (requires auth token)
     * @param id - Booking ID to update
     * @param booking - Updated booking data
     * @returns Response with updated booking
     */
    async updateBooking(id: number, booking: UpdateBookingRequest): Promise<ApiResponseWrapper> {
        // Get the stored token
        const token = ApiClient.getToken(this.tokenKey);
        if (!token) {
            throw new Error('Authentication token not found. Please authenticate first.');
        }
        
        // Setup request headers with token
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': `token=${token}`
        };
        
        const response = await this.put(`/booking/${id}`, booking, headers);
        return new ApiResponseWrapper(response);
    }
      /**
     * Partially update a booking (requires auth token)
     * @param id - Booking ID to update
     * @param partialBooking - Partial booking data to update
     * @returns Response with updated booking
     */
    async partialUpdateBooking(id: number, partialBooking: PartialUpdateBookingRequest): Promise<ApiResponseWrapper> {
        // Get the stored token
        const token = ApiClient.getToken(this.tokenKey);
        if (!token) {
            throw new Error('Authentication token not found. Please authenticate first.');
        }
        
        // Setup request headers with token
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': `token=${token}`
        };
        
        const response = await this.patch(`/booking/${id}`, partialBooking, headers);
        return new ApiResponseWrapper(response);
    }
      /**
     * Delete a booking (requires auth token)
     * @param id - Booking ID to delete
     * @returns Response indicating success
     */
    async deleteBooking(id: number): Promise<ApiResponseWrapper> {
        // Get the stored token
        const token = ApiClient.getToken(this.tokenKey);
        if (!token) {
            throw new Error('Authentication token not found. Please authenticate first.');
        }
        
        // Setup request headers with token
        // According to Restful Booker API, there are multiple auth methods supported:
        // 1. Cookie based token auth
        // 2. Basic auth
        // 3. OAuth2 token in authorization header
        const headers = {
            'Content-Type': 'application/json',
            'Cookie': `token=${token}`,
            'Authorization': `Basic YWRtaW46cGFzc3dvcmQxMjM=` // admin:password123 in base64
        };
        
        const response = await this.delete(`/booking/${id}`, headers);
        return new ApiResponseWrapper(response);
    }
    
    /**
     * Health check for the API
     * @returns Response indicating health status
     */
    async healthCheck(): Promise<ApiResponseWrapper> {
        const response = await this.get('/ping');
        return new ApiResponseWrapper(response);
    }
}
