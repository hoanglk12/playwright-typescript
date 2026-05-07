import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import { getEnvironment } from "./src/config/environment";

// Get environment configuration
const env = getEnvironment();

/**
 * @see https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Skip API tests */
  testIgnore: [
    "**/api/**",
    // "**/profile-listing-page.spec.ts"  /* Ignore a test */
  ],

  /* Maximum number of concurrent worker processes - dynamically configured */
  workers: process.env.WORKERS
    ? process.env.WORKERS.endsWith("%")
      ? process.env.WORKERS
      : Number(process.env.WORKERS)
    : "50%",
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry configuration based on environment */
  retries: process.env.CI ? env.retries : 0,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: env.htmlReportDir || "playwright-report" }],
    ["json", { outputFile: `${env.reportDir || "test-results"}/results.json` }],
    ["junit", { outputFile: `${env.reportDir || "test-results"}/results.xml` }],
    ["list"],
    [
      "monocart-reporter",
      {
        name: `Playwright UI Tests — ${process.env.NODE_ENV ?? "testing"}`,
        outputFile: "monocart-report/index.html",
        metadata: {
          project: "Playwright TypeScript Framework",
          environment: process.env.NODE_ENV ?? "testing",
          branch: process.env.GITHUB_REF_NAME ?? "local",
          os: process.platform,
        },
        trend: process.env.MONOCART_TREND_FILE
          ? (() => {
              try {
                return JSON.parse(fs.readFileSync(process.env.MONOCART_TREND_FILE!, "utf-8"));
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
                "## Playwright UI Test Report",
                "| Metric | Count |",
                "|--------|-------|",
                `| Total | ${s.tests?.value ?? s.tests} |`,
                `| ✅ Passed | ${s.passed?.value ?? s.passed} |`,
                `| ❌ Failed | ${s.failed?.value ?? s.failed} |`,
                `| ⏭ Skipped | ${s.skipped?.value ?? s.skipped} |`,
                `| 🔁 Flaky | ${s.flaky?.value ?? s.flaky ?? 0} |`,
                `| Duration | ${reportData.durationH} |`,
              ];
              fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
            }
          } catch (e) {
            console.warn("[monocart] onEnd error:", e);
          }
        },
      },
    ],
  ],

  /* Global timeout for each test */
  timeout: env.timeout,

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // adminUrl: env.adminUrl,
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: env.traceMode as any,
 
    /* Screenshot settings */
    screenshot: env.screenshotMode as any,

    /* Video settings */
    video: env.videoMode as any,

    /* Action timeout */
    actionTimeout: env.timeout / 3,

    /* Navigation timeout */
    navigationTimeout: env.timeout,

    /* Viewport size */
    viewport: {
      width: env.viewportWidth,
      height: env.viewportHeight,
    },

    /* Browser launch options */
    launchOptions: {
      headless: env.headless,
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: env.viewportWidth, height: env.viewportHeight },
        launchOptions: { headless: env.headless },
      },
    },

    {
      name: "firefox",
      // Always skip API tests (global testIgnore is replaced by project-level).
      // In CI, also skip ecommerce/smoke — those run on Chromium only.
      testIgnore: process.env.CI
        ? ["**/api/**", "**/ecommerce/smoke/**"]
        : ["**/api/**"],
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: env.viewportWidth, height: env.viewportHeight },
        ignoreHTTPSErrors: true,
        launchOptions: {
          headless: env.headless,
          firefoxUserPrefs: {
            "browser.tabs.remote.autostart": false,
            "dom.disable_beforeunload": true,
            "dom.webnotifications.enabled": false,
            "dom.push.enabled": false,
            "geo.enabled": false,
            "geo.provider.use_corelocation": false,
            "geo.prompt.testing": true,
            "geo.prompt.testing.allow": false,
            "marionette.enabled": true,
            "permissions.default.desktop-notification": 2,
            "permissions.default.geo": 2,
            // Prevent lingering network connections from blocking context teardown
            "network.http.response.timeout": 30,
            "network.http.connection-timeout": 20,
            "network.http.speculative-parallel-limit": 0,
          },
          args: [
            "--wait-for-browser",
            "--disable-infobars",
            "--disable-notifications",
            "--disable-geolocation",
          ],
        },
      },
    },

    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     viewport: { width: env.viewportWidth, height: env.viewportHeight },
    //     launchOptions: { headless: env.headless }
    //   },
    // },

    /* Test against mobile viewports - only in non-headless mode for development */
    // ...(env.headless ? [] : [
    //   {
    //     name: 'Mobile Chrome',
    //     use: {
    //       ...devices['Pixel 5'],
    //       launchOptions: { headless: env.headless }
    //     },
    //   },
    //   {
    //     name: 'Mobile Safari',
    //     use: {
    //       ...devices['iPhone 12'],
    //       launchOptions: { headless: env.headless }
    //     },
    //   }
    // ]),

    // /* Test against branded browsers - only in development */
    // ...(process.env.NODE_ENV === 'development' && !env.headless ? [
    //   {
    //     name: 'Microsoft Edge',
    //     use: {
    //       ...devices['Desktop Edge'],
    //       channel: 'msedge',
    //       viewport: { width: env.viewportWidth, height: env.viewportHeight },
    //       launchOptions: { headless: env.headless }
    //     },
    //   },
    //   {
    //     name: 'Google Chrome',
    //     use: {
    //       ...devices['Desktop Chrome'],
    //       channel: 'chrome',
    //       viewport: { width: env.viewportWidth, height: env.viewportHeight },
    //       launchOptions: { headless: env.headless }
    //     },
    //   }
    // ] : [])
  ],

  /* Global setup and teardown */
  globalSetup: "./src/config/global-setup.ts",
  globalTeardown: "./src/config/global-teardown.ts",
});
