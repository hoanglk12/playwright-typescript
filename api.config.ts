import { defineConfig } from '@playwright/test';
import fs from 'fs';

/**
 * Read environment variables from file.
 */
require('dotenv').config({ path: '.env.testing', quiet: true });
import { getApiEnvironment } from './src/api/config/environment';
const env = getApiEnvironment();
/**
 * Get the base URL for the current API environment
 */
function getApiBaseURL(apiService: string): string {
  switch (apiService) {
    case 'restful-booker':
      return env.apiBaseUrl;
    case 'device-booker':
      return env.restfulApiBaseUrl;
    default:
      return env.apiBaseUrl;
  }
}
/**
 * API Testing Configuration - No Browser Required
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/api',

  metadata: {
    project: 'Playwright TypeScript Framework — API',
    environment: String(process.env.NODE_ENV ?? 'testing'),
    'CI Run': process.env.GITHUB_ACTIONS
      ? String(`GitHub Actions #${process.env.GITHUB_RUN_NUMBER ?? ''}`)
      : 'local',
    'Git Commit': process.env.GITHUB_SHA
      ? String(process.env.GITHUB_SHA.slice(0, 7))
      : 'local',
  },

  /* Run tests in files in parallel */
  fullyParallel: false, // Disabled for API tests to avoid rate limiting
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Force serial execution for API tests */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'api-report' }],
    ['json', { outputFile: 'api-results/results.json' }],
    ['junit', { outputFile: 'api-results/results.xml' }],
    ['line'],
    [
      'monocart-reporter',
      {
        name: `Playwright API Tests — ${process.env.NODE_ENV ?? 'testing'}`,
        outputFile: 'monocart-api-report/index.html',
        trend: process.env.MONOCART_API_TREND_FILE
          ? (() => {
              try {
                return JSON.parse(fs.readFileSync(process.env.MONOCART_API_TREND_FILE!, 'utf-8'));
              } catch {
                return undefined;
              }
            })()
          : undefined,
        onEnd: async (reportData: any): Promise<void> => {
          try {
            const s = reportData.summary;
            if (process.env.GITHUB_STEP_SUMMARY) {
              const lines = [
                '## Playwright API Test Report',
                '| Metric | Count |',
                '|--------|-------|',
                `| Total | ${s.tests?.value ?? s.tests} |`,
                `| ✅ Passed | ${s.passed?.value ?? s.passed} |`,
                `| ❌ Failed | ${s.failed?.value ?? s.failed} |`,
                `| ⏭ Skipped | ${s.skipped?.value ?? s.skipped} |`,
                `| Duration | ${reportData.durationH} |`,
              ];
              fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
            }
          } catch (e) {
            console.warn('[monocart-api] onEnd error:', e);
          }
        },
      },
    ],
  ],
  
  /* Global test timeout */
  timeout: 30000,
  
  /* Expect timeout for assertions */
  expect: {
    timeout: 10000,
  },

  /* Shared settings for all projects - NO BROWSER */
  use: {
    /* Base URL for API calls */
    baseURL: process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com',
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    ignoreHTTPSErrors: true,
    /* Global timeout for API requests — 30s covers slow staging operations like placeOrder */
    actionTimeout: 30000,
    
    
    /* No browser context needed for API tests */
    // Don't set browser-specific options here
  },
   testIgnore: [
    "**/api/api-mocking-examples.spec.ts" /* Ignore a test */
  ],
  /* Projects for API testing - NO BROWSERS */
  projects: [
    // GRA brand projects — all run pla-*.spec.ts with site-specific metadata
    {
      name: 'pla-au',
      testDir: './tests/api',
      testMatch: ['**/tests/api/pla-*.spec.ts'],
      metadata: { siteCode: 'pla-au' },
    },
    {
      name: 'skx-au',
      testDir: './tests/api',
      testMatch: ['**/tests/api/pla-*.spec.ts'],
      metadata: { siteCode: 'skx-au' },
    },
    {
      name: 'drm-au',
      testDir: './tests/api',
      testMatch: ['**/tests/api/pla-*.spec.ts'],
      // Loyalty feature not deployed on Dr. Martens — exclude entirely so tests don't appear in report
      testIgnore: ['**/pla-loyalty-rewards.spec.ts'],
      metadata: { siteCode: 'drm-au' },
    },
    {
      name: 'van-au',
      testDir: './tests/api',
      testMatch: ['**/tests/api/pla-*.spec.ts'],
      // Loyalty feature not deployed on Vans — exclude entirely so tests don't appear in report
      testIgnore: ['**/pla-loyalty-rewards.spec.ts'],
      metadata: { siteCode: 'van-au' },
    },
    // Non-GRA specs (restful-booker, graphql-examples, objects-crud)
    {
      name: 'misc-api',
      testDir: './tests/api',
      testMatch: [
        '**/tests/api/restful-booker.spec.ts',
        '**/tests/api/objects-crud.spec.ts',
        '**/tests/api/graphql-examples.spec.ts',
      ],
    },
  ],
  /* Output directories */
  outputDir: 'test-results/api/',
  
  /* No web server needed for API tests */
  // webServer: undefined,
  
  /* No global setup/teardown with browser context */
  globalSetup: require.resolve('./tests/api/global-setup.ts'),
  globalTeardown: require.resolve('./tests/api/global-teardown.ts'),
});
