import { defineConfig, devices } from '@playwright/test';
import { getEnvironment } from './src/config/environment';

// One-off manual-assist specs — see tests/manual/CLAUDE.md. Standalone on purpose: spreading
// playwright.config.ts would bring in the CI reporters, the global setup that wipes test-results/,
// and env.headless, which .env.testing sets to true while these specs pause for a tester.
const env = getEnvironment();

export default defineConfig({
  testDir: './tests/manual',
  outputDir: 'test-results/manual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A paused session lasts as long as the tester needs.
  timeout: 0,
  reporter: [['list'], ['html', { outputFolder: 'manual-report', open: 'never' }]],
  use: {
    actionTimeout: env.timeout / 3,
    navigationTimeout: env.timeout,
    screenshot: 'only-on-failure',
    // A trace records fill() values, including the shared GRA_TEST_PASSWORD, and testers attach
    // evidence to Xray — the timeline attachment is the evidence, not the trace.
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'manual-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: env.viewportWidth, height: env.viewportHeight },
        launchOptions: { headless: false },
      },
    },
  ],
});
