'use strict';

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'lighthouse-reports');
const MANIFEST_PATH = path.join(REPORTS_DIR, 'manifest.json');
const OUTPUT_PATH = path.join(REPORTS_DIR, 'index.html');

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

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`manifest.json not found at ${MANIFEST_PATH} — skipping index generation`);
  process.exit(0);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (err) {
  console.error(`manifest.json could not be parsed: ${err.message} — skipping index generation`);
  process.exit(0);
}

if (!Array.isArray(manifest)) {
  console.error('manifest.json is not an array — skipping index generation');
  process.exit(0);
}

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
    console.warn(`[WARN] URL "${url}" has no htmlPath in the representative run — skipping row`);
    return null;
  }
  const label = labelFromUrl(url);
  const htmlFile = safeBasename(rep.htmlPath);
  const scores = rep.summary ?? {};
  return { label, url, htmlFile, scores };
}).filter(Boolean);

rows.sort((a, b) => a.label.localeCompare(b.label));

const sha = escapeHtml((process.env.GITHUB_SHA || '').slice(0, 7) || 'local');
const branch = escapeHtml(process.env.GITHUB_REF_NAME || 'local');
const timestamp = escapeHtml(new Date().toUTCString());

const tableRows = rows.map(r => {
  const perf = r.scores.performance;
  const a11y = r.scores.accessibility;
  const bp = r.scores['best-practices'];
  const seo = r.scores.seo;
  const safeHref = escapeHtml(r.htmlFile);
  const safeLabel = escapeHtml(r.label);
  return `
    <tr>
      <td><a href="${safeHref}" class="site-link">${safeLabel}</a></td>
      <td style="color:${scoreColor(perf)}">${scoreDisplay(perf)}</td>
      <td style="color:${scoreColor(a11y)}">${scoreDisplay(a11y)}</td>
      <td style="color:${scoreColor(bp)}">${scoreDisplay(bp)}</td>
      <td style="color:${scoreColor(seo)}">${scoreDisplay(seo)}</td>
    </tr>`;
}).join('\n');

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
    .meta { color: var(--muted); font-size: 0.82rem; margin-bottom: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
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
  <table>
    <thead>
      <tr><th>Storefront</th><th>Perf</th><th>A11y</th><th>Best Practices</th><th>SEO</th></tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <footer>Generated by scripts/generate-lhci-index.js &mdash; Playwright TypeScript Framework</footer>
</div>
</body>
</html>`;

fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
console.log(`Lighthouse landing page written to ${OUTPUT_PATH} (${rows.length} sites)`);
