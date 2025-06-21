import { defineConfig } from '@playwright/test';
import { devices } from '@playwright/test';
import path from 'path';
import { getApiEnvironment } from './src/api/config/environment';

// Load API-specific environment configuration
const apiEnv = getApiEnvironment();
const env = process.env.NODE_ENV || 'testing';
console.log(`🌍 API Tests Environment: ${env}`);
console.log(`🔗 API Base URL: ${apiEnv.apiBaseUrl}`);
console.log(`⚙️ API Timeout: ${apiEnv.timeout}ms`);
console.log(`⚙️ API Retries: ${apiEnv.retries}`);

/**
 * See https://playwright.dev/docs/api-testing
 */
export default defineConfig({  testDir: './tests/api',
  /* Maximum time one test can run for. */
  timeout: apiEnv.timeout,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000
  },  /* Run tests in files in serial mode (non-parallel) */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Set worker count to 1 to ensure non-parallel execution */
  workers: 1,
  /* Retry on CI only */
  retries: apiEnv.retries,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'api-report' }],
    ['json', { outputFile: 'api-results/results.json' }]
  ],
  /* Skip UI global setup/teardown files */
  globalSetup: undefined,
  globalTeardown: undefined,  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in tests */
    baseURL: apiEnv.apiBaseUrl,
    
    /* Maximum time each action such as request can take. Default is 0 (no limit). */
    actionTimeout: apiEnv.timeout,
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Simulate browser for consistent environment, but don't actually launch one */
    headless: true,
  },

  /* Configure projects for API testing only */
  projects: [
    {      name: 'api',
      use: {
        /* API testing doesn't need a browser */
      },
    },
  ],

  /* Folder for test artifacts like screenshots, videos, traces, etc. */
  outputDir: 'test-results/api',
});
