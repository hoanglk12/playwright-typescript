/**
 * DOM Inspector — find ranked locator candidates for a described element.
 *
 * Usage:
 *   node scripts/dom-inspector.mjs --url <url> --description "<element>"
 *   node scripts/dom-inspector.mjs --env testing --description "<element>"
 *   node scripts/dom-inspector.mjs --storefront <slug> --description "<element>"
 *   node scripts/dom-inspector.mjs --storefront <slug> --page pdp --description "<element>"
 *
 * --storefront resolves against the 8 ecommerce storefronts in
 * src/data/ecommerce/storefronts.ts, matched by a slugified form of `name`
 * (e.g. "Vans AU" -> vans-au, "Dr. Martens AU" -> dr-martens-au).
 * --page selects which URL on the storefront to probe: `pdp` (storefront's
 * pdpPath — errors if that storefront has none configured) or `home`/`default`
 * (storefront's bare url, the default when --page is omitted).
 * --storefront takes precedence over --url/--env when both are supplied.
 *
 * A non-2xx response for the resolved URL is treated as an error, not a page to scan.
 *
 * Output: JSON  { url, query, popupDismissed, candidates: [{ locator, score, stable, count }] }
 * `score` ranks locator *type* (role/label/text/css); it is not DOM-aware. Treat a
 * candidate as safe to hoist only when score >= 0.90 AND stable === true (count === 1) —
 * a high score with count > 1 is a strict-mode violation waiting to happen.
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

const description     = getArg('--description');
const explicitUrl     = getArg('--url');
const envName         = getArg('--env') ?? 'testing';
const storefrontSlug  = getArg('--storefront');
const pageKey         = getArg('--page') ?? 'home';

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

// ── storefront resolution (src/data/ecommerce/storefronts.ts, read as text) ──
// storefronts.ts is TypeScript; this script is plain Node ESM with no TS loader.
// Parse it as text (same pattern as loadEnvUrl above) instead of importing it —
// no build step, no new dependency.

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function loadStorefronts() {
  const file = join(PROJECT_ROOT, 'src', 'data', 'ecommerce', 'storefronts.ts');
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const arrayMatch = text.match(/storefronts:\s*readonly Storefront\[\]\s*=\s*\[([\s\S]*)\];/);
  if (!arrayMatch) return [];
  const blocks = arrayMatch[1].match(/\{[^{}]*\}/g) ?? [];
  const parsed = blocks.map((block) => ({
    name:    block.match(/name:\s*'([^']*)'/)?.[1],
    url:     block.match(/url:\s*'([^']*)'/)?.[1],
    pdpPath: block.match(/pdpPath:\s*'([^']*)'/)?.[1],
  }));
  const valid = parsed.filter((s) => s.name && s.url);
  if (valid.length !== blocks.length) {
    console.error(
      `[dom-inspector] warning: parsed ${blocks.length} storefront block(s) from ${file} but ` +
      `only ${valid.length} yielded both name and url — storefronts.ts formatting may have changed.`
    );
  }
  return valid;
}

function resolveStorefrontUrl(slug, page) {
  const storefronts = loadStorefronts();
  if (storefronts.length === 0) {
    console.log(JSON.stringify({
      error: 'Could not parse any storefronts from src/data/ecommerce/storefronts.ts — ' +
             'the file may have moved or its format changed.',
    }));
    process.exit(1);
  }
  const match = storefronts.find((s) => slugify(s.name) === slug);
  if (!match) {
    console.log(JSON.stringify({
      error: `Unknown --storefront "${slug}"`,
      available: storefronts.map((s) => slugify(s.name)),
    }));
    process.exit(1);
  }
  if (page !== 'pdp' && page !== 'home' && page !== 'default') {
    console.log(JSON.stringify({ error: `Unknown --page "${page}". Valid values: pdp, home, default` }));
    process.exit(1);
  }
  if (page === 'pdp') {
    if (!match.pdpPath) {
      console.log(JSON.stringify({ error: `"${slug}" has no pdpPath configured in storefronts.ts; --page pdp is unavailable for it` }));
      process.exit(1);
    }
    return match.url.replace(/\/$/, '') + match.pdpPath;
  }
  return match.url;
}

const url = storefrontSlug
  ? resolveStorefrontUrl(storefrontSlug, pageKey)
  : (explicitUrl ?? loadEnvUrl(envName));

if (!url) {
  console.log(JSON.stringify({
    error: `No URL. Pass --url <url>, --storefront <slug>, or ensure FRONT_SITE_URL is set in .env.${envName}`,
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
    const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    const status = response?.status();
    if (status && status >= 400) {
      console.log(JSON.stringify({
        error: `HTTP ${status} for ${url} — candidates from this page would not be trustworthy.`,
        url,
      }));
      process.exit(1);
    }

    // Vans AU/NZ serve a Bloomreach acquisition popup that injects its own buttons/links
    // (which can win .first() and inflate count) and may aria-hide the app root. No-op,
    // and reported below, on every storefront that doesn't have this popup.
    const popupDismissed = await page.locator('#popup-close')
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);

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

    console.log(JSON.stringify({ url, query: description, popupDismissed, candidates: top }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
