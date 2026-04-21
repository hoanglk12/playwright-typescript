'use strict';

/**
 * Lighthouse CI configuration for e-commerce storefronts.
 * URLs sourced from src/data/ecommerce/storefronts.ts (staging environments).
 *
 * Run locally:  npx lhci autorun
 * Collect only: npx lhci collect
 * Assert only:  npx lhci assert
 *
 * To target production, replace the staging URLs below with production equivalents.
 */

const ECOMMERCE_URLS = [
  'https://stag-platypus-au.accentgra.com/',
  'https://stag-platypus-nz.accentgra.com/',
  'https://stag-skechers-au.accentgra.com/',
  'https://stag-skechers-nz.accentgra.com/',
  'https://stag-vans-au.accentgra.com/',
  'https://stag-vans-nz.accentgra.com/',
  'https://stag-drmartens-au.accentgra.com/',
];

module.exports = {
  ci: {
    collect: {
      url: ECOMMERCE_URLS,
      // 3 runs per URL gives a stable median score
      numberOfRuns: 3,
      settings: {
        // Required for Chrome running in containerised / CI environments
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',

        // Desktop form factor — matches the 1920×1080 viewport used by the
        // Playwright test suite (playwright.config.ts)
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },

        // Simulated cable throttling (mirrors Lighthouse desktop preset)
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },

        // Audits to skip (add IDs here if a legitimate third-party script
        // causes a persistent failure that cannot be fixed by the team)
        skipAudits: [],
      },
    },

    assert: {
      assertions: {
        // ── Category score gates ──────────────────────────────────────────
        // Thresholds are intentionally lenient for staging environments.
        // Tighten these values when targeting production.
        'categories:performance':    ['warn',  { minScore: 0.4 }],
        'categories:accessibility':  ['error', { minScore: 0.7 }],
        'categories:best-practices': ['warn',  { minScore: 0.7 }],
        'categories:seo':            ['warn',  { minScore: 0.7 }],

        // ── Core Web Vitals ───────────────────────────────────────────────
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'total-blocking-time':      ['warn', { maxNumericValue: 800  }],
        'cumulative-layout-shift':  ['warn', { maxNumericValue: 0.25 }],
        'first-contentful-paint':   ['warn', { maxNumericValue: 3000 }],
        'speed-index':              ['warn', { maxNumericValue: 5000 }],
        'interactive':              ['warn', { maxNumericValue: 6000 }],

        // ── Accessibility hard errors ─────────────────────────────────────
        // These must pass on every storefront — they directly impact users
        // with assistive technology and carry legal compliance risk.
        'image-alt':      'error',
        'document-title': 'error',
        'html-has-lang':  'error',
        'color-contrast': 'warn',

        // ── SEO essentials ────────────────────────────────────────────────
        'meta-description':  'warn',
        'crawlable-anchors': 'warn',
        'robots-txt':        'warn',
        'canonical':         'warn',
      },
    },

    upload: {
      // Reports are saved to ./lighthouse-reports/ and uploaded as CI
      // artifacts. Switch to 'temporary-public-storage' for shareable URLs
      // (7-day retention, no token required).
      target: 'filesystem',
      outputDir: './lighthouse-reports',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
