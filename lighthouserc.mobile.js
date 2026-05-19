'use strict';

/**
 * Lighthouse CI configuration — mobile form factor.
 * Same 8 URLs as lighthouserc.js; uses Slow 4G throttling and mobile screen emulation.
 * Run locally:  npx lhci collect --config=lighthouserc.mobile.js
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
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',

        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        },

        // Simulated Slow 4G — Lighthouse mobile preset
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },

        skipAudits: [],
      },
    },

    assert: {
      assertions: {
        // ── Category score gates — Google scale: 90+ Good, 50–89 Needs Improvement, 0–49 Poor ──
        'categories:performance':    ['warn',  { minScore: 0.9 }],
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
      target: 'filesystem',
      outputDir: './lighthouse-reports-mobile',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
