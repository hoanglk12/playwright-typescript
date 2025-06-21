# API Testing Framework

This section outlines the API testing capabilities integrated into the Playwright test framework.

## Features

- **Full HTTP Method Support**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Authentication**: Basic Auth, Bearer Token, API Key, and Custom Headers
- **Response Validation**: Status codes, JSON body validation, header validation
- **Data Extraction**: Easy extraction from JSON responses
- **Token Management**: Token sharing between tests
- **Parallel Execution**: Run API tests in parallel for faster execution
- **Separate Reporting**: Dedicated HTML reports for API tests
- **CI/CD Integration**: GitHub Actions workflow for automated API testing

## Getting Started

### Run API Tests

```bash
# Run all API tests
npm run test:api

# Run API tests with debugging
npm run test:api:debug

# Run API tests with UI mode
npm run test:api:ui
```

### View API Test Reports

```bash
# Open API test report in browser
npm run report:api
```

## Directory Structure

```
├── src/
│   └── api/                # API testing utilities
│       ├── ApiClient.ts    # Core API client
│       ├── ApiResponse.ts  # Response wrapper
│       ├── ApiClientExt.ts # Extended client with response wrappers
│       ├── ApiTest.ts      # API test fixtures
│       ├── services/       # API service implementations
│       │   └── restful-booker/  # Restful Booker API service
│       │       ├── RestfulBookerService.ts  # Service implementation
│       │       ├── models.ts               # Data models
│       │       └── index.ts                # Exports
│       └── index.ts        # Export utilities
├── tests/
│   └── api/                # API test files
│       ├── example.spec.ts # Basic examples
│       ├── restful-booker.spec.ts # Restful Booker API tests
└── api.config.ts           # API testing configuration
```

## Creating API Tests

### Basic API Test

```typescript
import { apiTest, expect } from '../../src/api';

apiTest('should make a GET request', async ({ apiClientExt }) => {
  const response = await apiClientExt.getWithWrapper('/users/1');
  
  await response.assertStatus(200);
  await response.assertJsonPath('id', 1);
  await response.assertJsonPath('name', expect.any(String));
});
```

### Authenticated API Test

```typescript
import { apiTest, AuthType } from '../../src/api';

apiTest('should make authenticated request', async ({ createClientExt }) => {
  // Create client with authentication
  const client = await createClientExt({ 
    authType: AuthType.BEARER,
    token: 'your-token'
  });
  
  const response = await client.getWithWrapper('/protected-endpoint');
  await response.assertStatus(200);
});
```

### Sharing Authentication Between Tests

```typescript
import { apiTest, AuthType } from '../../src/api';

apiTest.describe('Auth tests', () => {
  let authToken: string;
  
  apiTest.beforeAll(async ({ apiClientExt }) => {
    // Login to get token
    const loginResponse = await apiClientExt.postWithWrapper('/login', {
      username: 'user',
      password: 'pass'
    });
    
    // Extract and store token
    const data = await loginResponse.json();
    authToken = data.token;
    
    // Store token for other tests
    const ApiClient = require('../../src/api/ApiClient').ApiClient;
    ApiClient.storeToken('user-auth', authToken);
  });
  
  apiTest('use token in test', async ({ createClientExt }) => {
    const client = await createClientExt({
      authType: AuthType.BEARER,
      token: authToken
    });
    
    // Use authenticated client
    const response = await client.getWithWrapper('/protected');
    await response.assertStatus(200);
  });
});
```

## API Services

### Restful Booker API

This project includes a complete implementation of the [Restful Booker API](https://restful-booker.herokuapp.com/apidoc/index.html) service.

The Restful Booker API is used to demonstrate best practices for API testing and provides the following functionality:

- **Authentication**: Token-based and Basic authentication
- **Booking Management**: Create, read, update, and delete bookings 
- **Health Check**: API health checking

#### Using the Restful Booker Service

```typescript
import { apiTest } from '../../src/api';
import { RestfulBookerService } from '../../src/api/services/restful-booker';

// Create a test fixture with the service
const bookingTest = apiTest.extend({
  baseURL: async ({}, use) => {
    await use('https://restful-booker.herokuapp.com');
  },
  bookingService: async ({ apiClient }, use) => {
    const service = new RestfulBookerService(apiClient);
    await use(service);
  }
});

// Use the service in tests
bookingTest('should get all bookings', async ({ bookingService }) => {
  const response = await bookingService.getBookingIds();
  await response.assertStatus(200);
});
```

#### Available Operations

- `authenticate(username, password)` - Get auth token
- `getBookingIds(filters?)` - Get all booking IDs with optional filtering
- `getBooking(id)` - Get a specific booking
- `createBooking(booking)` - Create a new booking
- `updateBooking(id, booking)` - Full update of a booking
- `partialUpdateBooking(id, partialBooking)` - Partial update of a booking
- `deleteBooking(id)` - Delete a booking
- `healthCheck()` - Check API health

The implementation includes comprehensive tests covering all endpoints and operations.

## Configuration

The `api.config.ts` file contains the configuration for API testing:

- Different reporters for UI and API tests
- Separate output directories 
- Environment variable support

## CI/CD Integration

The API tests are automatically run in GitHub Actions:

- On pushes/PRs that modify API-related files
- On-demand via workflow dispatch
- With environment selection

The API test reports are published separately from UI test reports for clear separation of concerns.
