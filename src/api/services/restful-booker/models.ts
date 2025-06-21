/**
 * Booking creation request model
 */
export interface BookingRequest {
    firstname: string;
    lastname: string;
    totalprice: number;
    depositpaid: boolean;
    bookingdates: {
        checkin: string;
        checkout: string;
    };
    additionalneeds?: string;
}

/**
 * Booking response model
 */
export interface Booking extends BookingRequest {
    bookingid?: number;
}

/**
 * BookingId response model
 */
export interface BookingId {
    bookingid: number;
}

/**
 * Auth request model
 */
export interface AuthRequest {
    username: string;
    password: string;
}

/**
 * Auth response model
 */
export interface AuthResponse {
    token: string;
}

/**
 * Filter parameters for booking search
 */
export interface BookingFilterParams {
    firstname?: string;
    lastname?: string;
    checkin?: string;
    checkout?: string;
}

/**
 * Update Booking Request model
 * Used for PUT /booking/:id endpoint
 * Based on the API documentation, this requires all fields
 * Uses the same structure as BookingRequest
 */
export interface UpdateBookingRequest extends BookingRequest {}

/**
 * Update Booking Response model
 * The response from updating a booking
 * Returns the updated booking details (same structure as BookingRequest)
 */
export interface UpdateBookingResponse extends BookingRequest {}

/**
 * Partial Update Booking Request model
 * Used for PATCH /booking/:id endpoint
 * Allows updating only specific fields of a booking
 */
export interface PartialUpdateBookingRequest {
    firstname?: string;
    lastname?: string;
    totalprice?: number;
    depositpaid?: boolean;
    bookingdates?: {
        checkin?: string;
        checkout?: string;
    };
    additionalneeds?: string;
}

/**
 * Partial Update Booking Response model
 * The response from partially updating a booking
 * Returns the complete updated booking details
 */
export interface PartialUpdateBookingResponse extends BookingRequest {}