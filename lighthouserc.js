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
  'https://stag-drmartens-nz.accentgra.com/',
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
        // ── Category score gates — Google scale: 90+ Good, 50–89 Needs Improvement, 0–49 Poor ──
        'categories:performance':    ['warn',  { minScore: 0.5 }],
        'categories:accessibility':  ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn',  { minScore: 0.9 }],
        'categories:seo':            ['warn',  { minScore: 0.9 }],

        // ── Core Web Vitals — Google "Good" thresholds (support.google.com/webmasters/answer/9205520) ──
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],  // Good ≤ 2.5 s
        'total-blocking-time':      ['warn', { maxNumericValue: 200  }],  // Good ≤ 200 ms (lab proxy for INP)
        'cumulative-layout-shift':  ['warn', { maxNumericValue: 0.1  }],  // Good ≤ 0.1
        'first-contentful-paint':   ['warn', { maxNumericValue: 1800 }],  // Good ≤ 1.8 s
        'speed-index':              ['warn', { maxNumericValue: 3400 }],  // Lighthouse Good ≤ 3.4 s
        'interactive':              ['warn', { maxNumericValue: 3800 }],  // Lighthouse Good ≤ 3.8 s

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
