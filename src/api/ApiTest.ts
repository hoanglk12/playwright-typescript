import { test as base, expect } from '@playwright/test';
import { ApiClient, ApiClientOptions, AuthType } from './ApiClient';
import { ApiClientExt } from './ApiClientExt';
import { RestfulApiClient } from './services/restful-device/RestfulApiClient';
import { GraphQLClient, GraphQLClientOptions } from './GraphQLClient';
import { RestfulBookerService } from './services/restful-booker';
import { DummyJsonService } from './services/dummyjson';
import { getApiEnvironment } from './config/environment';
import { SoftAssertHelper } from '../utils/soft-assert-helper';
import { TestLogger } from '../utils/test-logger';
import { consumeVerboseLogBuffer } from '../utils/verbose-log-buffer';
import { redactSensitiveText } from '../utils/redact';

export interface ApiTestFixtures {
  apiBaseUrl: string;
  restfulApiBaseURL: string;
  dummyjsonBaseUrl: string;
  graphqlURL: string;
  apiClient: ApiClient;
  apiClientExt: ApiClientExt;
  restfulApiClient: RestfulApiClient;
  bookingService: RestfulBookerService;
  dummyjsonService: DummyJsonService;
  graphqlClient: GraphQLClient;
  createClient: (options: Partial<ApiClientOptions>) => Promise<ApiClient>;
  createClientExt: (options: Partial<ApiClientOptions>) => Promise<ApiClientExt>;
  createRestfulApiClient: (options?: Partial<ApiClientOptions>) => Promise<RestfulApiClient>;
  createGraphQLClient: (options?: Partial<GraphQLClientOptions>) => Promise<GraphQLClient>;
  softAssert: SoftAssertHelper;
  attachTestLogs: void;
  attachVerboseLogFailureContext: void;
}

export const apiTest = base.extend<ApiTestFixtures>({
    apiBaseUrl: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        await use(apiEnv.apiBaseUrl);
    },
    restfulApiBaseURL: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        await use(apiEnv.restfulApiBaseUrl);
    },
    dummyjsonBaseUrl: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        await use(apiEnv.dummyjsonBaseUrl);
    },

    graphqlURL: async ({}, use) => {
        const apiEnv = getApiEnvironment();
        await use(apiEnv.graphqlBaseUrl + apiEnv.graphqlEndpoint);
    },

    apiClient: async ({ apiBaseUrl }, use) => {
        const client = new ApiClient({ baseURL: apiBaseUrl });
        await client.init();
        await use(client);
        await client.dispose();
    },

    apiClientExt: async ({ apiBaseUrl }, use) => {
        const client = new ApiClientExt({ baseURL: apiBaseUrl });
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

    bookingService: async ({ apiBaseUrl }, use) => {
        const apiEnv = getApiEnvironment();
        const service = new RestfulBookerService({ 
            baseURL: apiBaseUrl,
            timeout: apiEnv.timeout 
        });
        await service.init();
        await use(service);
        await service.dispose();
    },

    dummyjsonService: async ({ dummyjsonBaseUrl }, use) => {
        const apiEnv = getApiEnvironment();
        const service = new DummyJsonService({
            baseURL: dummyjsonBaseUrl,
            timeout: apiEnv.timeout
        });
        await service.init();
        await use(service);
        await service.dispose();
    },

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

    createClient: async ({ apiBaseUrl }, use) => {
        const clients: ApiClient[] = [];
        const createClientFn = async (options: Partial<ApiClientOptions>): Promise<ApiClient> => {
            const client = new ApiClient({ baseURL: apiBaseUrl, ...options });
            await client.init();
            clients.push(client);
            return client;
        };
        await use(createClientFn);
        for (const client of clients) {
            await client.dispose();
        }
    },

    createClientExt: async ({ apiBaseUrl }, use) => {
        const clients: ApiClientExt[] = [];
        const createClientFn = async (options: Partial<ApiClientOptions>): Promise<ApiClientExt> => {
            const client = new ApiClientExt({ baseURL: apiBaseUrl, ...options });
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

    softAssert: async ({}, use) => {
        const logger = new TestLogger(base.info().title);
        // Registers at fixture-setup time (before the spec body's own createTestLogger call),
        // so soft-assert lines land in the attachment ahead of step lines rather than
        // chronologically interleaved — content is preserved, ordering is approximate.
        logger.registerForCurrentTest();
        await use(new SoftAssertHelper(logger));
    },

    // Auto fixture — flushes the per-test logger buffer registered by createTestLogger()
    // into an attachment so it appears alongside that specific test in HTML/monocart reports.
    attachTestLogs: [async ({}, use, testInfo) => {
        await use();
        const buffer = TestLogger.consumeBuffer(testInfo.testId);
        if (buffer) {
            await testInfo.attach('test-steps.log', { body: buffer, contentType: 'text/plain' });
        }
    }, { auto: true }],

    // Auto fixture — buffer-then-flush-on-failure for `ApiClientExt`/`GraphQLClient` verbose
    // logging (Option B). Buffered entries are only ever attached when this test failed —
    // passing tests get no attachment, bounding monocart's index.json by failing-test count
    // instead of total call count. Playwright's own failure predicate: skipped tests are
    // never "failed", and a test that ran but didn't reach its expected status has failed.
    attachVerboseLogFailureContext: [async ({}, use, testInfo) => {
        await use();
        const entries = consumeVerboseLogBuffer(testInfo.testId);
        if (!entries || entries.length === 0) {
            return;
        }
        const isFailure = testInfo.status !== 'skipped' && testInfo.status !== testInfo.expectedStatus;
        if (!isFailure) {
            return;
        }
        const body = redactSensitiveText(JSON.stringify({ calls: entries }, null, 2));
        await testInfo.attach('api-verbose-failure-context.json', { body, contentType: 'application/json' });
    }, { auto: true }],

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

export { expect } from '@playwright/test';
export const softExpect: typeof expect.soft = expect.soft.bind(expect);
