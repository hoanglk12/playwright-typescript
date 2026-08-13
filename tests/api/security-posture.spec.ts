import { graTest as test, expect, softExpect } from './gra-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { ApiClient, ApiClientOptions } from '../../src/api/ApiClient';
import { SiteContext } from '../../src/data/api/sites';
import { SecurityPostureData } from '../../src/data/api/gra-security-posture-data';

// SECURITY_POSTURE_TARGET is not yet set anywhere — this stays dormant until security-patch.config.ts
// (report §10 step 10) wires a production-targeting project. Not this change's scope.
const HARD_FAIL_ON_INTROSPECTION = process.env.SECURITY_POSTURE_TARGET === 'production';

type ClientFactory = (options: Partial<ApiClientOptions>) => Promise<ApiClient>;

function storefrontClient(createClient: ClientFactory, site: SiteContext): Promise<ApiClient> {
  return createClient({
    baseURL: new URL('/', site.baseURL).toString(),
    timeout: TIMEOUTS.API_RESPONSE,
    ...(site.storeHeader ? { customHeaders: { Store: site.storeHeader } } : {}),
  });
}

// Not named gra-*.spec.ts on purpose: that glob enlists a spec into all 8 brand projects in
// api.config.ts. This spec consumes graTest fixtures but is run on demand (future
// security-patch.config.ts). Default mode is intentional — do not add describe.configure serial.
test.describe('GRA Security Posture @api @security-posture', () => {

  test('TC_01 - storefront root returns baseline security headers', async ({ createClient, site }) => {
    const logger = createTestLogger('TC_01 baseline security headers');
    const client = await storefrontClient(createClient, site);

    let headers: Record<string, string> = {};
    await logger.step('Step 1 - GET storefront root', async () => {
      const response = await client.get('/');
      expect(response.status(), 'storefront root must respond').toBeLessThan(500);
      headers = response.headers();
    });

    await logger.step('Step 2 - Record baseline headers (recording-only until baseline is confirmed stable)', async () => {
      for (const baseline of SecurityPostureData.baselineHeaders) {
        const value = headers[baseline.name];
        logger.verify(
          `${baseline.name} (${baseline.required ? 'required' : 'optional'})`,
          baseline.required ? 'present' : 'recorded',
          value ?? 'absent',
        );
      }
    });
  });

  test('TC_02 - no Magento version disclosed in response headers', async ({ createClient, site }) => {
    const logger = createTestLogger('TC_02 version disclosure in headers');
    const client = await storefrontClient(createClient, site);
    const { versionPattern } = SecurityPostureData;

    await logger.step('Step 1 - GET storefront root and scan headers (recording-only until a false-positive sweep confirms no header, e.g. Server, legitimately matches 2.4.x)', async () => {
      const response = await client.get('/');
      const disclosing = Object.entries(response.headers()).filter(([, value]) => versionPattern.test(value));
      logger.verify('version-disclosing headers', 0, disclosing.length);
    });
  });

  test('TC_03 - /magento_version does not disclose a version', async ({ createClient, site }) => {
    const logger = createTestLogger('TC_03 magento_version disclosure');
    const client = await storefrontClient(createClient, site);

    for (const path of SecurityPostureData.versionProbePaths) {
      await logger.step(`Step 1 - GET ${path}`, async () => {
        const response = await client.get(path);
        const body = response.status() === 200 ? await response.text() : '';
        const discloses = SecurityPostureData.versionPattern.test(body);
        logger.verify(`${path} discloses version`, false, discloses);
        expect(discloses, `${path} returned a version string`).toBe(false);
      });
    }
  });

  test('TC_04 - session cookies carry Secure and HttpOnly', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 session cookie flags');
    const client = await createGraphQLClient();

    // The storefront root is CDN-cacheable (public, s-maxage) and never carries a session
    // cookie by design — a shared cache can't safely serve one visitor's session to another.
    // The GraphQL endpoint issues one on every request, so probe that instead.
    await logger.step('Step 1 - Query GraphQL and inspect Set-Cookie', async () => {
      const response = await client.query(SecurityPostureData.minimalOperation);
      const sessionCookies = response
        .headersArray()
        .filter((h) => h.name.toLowerCase() === 'set-cookie')
        .map((h) => ({ name: h.value.split('=')[0] ?? '', raw: h.value }))
        .filter((c) => SecurityPostureData.sessionCookiePattern.test(c.name));

      if (sessionCookies.length === 0) {
        test.skip(true, 'No session cookie issued by the GraphQL endpoint — nothing to verify');
        return;
      }

      for (const { name, raw } of sessionCookies) {
        const isSecure = /;\s*Secure/i.test(raw);
        const isHttpOnly = /;\s*HttpOnly/i.test(raw);
        logger.verify(`${name} Secure`, true, isSecure);
        softExpect(isSecure, `${name} must be Secure`).toBe(true);
        logger.verify(`${name} HttpOnly`, true, isHttpOnly);
        softExpect(isHttpOnly, `${name} must be HttpOnly`).toBe(true);
        logger.verify(`${name} SameSite`, 'recorded', /;\s*SameSite=(\w+)/i.exec(raw)?.[1] ?? 'absent');
      }
    });
  });

  test('TC_05 - GraphQL introspection state recorded', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 GraphQL introspection state');
    const client = await createGraphQLClient();

    await logger.step('Step 1 - Attempt introspection query', async () => {
      const response = await client.introspect();
      const body: { data?: { __schema?: unknown } } = await response.json().catch(() => ({}));
      const enabled = !!body.data?.__schema;

      logger.verify('introspection enabled', HARD_FAIL_ON_INTROSPECTION ? false : 'informational', enabled);

      if (HARD_FAIL_ON_INTROSPECTION) {
        expect(enabled, 'introspection must be disabled on production').toBe(false);
      }
    });
  });

  test('TC_06 - admin paths do not serve an unauthenticated dashboard', async ({ createClient, site }) => {
    const logger = createTestLogger('TC_06 admin path reachability');
    const client = await storefrontClient(createClient, site);

    for (const path of SecurityPostureData.adminProbePaths) {
      await logger.step(`Step 1 - GET ${path}`, async () => {
        const response = await client.get(path);
        const body = response.status() === 200 ? await response.text() : '';
        const looksLikeDashboard = SecurityPostureData.dashboardMarkers.every((m) => body.includes(m));

        logger.verify(`${path} final status`, 'recorded', response.status());
        expect(looksLikeDashboard, `${path} served an authenticated dashboard`).toBe(false);
      });
    }
  });

  test('TC_07 - invalid GraphQL operation does not leak stack traces or paths', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 verbose error disclosure');
    const client = await createGraphQLClient();

    await logger.step('Step 1 - Send an invalid operation and inspect the error body', async () => {
      const response = await client.queryWrapped(SecurityPostureData.invalidOperation);
      const body = await response.text();
      const leaks = SecurityPostureData.stackTraceMarkers.filter((m) => body.includes(m));

      logger.verify('stack-trace markers in error body', 0, leaks.length);
      expect(leaks, `error body leaked: ${leaks.join(', ')}`).toHaveLength(0);
    });
  });

  test('TC_08 - GraphQL endpoint does not reflect an arbitrary Origin with credentials enabled', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_08 CORS origin reflection');
    const client = await createGraphQLClient({ customHeaders: { Origin: SecurityPostureData.corsTestOrigin } });

    await logger.step('Step 1 - Send a minimal query with a test Origin header', async () => {
      const response = await client.queryWrapped(SecurityPostureData.minimalOperation);
      const headers = response.headers();
      const allowOrigin = headers['access-control-allow-origin'];
      const allowCredentials = headers['access-control-allow-credentials'];
      const reflectsArbitraryOrigin = allowOrigin === SecurityPostureData.corsTestOrigin;
      const credentialsEnabled = allowCredentials === 'true';

      logger.verify('access-control-allow-origin', 'recorded', allowOrigin ?? 'absent');
      logger.verify('access-control-allow-credentials', 'recorded', allowCredentials ?? 'absent');

      expect(
        reflectsArbitraryOrigin && credentialsEnabled,
        'GraphQL endpoint must not combine arbitrary-origin reflection with Access-Control-Allow-Credentials: true',
      ).toBe(false);
    });
  });
});
