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

export interface Booking extends BookingRequest {
    bookingid?: number;
}

export interface BookingId {
    bookingid: number;
}

export interface AuthRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    token: string;
}

export interface BookingFilterParams {
    firstname?: string;
    lastname?: string;
    checkin?: string;
    checkout?: string;
}

/**
 * Used for PUT /booking/:id endpoint
 * Based on the API documentation, this requires all fields
 */
export interface UpdateBookingRequest extends BookingRequest {}

export interface UpdateBookingResponse extends BookingRequest {}

/** Used for PATCH /booking/:id endpoint */
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

export interface PartialUpdateBookingResponse extends BookingRequest {}