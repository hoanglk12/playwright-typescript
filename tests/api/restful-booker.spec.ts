import { apiTest, expect } from '../../src/api/ApiTest';
import { RestfulBookerService } from '../../src/api/services/restful-booker';

/**
 * Test fixture interface specifically for Restful Booker API.
 */
interface RestfulBookerTestFixtures {
    bookingService: RestfulBookerService;
}

/**
 * Extended API test for Restful Booker API.
 * Provides a service instance to each test via a fixture, without browser context.
 */
const bookingTest = apiTest.extend<RestfulBookerTestFixtures>({
    bookingService: async ({ apiClient }, use) => {
        const service = new RestfulBookerService(apiClient);
        await use(service);
    }
});

// Disable parallel execution for all bookingTest tests.
bookingTest.describe.configure({ mode: 'serial' });

// Booking Endpoints
bookingTest.describe('Restful Booker API - Booking Endpoints', () => {
    bookingTest('should get all booking IDs', async ({ bookingService }) => {
        const response = await bookingService.getBookingIds();
        await response.assertStatus(200);
        const bookings = await response.json();
        expect(Array.isArray(bookings)).toBe(true);
    });

    bookingTest('should filter bookings by name', async ({ bookingService }) => {
        const response = await bookingService.getBookingIds({ firstname: 'John' });
        await response.assertStatus(200);
        const bookings = await response.json();
        expect(Array.isArray(bookings)).toBe(true);
    });

    bookingTest('should get a specific booking by ID', async ({ bookingService }) => {
        const idsResponse = await bookingService.getBookingIds();
        const ids = await idsResponse.json();
        bookingTest.skip(!ids.length, 'No bookings available to test');
        const bookingId = ids[0].bookingid;
        const response = await bookingService.getBooking(bookingId);
        await response.assertStatus(200);
        const booking = await response.json();
        expect(booking).toHaveProperty('firstname');
        expect(booking).toHaveProperty('lastname');
        expect(booking.bookingdates).toHaveProperty('checkin');
    });

    bookingTest('should create a new booking', async ({ bookingService }) => {
        const newBooking = {
            firstname: 'Test',
            lastname: 'User',
            totalprice: 150,
            depositpaid: true,
            bookingdates: { checkin: '2025-01-01', checkout: '2025-01-10' },
            additionalneeds: 'Breakfast'
        };
        const response = await bookingService.createBooking(newBooking);
        await response.assertStatus(200);
        const booking = await response.json();
        expect(booking).toHaveProperty('bookingid');
        expect(booking.booking).toMatchObject(newBooking);
    });

    bookingTest('should check API health', async ({ bookingService }) => {
        const response = await bookingService.healthCheck();
        await response.assertStatus(201);
        const text = await response.text();
        expect(text).toContain('Created');
    });
});

// Authentication tests
bookingTest.describe('Restful Booker API - Authentication', () => {
    bookingTest('should authenticate and get token', async ({ bookingService }) => {
        const response = await bookingService.authenticate('admin', 'password123');
        await response.assertStatus(200);
        const auth = await response.json();
        expect(auth).toHaveProperty('token');
        expect(typeof auth.token).toBe('string');
    });
});

// Full booking lifecycle tests (Auth required)
bookingTest.describe('Restful Booker API - Full Booking Lifecycle', () => {
    let bookingId: number;

    bookingTest.beforeAll(async ({ bookingService }) => {
        await bookingService.authenticate('admin', 'password123');
        const newBooking = {
            firstname: 'Lifecycle',
            lastname: 'Test',
            totalprice: 200,
            depositpaid: true,
            bookingdates: { checkin: '2025-02-01', checkout: '2025-02-05' },
            additionalneeds: 'Mini bar'
        };
        const response = await bookingService.createBooking(newBooking);
        const result = await response.json();
        bookingId = result.bookingid;
    });

    bookingTest('should update a booking', async ({ bookingService }) => {
        bookingTest.skip(!bookingId, 'No booking ID available');
        const updatedBooking = {
            firstname: 'Updated',
            lastname: 'User',
            totalprice: 250,
            depositpaid: true,
            bookingdates: { checkin: '2025-02-01', checkout: '2025-02-10' },
            additionalneeds: 'Mini bar and breakfast'
        };
        const response = await bookingService.updateBooking(bookingId, updatedBooking);
        await response.assertStatus(200);
        const booking = await response.json();
        expect(booking.firstname).toBe('Updated');
    });

    bookingTest('should partially update a booking', async ({ bookingService }) => {
        bookingTest.skip(!bookingId, 'No booking ID available');
        const partialUpdate = { firstname: 'Partially', additionalneeds: 'Breakfast only' };
        const response = await bookingService.partialUpdateBooking(bookingId, partialUpdate);
        await response.assertStatus(200);
        const booking = await response.json();
        expect(booking.firstname).toBe('Partially');
    });

    bookingTest('should delete a booking', async ({ bookingService }) => {
        bookingTest.skip(!bookingId, 'No booking ID available');
        await bookingService.authenticate('admin', 'password123');
        const response = await bookingService.deleteBooking(bookingId);
        const statusCode = response.statusCode();
        expect([201, 403]).toContain(statusCode);
        if (statusCode === 201) {
            const getResponse = await bookingService.getBooking(bookingId);
            expect(getResponse.statusCode()).toBe(404);
        }
    });
});
