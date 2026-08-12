'use strict';

// Bitbucket Pipelines port of generate-lhci-index.js. Kept as a full copy, not a
// require() wrapper, so the Bitbucket pipeline's landing page reads BITBUCKET_COMMIT /
// BITBUCKET_BRANCH directly rather than depending on GitHub's env vars being absent.

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'lighthouse-reports');
const OUTPUT_PATH = path.join(REPORTS_DIR, 'index.html');

// Mirrors generate-lhci-index.js's RUM section for layout parity, but the Bitbucket
// pipeline has no NEW_RELIC_API_KEY and never runs fetch-newrelic-inp.js (see CLAUDE.md,
// Bitbucket Lighthouse Pipeline) — this path exists so loadInpData() reliably returns
// null and the section renders as cleanly omitted, not so the data ever populates here.
const NEWRELIC_INP_PATH = path.join(__dirname, '..', 'newrelic-reports', 'inp.json');

const INP_MIN_SAMPLE_SIZE = 20;

const LABEL_MAP = {
  'stag-platypus-au': 'Platypus AU',
  'stag-platypus-nz': 'Platypus NZ',
  'stag-skechers-au': 'Skechers AU',
  'stag-skechers-nz': 'Skechers NZ',
  'stag-vans-au': 'Vans AU',
  'stag-vans-nz': 'Vans NZ',
  'stag-drmartens-au': 'Dr. Martens AU',
  'stag-drmartens-nz': 'Dr. Martens NZ',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Handles Windows absolute paths in manifests generated on Windows machines
function safeBasename(filePath) {
  const base = path.basename(filePath);
  return base.includes('\\') ? path.win32.basename(filePath) : base;
}

function labelFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const [key, label] of Object.entries(LABEL_MAP)) {
      if (hostname.includes(key)) return label;
    }
    return hostname;
  } catch {
    return url;
  }
}

function scoreColor(score) {
  if (score === null || score === undefined) return '#8b8fa8';
  if (score >= 0.9) return '#22c55e';
  if (score >= 0.5) return '#f59e0b';
  return '#ef4444';
}

function scoreDisplay(score) {
  if (score === null || score === undefined) return 'N/A';
  return Math.round(score * 100).toString();
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`[ERROR] ${manifestPath} could not be parsed: ${err.message}`);
    return null;
  }
  if (!Array.isArray(manifest)) {
    console.error(`[ERROR] ${manifestPath} is not an array`);
    return null;
  }
  return manifest;
}

function buildRows(manifest, hrefPrefix) {
  const validEntries = manifest.filter(entry => {
    if (!entry.url) {
      console.warn('[WARN] Manifest entry missing url field — skipped');
      return false;
    }
    return true;
  });

  const byUrl = groupBy(validEntries, 'url');

  const rows = Object.entries(byUrl).map(([url, runs]) => {
    const representativeRun = runs.find(r => r.isRepresentativeRun);
    if (!representativeRun) {
      console.warn(`[WARN] No representative run for "${url}" — using first run as fallback`);
    }
    const rep = representativeRun ?? runs[0];
    if (!rep.htmlPath) {
      console.warn(`[WARN] URL "${url}" has no htmlPath — skipping row`);
      return null;
    }
    const label = labelFromUrl(url);
    const htmlFile = hrefPrefix + safeBasename(rep.htmlPath);
    const scores = rep.summary ?? {};
    return { label, htmlFile, scores };
  }).filter(Boolean);

  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

function loadInpData(inpPath) {
  if (!fs.existsSync(inpPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(inpPath, 'utf8'));
    if (!Array.isArray(data.brands)) {
      console.error(`[ERROR] ${inpPath} has no brands array`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`[ERROR] ${inpPath} could not be parsed: ${err.message}`);
    return null;
  }
}

function inpColor(inpMs, views) {
  if (inpMs === null || inpMs === undefined || views < INP_MIN_SAMPLE_SIZE) return '#8b8fa8';
  if (inpMs <= 200) return '#22c55e';
  if (inpMs <= 500) return '#f59e0b';
  return '#ef4444';
}

function inpDisplay(inpMs, views) {
  if (inpMs === null || inpMs === undefined) return 'N/A';
  const value = `${Math.round(inpMs)} ms`;
  return views < INP_MIN_SAMPLE_SIZE ? `${value} (n=${views})` : value;
}

function renderInpTable(brands) {
  if (brands.length === 0) return '<p style="color:var(--muted);padding:0.5rem 0">No New Relic data found.</p>';
  const cells = ['AU_Desktop', 'AU_Mobile', 'NZ_Desktop', 'NZ_Mobile'];
  return `<table>
    <thead>
      <tr><th>Brand</th><th>AU Desktop</th><th>AU Mobile</th><th>NZ Desktop</th><th>NZ Mobile</th></tr>
    </thead>
    <tbody>
      ${brands.map(brand => {
        const label = brand.env === 'staging'
          ? `${escapeHtml(brand.label)} <span class="badge">staging</span>`
          : escapeHtml(brand.label);
        const tds = cells.map(cellKey => {
          const cell = brand.devices[cellKey];
          const inpMs = cell?.inpMs ?? null;
          const views = cell?.views ?? 0;
          return `<td style="color:${inpColor(inpMs, views)}">${inpDisplay(inpMs, views)}</td>`;
        }).join('\n        ');
        return `<tr>
        <td>${label}</td>
        ${tds}
      </tr>`;
      }).join('\n      ')}
    </tbody>
  </table>`;
}

function renderTable(rows) {
  if (rows.length === 0) return '<p style="color:var(--muted);padding:0.5rem 0">No reports found.</p>';
  return `<table>
    <thead>
      <tr><th>Storefront</th><th>Perf</th><th>A11y</th><th>Best Practices</th><th>SEO</th></tr>
    </thead>
    <tbody>
      ${rows.map(r => {
        const perf = r.scores.performance;
        const a11y = r.scores.accessibility;
        const bp   = r.scores['best-practices'];
        const seo  = r.scores.seo;
        return `<tr>
        <td><a href="${escapeHtml(r.htmlFile)}" class="site-link">${escapeHtml(r.label)}</a></td>
        <td style="color:${scoreColor(perf)}">${scoreDisplay(perf)}</td>
        <td style="color:${scoreColor(a11y)}">${scoreDisplay(a11y)}</td>
        <td style="color:${scoreColor(bp)}">${scoreDisplay(bp)}</td>
        <td style="color:${scoreColor(seo)}">${scoreDisplay(seo)}</td>
      </tr>`;
      }).join('\n      ')}
    </tbody>
  </table>`;
}

const desktopManifest = loadManifest(path.join(REPORTS_DIR, 'manifest.json'));
const mobileManifest  = loadManifest(path.join(REPORTS_DIR, 'mobile', 'manifest.json'));

if (!desktopManifest && !mobileManifest) {
  console.error('No manifest.json found for desktop or mobile — skipping index generation');
  process.exit(0);
}

const desktopRows = desktopManifest ? buildRows(desktopManifest, '') : [];
const mobileRows  = mobileManifest  ? buildRows(mobileManifest, 'mobile/') : [];

const sha       = escapeHtml((process.env.BITBUCKET_COMMIT || '').slice(0, 7) || 'local');
const branch    = escapeHtml(process.env.BITBUCKET_BRANCH || 'local');
const timestamp = escapeHtml(new Date().toUTCString());

const mobileSection = mobileRows.length > 0 ? `
  <h2>&#128241; Mobile <span class="badge">375&times;667 &mdash; Slow 4G</span></h2>
  ${renderTable(mobileRows)}` : '';

const inpData = loadInpData(NEWRELIC_INP_PATH);
const inpSection = inpData ? `
  <h2>&#128246; Real User Monitoring &mdash; INP <span class="badge">New Relic, homepage, p75 over ${escapeHtml(inpData.window)}</span></h2>
  ${renderInpTable(inpData.brands)}
  <p class="meta" style="margin-top:0.6rem">Good &le;200ms &middot; Needs improvement 200&ndash;500ms &middot; Poor &gt;500ms &middot; grey = fewer than ${INP_MIN_SAMPLE_SIZE} sessions in this window</p>` : '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lighthouse Reports &#8212; ${branch} @ ${sha}</title>
  <style>
    :root {
      --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a;
      --accent: #f6821f; --text: #e2e4ed; --muted: #8b8fa8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem 1rem; }
    .container { max-width: 820px; margin: 0 auto; }
    h1 { font-size: 1.4rem; font-weight: 700; color: var(--text); margin-bottom: 0.3rem; }
    h2 { font-size: 1rem; font-weight: 700; color: var(--accent); margin: 2rem 0 0.8rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }
    .badge { font-size: 0.75rem; font-weight: 500; color: var(--muted); margin-left: 0.4rem; }
    .meta { color: var(--muted); font-size: 0.82rem; margin-bottom: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin-bottom: 0.5rem; }
    thead { background: #12151f; }
    th { text-align: left; padding: 0.6rem 1rem; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    td { padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: rgba(255,255,255,0.02); }
    .site-link { color: var(--accent); text-decoration: none; font-weight: 700; }
    .site-link:hover { text-decoration: underline; }
    footer { margin-top: 2rem; color: var(--muted); font-size: 0.78rem; text-align: center; }
  </style>
</head>
<body>
<div class="container">
  <h1>Lighthouse Reports</h1>
  <p class="meta">Branch: <strong>${branch}</strong> &mdash; Commit: <strong>${sha}</strong> &mdash; ${timestamp}</p>

  <h2>&#128196; Desktop <span class="badge">1350&times;940 &mdash; Simulated cable</span></h2>
  ${desktopRows.length > 0 ? renderTable(desktopRows) : '<p style="color:var(--muted);padding:0.5rem 0">No desktop reports found.</p>'}
${mobileSection}
${inpSection}

  <footer>Generated by scripts/generate-lhci-index.bitbucket.js &mdash; Playwright TypeScript Framework</footer>
</div>
</body>
</html>`;

fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
console.log(`Lighthouse landing page written to ${OUTPUT_PATH} (desktop: ${desktopRows.length}, mobile: ${mobileRows.length} sites, New Relic INP: ${inpData ? inpData.brands.length : 0} brands)`);
