#!/usr/bin/env node
// Lints one card's "Proposed Xray steps" block against the TEST-878 writing rules, then renders it.
//
// Usage: node check-card.mjs <traceability.html> <TEST-KEY> [--shots <dir>]
// Exits 1 when any FAIL is reported. WARN lines are judgement calls to look at, not blockers.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(path.resolve(here, '../../../..'), 'package.json'));
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const shotsIdx = args.indexOf('--shots');
const shots = shotsIdx >= 0 ? args.splice(shotsIdx, 2)[1] : null;
const [htmlPath, key] = args;
if (!htmlPath || !key) {
  console.error('Usage: node check-card.mjs <traceability.html> <TEST-KEY> [--shots <dir>]');
  process.exit(2);
}

const PROPOSED = "<details class='xsteps proposed' open>";
const PRECONDITION = 'Run every step twice: once on Desktop (browser window 1440 × 900) and once on Mobile (Phone 15 emulation).';
const results = [];
const check = (ok, message, level = 'FAIL') => results.push({ status: ok ? 'PASS' : level, message });
// Cell and block tags become spaces so "<th>Top bar</th><th>Header bar</th>" doesn't read as "barHeader".
const textOf = (html) =>
  html
    .replace(/<\/?(td|th|tr|p|div|br|li|summary|table|thead|tbody|ul|ol)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const raw = fs.readFileSync(htmlPath, 'utf8');
const cardStart = raw.indexOf(`<article class='test' id='${key}'`);
if (cardStart < 0) {
  console.error(`no card with id ${key}`);
  process.exit(2);
}
const card = raw.slice(cardStart, raw.indexOf('</article>', cardStart));
const blockStart = card.indexOf(PROPOSED);
check(blockStart >= 0, 'card has a proposed block');
if (blockStart < 0) report();

const block = card.slice(blockStart, card.indexOf('</details>', blockStart) + '</details>'.length);
const text = textOf(block);
const rows = [...block.matchAll(/<tr><td>(\d+)<\/td>/g)].map((m) => Number(m[1]));
const summaryCount = Number((block.match(/<summary>Proposed Xray steps · (\d+) steps?/) || [])[1]);

check(/<summary>Proposed Xray steps · \d+ steps?, each run on Desktop and Mobile · drafted \d{4}-\d{2}-\d{2}/.test(block), 'summary follows the TEST-878 format');
check(card.includes("<summary>Current Xray steps"), 'transcribed steps are renamed "Current Xray steps"');
check(text.includes(PRECONDITION), 'precondition has the "Run every step twice ... Phone 15 emulation" sentence');
check(block.includes('<th>#</th><th>Action</th><th>Data</th><th>Expected Result</th>'), 'steps table has #, Action, Data, Expected Result columns');
check(rows.length > 0 && rows.every((n, i) => n === i + 1), `steps are numbered 1 to ${rows.length}`);
check(summaryCount === rows.length, `summary step count (${summaryCount}) matches the table (${rows.length})`);
check(!/[–—]/.test(text), 'no em or en dashes');
check(!/[‘’“”]/.test(text), 'no curly quotes');

const nonHexCode = [...block.matchAll(/<code>([^<]*)<\/code>/g)].map((m) => m[1]).filter((c) => !/^#[0-9a-f]{6}$/i.test(c));
check(nonHexCode.length === 0, `<code> holds hex colours only${nonHexCode.length ? ': found ' + nonHexCode.slice(0, 5).join(', ') : ''}`);

const banned = [
  [/E2E-[A-Z]+-\d+/, 'scenario IDs'],
  [/· Automated|<strong>New<\/strong>|\bNew ·/, '"Automated" or "New" labels'],
  [/Seen while drafting|Dropped as|Replaces the \d/i, 'meta notes'],
  [/\b[a-z]+[A-Z]\w*\b/, 'camelCase code names'],
  [/\.(ts|tsx|js|mjs|json|py)\b/, 'file names'],
  [/(^|[\s(])\.[a-z][\w]*-[\w-]+/, 'CSS class names'],
  [/\b(selector|locator|getBy\w*|querySelector|aria-label|data-testid|background-color|page object|spec file|regex)\b/i, 'framework terms'],
];
for (const [pattern, label] of banned) {
  const found = text.replace(/\biPhone\b/g, '').match(pattern);
  check(!found, `no ${label}${found ? ': found "' + found[0].trim() + '"' : ''}`);
}

const bolded = (block.match(/<strong>/g) || []).length;
check(bolded >= rows.length + 3, `key text is bold (${bolded} bold spans for ${rows.length} steps)`, 'WARN');
if (/On desktop,/.test(text)) check(block.includes('<strong>On desktop,</strong>'), '"On desktop," is bold', 'WARN');
if (/On mobile,/.test(text)) check(block.includes('<strong>On mobile,</strong>'), '"On mobile," is bold', 'WARN');

const browser = await chromium.launch();
for (const [name, width, scheme] of [['desktop-light', 1280, 'light'], ['phone-dark', 390, 'dark']]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(htmlPath)).href);
  const state = await page.evaluate((k) => {
    const d = document.querySelector(`#${CSS.escape(k)} details.proposed`);
    return { open: !!d && d.open, hscroll: document.documentElement.scrollWidth > window.innerWidth };
  }, key);
  check(errors.length === 0, `${name}: no page errors${errors.length ? ': ' + errors[0] : ''}`);
  check(state.open, `${name}: proposed block renders open`);
  check(!state.hscroll, `${name}: no horizontal scroll`);
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    await page.addStyleTag({ content: '.toolbar { position: static !important; }' });
    const file = path.join(shots, `${key}-${name}.png`);
    await page.locator(`#${key} details.proposed`).screenshot({ path: file });
    console.log(`screenshot: ${file}`);
  }
  await page.close();
}
await browser.close();
report();

function report() {
  for (const r of results) console.log(`${r.status.padEnd(4)} ${r.message}`);
  const fails = results.filter((r) => r.status === 'FAIL').length;
  console.log(`${key}: ${fails} FAIL, ${results.filter((r) => r.status === 'WARN').length} WARN`);
  process.exit(fails ? 1 : 0);
}
