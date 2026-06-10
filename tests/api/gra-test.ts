import { apiTest } from '../../src/api/ApiTest';
import { GraphQLClient, GraphQLClientOptions } from '../../src/api/GraphQLClient';
import { getApiEnvironment } from '../../src/api/config/environment';
import { SiteContext, siteRegistry } from '../../src/data/api/sites';
import { TestState, getStateForSite } from './shared-state';

export interface GraTestFixtures {
  site: SiteContext;
  siteState: TestState;
}

export const graTest = apiTest.extend<GraTestFixtures>({
  site: async ({}, use, testInfo) => {
    const siteCode: string = (testInfo.project.metadata as { siteCode?: string })?.siteCode ?? 'pla-au';
    const siteCtx = siteRegistry[siteCode];
    if (!siteCtx) throw new Error(`graTest: unknown siteCode "${siteCode}" — add it to siteRegistry in sites.ts`);
    await use(siteCtx);
  },

  siteState: async ({ site }, use) => {
    await use(getStateForSite(site.siteCode));
  },

  graphqlClient: async ({ site }, use) => {
    const apiEnv = getApiEnvironment();
    const client = new GraphQLClient({
      baseURL: site.baseURL,
      timeout: apiEnv.timeout,
    });
    await client.init();
    await use(client);
    await client.dispose();
  },

  createGraphQLClient: async ({ site }, use) => {
    const clients: GraphQLClient[] = [];
    const createClientFn = async (options: Partial<GraphQLClientOptions> = {}): Promise<GraphQLClient> => {
      const apiEnv = getApiEnvironment();
      const client = new GraphQLClient({
        baseURL: site.baseURL,
        timeout: apiEnv.timeout,
        ...options,
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
import { expect as _expect } from '@playwright/test';
export const softExpect: typeof _expect.soft = _expect.soft.bind(_expect);
