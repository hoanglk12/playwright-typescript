#!/usr/bin/env node
// Runs a collector against every GRA staging storefront on Desktop (1440 x 900) and iPhone 15 (Chromium).
//
// Usage:
//   node probe-sites.mjs <collector.mjs> [--sites platypus-au,vans-nz] [--viewports desktop,mobile]
//                        [--path /shop/mens] [--out results.json] [--shots <dir>] [--settle 4000]
//
// The collector's default export receives { page, site, viewport, styles, scrollToFooter, dismissPopups, shot }
// and returns anything JSON-serialisable. The page is already loaded and <main> is visible.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const require = createRequire(path.join(repoRoot, 'package.json'));
const { chromium, devices } = require('@playwright/test');

const { defaultBrowserType: _webkit, ...iphone15 } = devices['iPhone 15'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: iphone15,
};

function parseArgs(argv) {
  const opts = { sites: null, viewports: Object.keys(VIEWPORTS), path: '', out: 'probe-results.json', shots: null, settle: 4000 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sites') opts.sites = argv[++i].split(',');
    else if (a === '--viewports') opts.viewports = argv[++i].split(',');
    else if (a === '--path') opts.path = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--shots') opts.shots = argv[++i];
    else if (a === '--settle') opts.settle = Number(argv[++i]);
    else rest.push(a);
  }
  if (rest.length !== 1) {
    console.error('Usage: node probe-sites.mjs <collector.mjs> [--sites ids] [--viewports desktop,mobile] [--path /x] [--out file] [--shots dir]');
    process.exit(2);
  }
  opts.collector = path.resolve(rest[0]);
  return opts;
}

function loadStorefronts() {
  const src = fs.readFileSync(path.join(repoRoot, 'src/data/ecommerce/storefronts.ts'), 'utf8');
  return [...src.matchAll(/name:\s*'([^']+)',\s*url:\s*'([^']+)'/g)].map(([, name, url]) => ({
    name,
    url,
    // https://stag-platypus-au.accentgra.com/ -> platypus-au
    id: new URL(url).hostname.split('.')[0].replace(/^stag-/, ''),
  }));
}

// Same close buttons as src/pages/helpers/overlay-helper.ts. Escape alone doesn't close the
// Vans AU "Join The Crew" sign-up pop-up, which then blocks every tap on mobile.
const POPUP_CLOSE = [
  '[aria-label="Close"]',
  '[aria-label="close"]',
  'button.close',
  '.modal-close',
  '[class*="popup"] [class*="close"]',
  '[class*="overlay"] [class*="close"]',
  '#popup-close',
];

function helpers(page, shotsDir, key) {
  async function dismissPopups() {
    await page.keyboard.press('Escape');
    for (const selector of POPUP_CLOSE) {
      const close = page.locator(`${selector}:visible`).first();
      if (await close.count()) await close.click({ timeout: 3000 }).catch(() => {});
    }
  }

  return {
    dismissPopups,
    // Text colour, own background and the first non-transparent background behind the element.
    async styles(locator) {
      return locator.first().evaluate((el) => {
        const hex = (c) => {
          const m = (c || '').match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
          if (!m) return c;
          const h = '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
          return m[4] !== undefined && m[4] !== '1' ? `${h}@${m[4]}` : h;
        };
        let behind = el;
        while (behind && getComputedStyle(behind).backgroundColor === 'rgba(0, 0, 0, 0)') behind = behind.parentElement;
        const cs = getComputedStyle(el);
        return {
          color: hex(cs.color),
          background: hex(cs.backgroundColor),
          backgroundBehind: behind ? hex(getComputedStyle(behind).backgroundColor) : null,
        };
      });
    },
    // Footers are lazy-rendered.
    async scrollToFooter() {
      await dismissPopups();
      for (let i = 0; i < 40; i++) {
        await page.evaluate(() => window.scrollBy(0, 1200));
        await page.waitForTimeout(250);
        if (await page.locator('footer').count()) break;
      }
      await page.locator('footer').first().waitFor({ state: 'attached', timeout: 30000 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
    },
    async shot(name) {
      if (!shotsDir) return;
      await page.screenshot({ path: path.join(shotsDir, `${key}-${name}.png`) });
    },
  };
}

const opts = parseArgs(process.argv.slice(2));
const collect = (await import(pathToFileURL(opts.collector).href)).default;
const sites = loadStorefronts().filter((s) => !opts.sites || opts.sites.includes(s.id));
if (opts.shots) fs.mkdirSync(opts.shots, { recursive: true });

const browser = await chromium.launch();
const results = {};
let failures = 0;
for (const site of sites) {
  for (const vp of opts.viewports) {
    const key = `${site.id}-${vp}`;
    const context = await browser.newContext({ ...VIEWPORTS[vp], locale: 'en-AU' });
    const page = await context.newPage();
    try {
      await page.goto(new URL(opts.path, site.url).href, { waitUntil: 'commit', timeout: 90000 });
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 60000 });
      await page.waitForTimeout(opts.settle);
      results[key] = await collect({ page, site, viewport: vp, ...helpers(page, opts.shots, key) });
      console.log('ok ', key, JSON.stringify(results[key]).slice(0, 400));
    } catch (e) {
      failures++;
      results[key] = { error: e.message.split('\n')[0] };
      console.log('ERR', key, results[key].error);
    }
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(opts.out, JSON.stringify(results, null, 2));
console.log(`wrote ${opts.out} (${Object.keys(results).length} runs, ${failures} errors)`);
process.exit(failures ? 1 : 0);
