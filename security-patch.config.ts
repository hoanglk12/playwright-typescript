import { defineConfig } from '@playwright/test';
import fs from 'fs';

/**
 * Read environment variables from file.
 */
require('dotenv').config({ path: '.env.testing', quiet: true });

/**
 * Security-Patch Regression Pack — Playwright API configuration.
 *
 * Scoped narrowly, on purpose: this currently wires up only `security-posture.spec.ts`
 * (report §8.1/§8.2), not the full P0 tier from `gra-security-patch-regression-research.html`
 * §7/§10 step 10. That tier also names `gra-order-history.spec.ts`, `gra-place-order.spec.ts`,
 * `gra-cart-minicart.spec.ts`, and a UI spec (`third-party-assets-smoke.spec.ts`) — none of
 * those spec's report-described gap-fill tests have been implemented or approved yet. Extend
 * `testMatch` below once those land.
 *
 * `security-posture.spec.ts` is deliberately NOT named `gra-*.spec.ts` (see the comment in
 * that file) so it is excluded from every project's gra-glob testMatch in `api.config.ts`
 * and never joins the daily suite. It must therefore be named explicitly here.
 */
export default defineConfig({
  testDir: './tests/api',

  metadata: {
    project: 'Playwright TypeScript Framework — Security Patch Regression',
    environment: String(process.env.NODE_ENV ?? 'testing'),
  },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 8,
  reporter: [
    ['html', { outputFolder: 'security-patch-report' }],
    ['json', { outputFile: 'security-patch-results/results.json' }],
    ['line'],
    [
      'monocart-reporter',
      {
        name: `Security Patch Regression — ${process.env.NODE_ENV ?? 'testing'}`,
        outputFile: 'monocart-security-patch-report/index.html',
        onEnd: async (reportData: any): Promise<void> => {
          try {
            const s = reportData.summary;
            if (process.env.GITHUB_STEP_SUMMARY) {
              const lines = [
                '## Security Patch Regression Test Report',
                '| Metric | Count |',
                '|--------|-------|',
                `| Total | ${s.tests?.value ?? s.tests} |`,
                `| ✅ Passed | ${s.passed?.value ?? s.passed} |`,
                `| ❌ Failed | ${s.failed?.value ?? s.failed} |`,
                `| ⏭ Skipped | ${s.skipped?.value ?? s.skipped} |`,
                `| 🔁 Flaky | ${s.flaky?.value ?? s.flaky ?? 0} |`,
                `| Duration | ${reportData.durationH} |`,
              ];
              fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
            }
          } catch (e) {
            console.warn('[monocart-security-patch] onEnd error:', e);
          }
        },
      },
    ],
  ],

  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    ignoreHTTPSErrors: true,
    actionTimeout: 30000,
  },

  projects: [
    { name: 'pla-au', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'pla-au' } },
    { name: 'skx-au', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'skx-au' } },
    { name: 'drm-au', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'drm-au' } },
    { name: 'van-au', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'van-au' } },
    { name: 'pla-nz', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'pla-nz' } },
    { name: 'skx-nz', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'skx-nz' } },
    { name: 'drm-nz', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'drm-nz' } },
    { name: 'van-nz', testDir: './tests/api', testMatch: ['**/tests/api/security-posture.spec.ts'], metadata: { siteCode: 'van-nz' } },
  ],

  outputDir: 'test-results/security-patch/',

  globalSetup: require.resolve('./tests/api/global-setup.ts'),
  globalTeardown: require.resolve('./tests/api/global-teardown.ts'),
});
