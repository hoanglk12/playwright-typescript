'use strict';

// Pulls per-brand homepage INP (Interaction to Next Paint) from New Relic at CI build time
// and writes it to newrelic-reports/inp.json for generate-lhci-index.js to render. The
// Lighthouse dashboard is a static Cloudflare Pages site with no backend, so this data has
// to be baked in during the same CI job that generates the report — there is no live
// client-side fetch path that wouldn't mean shipping a New Relic API key to the browser.

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'newrelic-reports');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'inp.json');

const NERDGRAPH_URL = 'https://api.newrelic.com/graphql';
const API_KEY = process.env.NEW_RELIC_API_KEY;

// A CI run can fire at any hour, so the ~1-hour "no SINCE" default that matches New Relic's
// own dashboard widgets interactively would leave low-traffic cells (NZ desktop in
// particular) at n=0 or n=1. 7 days keeps every brand's cells populated with real sessions
// without drifting as far from "current" as Google's 28-day CWV convention.
const WINDOW = process.env.NR_INP_WINDOW || '7 days ago';

// PageViewTiming stores one row per timing checkpoint (windowLoad, firstPaint,
// interactionToNextPaint, cumulativeLayoutShift, ...), not one row per page load with every
// metric populated. Without this filter, percentile() blends in other checkpoints' rows.
const TIMING_FILTER = "timingName = 'interactionToNextPaint'";

const BRANDS = [
  {
    key: 'platypus',
    label: 'Platypus',
    accountId: 2956572,
    appName: 'PLA PROD',
    env: 'production',
    urls: { AU: 'https://www.platypusshoes.com.au/', NZ: 'https://www.platypusshoes.co.nz/' },
  },
  {
    key: 'skechers',
    label: 'Skechers',
    accountId: 3562370,
    appName: 'c27abj7wwbj5a',
    env: 'production',
    urls: { AU: 'https://www.skechers.com.au/', NZ: 'https://www.skechers.co.nz/' },
  },
  {
    key: 'vans',
    label: 'Vans',
    accountId: 3736705,
    appName: 'fh26tdmbezwks',
    env: 'production',
    urls: { AU: 'https://www.vans.com.au/', NZ: 'https://www.vans.co.nz/' },
  },
  {
    key: 'drmartens',
    label: 'Dr. Martens',
    accountId: 3845367,
    appName: 'fpv2lfvzogav4',
    env: 'production',
    urls: { AU: 'https://www.drmartens.com.au/', NZ: 'https://www.drmartens.co.nz/' },
  },
  {
    key: 'taf',
    label: "The Athlete's Foot",
    accountId: 4570064,
    appName: 'vdtktixufa6au',
    env: 'production',
    urls: {
      AU: 'https://www.theathletesfoot.com.au/',
      NZ: 'https://www.theathletesfoot.co.nz/',
    },
  },
];

function buildNrql(brand) {
  const urlFilter = Object.values(brand.urls)
    .map(url => `pageUrl = '${url}'`)
    .join(' OR ');
  return (
    `SELECT percentile(interactionToNextPaint, 75) AS inp, count(*) AS views ` +
    `FROM PageViewTiming WHERE appName = '${brand.appName}' AND ${TIMING_FILTER} AND (${urlFilter}) ` +
    `FACET pageUrl, deviceType SINCE ${WINDOW} LIMIT MAX`
  );
}

// New Relic's own NerdGraph examples inline the NRQL string directly into the query
// document rather than passing it through a GraphQL variable (the "Nrql" scalar's variable
// serialization isn't documented) — this escapes and inlines it the same way to stay on the
// one path NerdGraph's docs actually demonstrate.
function escapeGraphQlString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildGraphQlQuery(brand) {
  const nrql = escapeGraphQlString(buildNrql(brand));
  return `{
    actor {
      account(id: ${brand.accountId}) {
        nrql(query: "${nrql}") {
          results
        }
      }
    }
  }`;
}

async function queryBrand(brand) {
  const response = await fetch(NERDGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'API-Key': API_KEY },
    body: JSON.stringify({ query: buildGraphQlQuery(brand) }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map(e => e.message).join('; '));
  }

  const results = body.data?.actor?.account?.nrql?.results ?? [];
  const countryByUrl = Object.fromEntries(
    Object.entries(brand.urls).map(([country, url]) => [url, country])
  );

  const devices = {};
  for (const row of results) {
    const country = countryByUrl[row.pageUrl];
    const device = row.deviceType;
    if (!country || !device) continue;
    // interactionToNextPaint is stored in seconds; Google's INP thresholds are in milliseconds.
    const inpMs = row.inp?.['75'] != null ? row.inp['75'] * 1000 : null;
    devices[`${country}_${device}`] = { country, device, inpMs, views: row.views ?? 0 };
  }

  return { key: brand.key, label: brand.label, env: brand.env, devices };
}

async function main() {
  if (!API_KEY) {
    console.warn('[WARN] NEW_RELIC_API_KEY not set — skipping New Relic INP fetch');
    return;
  }

  const brandResults = [];
  for (const brand of BRANDS) {
    try {
      brandResults.push(await queryBrand(brand));
      console.log(`[OK] ${brand.label} (${brand.env}) fetched`);
    } catch (err) {
      console.error(`[ERROR] ${brand.label}: ${err.message}`);
    }
  }

  if (brandResults.length === 0) {
    console.warn('[WARN] No New Relic data fetched for any brand — skipping output');
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ fetchedAt: new Date().toISOString(), window: WINDOW, brands: brandResults }, null, 2),
    'utf8'
  );
  console.log(`New Relic INP data written to ${OUTPUT_PATH} (${brandResults.length}/${BRANDS.length} brands)`);
}

// Never fails the build over this — it's a supplementary section on the report, not the report itself.
main().catch(err => {
  console.error(`[ERROR] Unhandled failure in fetch-newrelic-inp.js: ${err.message}`);
  process.exit(0);
});
