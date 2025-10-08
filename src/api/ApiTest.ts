import { test as base } from '@playwright/test';
import { ApiClient, ApiClientOptions, AuthType } from './ApiClient';
import { ApiClientExt } from './ApiClientExt';
import { RestfulApiClient } from './services/restful-device/RestfulApiClient';
import { GraphQLClient, GraphQLClientOptions } from './GraphQLClient';
import { getApiEnvironment } from './config/environment';

/**
 * API Test fixture interface
 */
export interface ApiTestFixtures {
  baseURL: string;
  restfulApiBaseURL: string;
  graphqlURL: string;
  apiClient: ApiClient;
  apiClientExt: ApiClientExt;
  restfulApiClient: RestfulApiClient;
  graphqlClient: GraphQLClient;
  createClient: (options: Partial<ApiClientOptions>) => Promise<ApiClient>;
  createClientExt: (options: Partial<ApiClientOptions>) => Promise<ApiClientExt>;
  createRestfulApiClient: (options?: Partial<ApiClientOptions>) => Promise<RestfulApiClient>;
  createGraphQLClient: (options?: Partial<GraphQLClientOptions>) => Promise<GraphQLClient>;
}

/**
 * Base API test configuration with fixtures for API testing
 */
export const apiTest = base.extend<ApiTestFixtures>({
    // Define the base URL for API requests, defaults to environment variable or fallback
    baseURL: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        await use(apiEnv.apiBaseUrl);
    },
    restfulApiBaseURL: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        await use(apiEnv.restfulApiBaseUrl);
    },

    // GraphQL endpoint URL
    graphqlURL: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        // Combine graphqlBaseUrl + graphqlEndpoint
        await use(apiEnv.graphqlBaseUrl + apiEnv.graphqlEndpoint);
    },

    // Provide a basic API client
    apiClient: async ({ baseURL }, use) => {
        const client = new ApiClient({ baseURL });
        await client.init();
        await use(client);
        await client.dispose();
    },

    // Provide an extended API client with response wrapper
    apiClientExt: async ({ baseURL }, use) => {
        const client = new ApiClientExt({ baseURL });
        await client.init();
        await use(client);
        await client.dispose();
    },

    restfulApiClient: async ({ restfulApiBaseURL }, use) => {
        const apiEnv = getApiEnvironment();
        const client = new RestfulApiClient({ 
            baseURL: restfulApiBaseURL,
            timeout: apiEnv.timeout 
        });
        await client.init();
        await use(client);
        await client.dispose();
    },

    // Provide a GraphQL client
    graphqlClient: async ({ graphqlURL }, use) => {
        const apiEnv = getApiEnvironment();
        const client = new GraphQLClient({ 
            baseURL: graphqlURL,
            timeout: apiEnv.timeout 
        });
        await client.init();
        await use(client);
        await client.dispose();
    },

    // Helper to create API clients with custom options
    createClient: async ({ baseURL }, use) => {
        const clients: ApiClient[] = [];
        const createClientFn = async (options: Partial<ApiClientOptions>): Promise<ApiClient> => {
            const client = new ApiClient({ baseURL, ...options });
            await client.init();
            clients.push(client);
            return client;
        };
        await use(createClientFn);
        for (const client of clients) {
            await client.dispose();
        }
    },

    // Helper to create extended API clients with custom options
    createClientExt: async ({ baseURL }, use) => {
        const clients: ApiClientExt[] = [];
        const createClientFn = async (options: Partial<ApiClientOptions>): Promise<ApiClientExt> => {
            const client = new ApiClientExt({ baseURL, ...options });
            await client.init();
            clients.push(client);
            return client;
        };
        await use(createClientFn);
        for (const client of clients) {
            await client.dispose();
        }
    },
    createRestfulApiClient: async ({ restfulApiBaseURL }, use) => {
        const clients: RestfulApiClient[] = [];
        const createClientFn = async (options: Partial<ApiClientOptions> = {}): Promise<RestfulApiClient> => {
            const apiEnv = getApiEnvironment();
            const client = new RestfulApiClient({ 
                baseURL: restfulApiBaseURL,
                timeout: apiEnv.timeout,
                ...options 
            });
            await client.init();
            clients.push(client);
            return client;
        };
        await use(createClientFn);
        for (const client of clients) {
            await client.dispose();
        }
    },

    // Helper to create GraphQL clients with custom options
    createGraphQLClient: async ({ graphqlURL }, use) => {
        const clients: GraphQLClient[] = [];
        const createClientFn = async (options: Partial<GraphQLClientOptions> = {}): Promise<GraphQLClient> => {
            const apiEnv = getApiEnvironment();
            const client = new GraphQLClient({ 
                baseURL: graphqlURL,
                timeout: apiEnv.timeout,
                ...options 
            });
            await client.init();
            clients.push(client);
            return client;
        };
        await use(createClientFn);
        for (const client of clients) {
            await client.dispose();
        }
    },
});

// Export the API test and expect functions
export { expect } from '@playwright/test';
