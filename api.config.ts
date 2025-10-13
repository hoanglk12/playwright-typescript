import { defineConfig } from '@playwright/test';

/**
 * Read environment variables from file.
 */
require('dotenv').config({ path: '.env.testing' });
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
    ['line']
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
    /* Global timeout for API requests */
    actionTimeout: 15000,
    
    /* No browser context needed for API tests */
    // Don't set browser-specific options here
  },
 
  /* Projects for API testing - NO BROWSERS */
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        // No browser context - pure API testing
        
      },
    }
  ],
  /* Output directories */
  outputDir: 'test-results/api/',
  
  /* No web server needed for API tests */
  // webServer: undefined,
  
  /* No global setup/teardown with browser context */
  globalSetup: require.resolve('./tests/api/global-setup.ts'),
  globalTeardown: require.resolve('./tests/api/global-teardown.ts'),
});
