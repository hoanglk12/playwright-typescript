/**
 * DOM Inspector — find ranked locator candidates for a described element.
 *
 * Usage:
 *   node scripts/dom-inspector.mjs --url <url> --description "<element>"
 *   node scripts/dom-inspector.mjs --env testing --description "<element>"
 *
 * Output: JSON  { url, query, candidates: [{ locator, score, stable, count }] }
 *
 * Designed for playwright-test-healer to use instead of browser_snapshot when
 * hunting a replacement locator after SELECTOR_STALE failures. One call replaces
 * 2-4 snapshot round-trips (~8,000 tokens saved per locator hunt).
 */

import { chromium } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// ── arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] ?? null : null; };

const description = getArg('--description');
const explicitUrl = getArg('--url');
const envName     = getArg('--env') ?? 'testing';

if (!description) {
  console.log(JSON.stringify({ error: 'Required: --description "<element to find>"' }));
  process.exit(1);
}

// ── URL resolution ───────────────────────────────────────────────────────────

function loadEnvUrl(env) {
  const envFile = join(PROJECT_ROOT, `.env.${env}`);
  if (!existsSync(envFile)) return null;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('FRONT_SITE_URL=')) return trimmed.slice('FRONT_SITE_URL='.length).trim();
  }
  return null;
}

const url = explicitUrl ?? loadEnvUrl(envName);
if (!url) {
  console.log(JSON.stringify({
    error: `No URL. Pass --url <url> or ensure FRONT_SITE_URL is set in .env.${envName}`,
  }));
  process.exit(1);
}

// ── locator stability scorer ─────────────────────────────────────────────────
// Mirrors CLAUDE.md locator priority: getByRole > getByLabel > getByText > CSS

function scoreLocator(locStr) {
  if (locStr.startsWith('getByRole'))        return 0.97;
  if (locStr.startsWith('getByLabel'))       return 0.90;
  if (locStr.startsWith('getByPlaceholder')) return 0.87;
  if (locStr.startsWith('getByText'))        return 0.80;
  if (locStr.includes('getByTestId') ||
      locStr.includes('data-testid'))        return 0.72;
  if (locStr.includes('[aria-'))             return 0.65;
  if (/[>+~]/.test(locStr))                 return 0.20; // structural — fragile
  return 0.45;                                           // plain CSS
}

// ── candidate generator ──────────────────────────────────────────────────────

function buildCandidates(page, desc) {
  const lower = desc.toLowerCase();
  const escaped = desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');

  // infer likely roles from description keywords
  const roleHints = [];
  if (/\b(btn|button|submit|send|confirm|add|remove|delete|save|cancel|buy|checkout)\b/.test(lower)) roleHints.push('button');
  if (/\b(link|nav|href|menu|anchor)\b/.test(lower)) roleHints.push('link');
  if (/\b(input|field|textbox|type|enter|search|query)\b/.test(lower)) roleHints.push('textbox', 'searchbox');
  if (/\b(check|checkbox|tick)\b/.test(lower)) roleHints.push('checkbox');
  if (/\b(select|dropdown|combobox|pick|choose)\b/.test(lower)) roleHints.push('combobox', 'listbox');
  if (/\b(heading|title|h[1-6])\b/.test(lower)) roleHints.push('heading');
  if (/\b(tab|tabs)\b/.test(lower)) roleHints.push('tab');
  if (/\b(alert|message|notification)\b/.test(lower)) roleHints.push('alert', 'status');
  // always try button + link as fallback
  if (!roleHints.includes('button')) roleHints.push('button');
  if (!roleHints.includes('link'))   roleHints.push('link');

  // key nouns after stripping stop-words (for data-testid fragments)
  const stopWords = new Set(['a','an','the','to','for','of','in','on','at','by','with','from','and','or','is','it','this']);
  const keyWords = lower.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''));

  const candidates = [];

  // 1. Role-based (highest priority per framework rules)
  const seenRoles = new Set();
  for (const role of roleHints) {
    if (seenRoles.has(role)) continue;
    seenRoles.add(role);
    candidates.push({
      locStr: `getByRole('${role}', { name: /${escaped}/i })`,
      locFn:  () => page.getByRole(role, { name: pattern }),
    });
  }

  // 2. Label-based
  candidates.push({
    locStr: `getByLabel(/${escaped}/i)`,
    locFn:  () => page.getByLabel(pattern),
  });

  // 3. Placeholder-based (for inputs)
  candidates.push({
    locStr: `getByPlaceholder(/${escaped}/i)`,
    locFn:  () => page.getByPlaceholder(pattern),
  });

  // 4. Text-based
  candidates.push({
    locStr: `getByText(/${escaped}/i)`,
    locFn:  () => page.getByText(pattern),
  });

  // 5. data-testid fragments from key words
  for (const word of keyWords.slice(0, 4)) {
    candidates.push({
      locStr: `[data-testid*="${word}"]`,
      locFn:  () => page.locator(`[data-testid*="${word}"]`),
    });
  }

  // 6. aria-label
  candidates.push({
    locStr: `[aria-label*="${desc}"]`,
    locFn:  () => page.locator(`[aria-label*="${desc}"]`),
  });

  return candidates;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    const candidates = buildCandidates(page, description);
    const results    = [];
    const seenStr    = new Set();

    for (const { locStr, locFn } of candidates) {
      if (seenStr.has(locStr)) continue;
      seenStr.add(locStr);
      try {
        const loc   = locFn();
        const count = await loc.count();
        if (count === 0) continue;
        const visible = await loc.first().isVisible().catch(() => false);
        if (!visible) continue;
        results.push({ locator: locStr, score: scoreLocator(locStr), stable: count === 1, count });
      } catch {
        // invalid locator — skip silently
      }
    }

    // sort by score descending, cap at top 5
    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, 5);

    console.log(JSON.stringify({ url, query: description, candidates: top }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
