/**
 * scripts/council/openrouter.mjs
 *
 * HTTP layer for the OpenRouter API. Raw fetch, no SDK — this is a
 * zero-new-dependency tool (see CLAUDE.md "LLM Council" section).
 *
 * Mock mode: when process.env.COUNCIL_MOCK === '1', every function here
 * returns deterministic canned data and makes NO network request. This is
 * what npm run council:mock exercises, and what CI/validation must use —
 * never a real chat-completions call outside a one-time manual smoke test.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { PANELS } from './panels.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.join(__dir, '..', '..');

/** OpenAI-compatible base URL. Changed from OpenRouter to ShopAIKey per user request. */
export const API_BASE_URL = 'https://direct.shopaikey.com/v1';

export class OpenRouterError extends Error {
  constructor(message, { status, retryAfterMs, cause } = {}) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.retryAfterMs = retryAfterMs ?? null;
    if (cause) this.cause = cause;
  }
}

/** Thrown on 401/402 — caller must abort the whole run, not retry per-model. */
export class FatalAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FatalAuthError';
  }
}

function isMock() {
  return process.env.COUNCIL_MOCK === '1';
}

/** ...<last4> for diagnostic printing. Never print/persist the full key. */
export function maskKey(key) {
  if (!key) return '(none)';
  return `...${key.slice(-4)}`;
}

/**
 * Resolves OPENROUTER_API_KEY from process.env, falling back to a local,
 * gitignored .env.local (never .env.testing/.env.staging/.env.production).
 * In mock mode, returns a placeholder without touching the filesystem.
 */
export async function resolveApiKey({ dryRun = false } = {}) {
  if (isMock()) {
    return 'mock-key-0000000000000000000000000000000000';
  }

  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), quiet: true, override: false });
  } catch {
    // .env.local is optional — no dotenv config found is not an error.
  }

  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  console.error('❌ OPENROUTER_API_KEY is not set.');
  console.error('   1. Get a key for https://direct.shopaikey.com/v1');
  console.error('   2. Set it in your shell env, or in a local .env.local (gitignored):');
  console.error('        OPENROUTER_API_KEY=...');
  console.error('   ⚠️  Do NOT put this in .env.testing / .env.staging / .env.production —');
  console.error('      those are the Playwright test-suite env files, this tool is unrelated to them.');

  if (dryRun) {
    console.warn('⚠️  --dry-run: continuing with a placeholder key so the manifest can still print.');
    return 'placeholder-dry-run-key-0000000000000000000000';
  }
  process.exit(1);
}

function allPanelSlugs() {
  const slugs = new Set();
  for (const panel of Object.values(PANELS)) {
    panel.models.forEach(m => slugs.add(m));
    slugs.add(panel.chairman);
  }
  return slugs;
}

/** Used only under COUNCIL_MOCK=1 — fake pricing is fine, it's a mock run. */
function buildMockCatalog() {
  const map = new Map();
  for (const slug of allPanelSlugs()) {
    map.set(slug, {
      pricing: { prompt: '0.0000005', completion: '0.0000015' },
      context_length: 128000,
      expiration_date: null,
    });
  }
  return map;
}

/**
 * Used as a real-run fallback when the provider has no /models endpoint.
 * pricing is deliberately null, not a guess — the cost estimator must show
 * "unknown" rather than a fabricated dollar figure gated behind --max-cost.
 */
function buildUnknownPricingCatalog() {
  const map = new Map();
  for (const slug of allPanelSlugs()) {
    map.set(slug, { pricing: null, context_length: null, expiration_date: null });
  }
  return map;
}

/**
 * GET /models — catalog endpoint. Not confirmed to exist on the current
 * provider (it's an OpenRouter-specific convenience, not core OpenAI spec),
 * so this fails soft: on any error, fall back to the static PANELS list
 * instead of crashing the run.
 */
export async function fetchModelCatalog({ timeoutMs = 30000 } = {}) {
  if (isMock()) {
    return buildMockCatalog();
  }

  try {
    const res = await fetch(`${API_BASE_URL}/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const map = new Map();
    for (const entry of body.data ?? []) {
      map.set(entry.id, {
        pricing: entry.pricing ?? null,
        context_length: entry.context_length ?? null,
        expiration_date: entry.expiration_date ?? null,
      });
    }
    return map;
  } catch (err) {
    console.warn(
      `⚠️  Model catalog fetch failed (${err.message}) — this provider likely has no /models ` +
        'endpoint. Falling back to the static panel list with UNKNOWN pricing: cost estimates ' +
        'below are not available, not $0.'
    );
    return buildUnknownPricingCatalog();
  }
}

/**
 * GET /key — remaining credit / usage for the resolved API key. Also not
 * confirmed to exist on the current provider — fails soft with a warning
 * rather than blocking the run, since this is a nice-to-have pre-flight
 * check, not a hard requirement.
 */
export async function fetchKeyStatus(apiKey, { timeoutMs = 30000 } = {}) {
  if (isMock()) {
    return { limit_remaining: 100, usage: 0, is_free_tier: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 402) {
        throw new FatalAuthError(
          `API key check failed (HTTP ${res.status}). Check OPENROUTER_API_KEY and account credits.`
        );
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const body = await res.json();
    const data = body.data ?? body;
    return {
      limit_remaining: data.limit_remaining ?? null,
      usage: data.usage ?? null,
      is_free_tier: data.is_free_tier ?? null,
    };
  } catch (err) {
    if (err instanceof FatalAuthError) throw err;
    console.warn(`⚠️  Key/credit status check failed (${err.message}) — continuing without it.`);
    return { limit_remaining: null, usage: null, is_free_tier: null };
  }
}

function parseRetryAfterMs(headerValue) {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(headerValue);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function hashString(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function shouldMockFail(model) {
  const list = (process.env.COUNCIL_MOCK_FAIL ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return list.includes(model);
}

function extractReviewLetters(messages) {
  const userMessage = messages.find(m => m.role === 'user')?.content ?? '';
  const letters = [...userMessage.matchAll(/\*\*Response ([A-Z]):\*\*/g)].map(m => m[1]);
  return letters;
}

function mockRanking(letters, model) {
  if (!letters.length) return '';
  const seed = hashString(model);
  const shuffled = [...letters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.join(' > ');
}

function mockChat({ model, messages, maxTokens, stage }) {
  if (shouldMockFail(model)) {
    // Non-retryable status so mock-failure validation runs don't burn real
    // backoff sleeps (400 is deterministic per withRetry's classifier).
    throw new OpenRouterError(`[MOCK] Simulated failure for ${model} (COUNCIL_MOCK_FAIL)`, { status: 400 });
  }

  const promptChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  const promptTokens = Math.max(10, Math.round(promptChars / 4));
  const completionTokens = Math.min(maxTokens ?? 300, 120 + Math.round(Math.random() * 80));
  const cost = promptTokens * 0.0000005 + completionTokens * 0.0000015;
  const latencyMs = 50 + Math.floor(Math.random() * 150);

  let text;
  if (stage === 'review') {
    const letters = extractReviewLetters(messages);
    const ranking = mockRanking(letters, model);
    text =
      `[MOCK ${model}] The strongest response makes a concrete, falsifiable claim rather ` +
      "than hedging. The weakest response doesn't commit to a position. All responses " +
      'under-weight rollout/maintenance cost.\n' +
      `RANKING: ${ranking}`;
  } else if (stage === 'synthesis') {
    text =
      `[MOCK ${model}] ## Where the Council Agrees\nThe council converges on validating ` +
      'before committing.\n\n## Where the Council Clashes\nOpinions differ on how much ' +
      'upfront investment is justified.\n\n## Blind Spots the Council Caught\nRollout cost ' +
      'was under-discussed by most advisors.\n\n## The Recommendation\nProceed with a ' +
      'scoped pilot before full commitment.\n\n## The One Thing to Do First\nDefine the ' +
      'pilot success criteria today.';
  } else {
    text =
      `[MOCK ${model}] This is a simulated independent opinion for validation purposes. ` +
      'It takes a clear position, gives one concrete supporting reason, and stays within ' +
      'the requested word budget without hedging.';
  }

  return {
    text,
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, cost },
    model,
    provider: 'mock',
    latencyMs,
  };
}

/**
 * POST /chat/completions. `stage` is 'opinion' | 'review' | 'synthesis' —
 * used only by mock mode to vary canned output plausibly.
 */
export async function chat({
  apiKey,
  model,
  messages,
  maxTokens,
  temperature = 0.7,
  timeoutMs = 120000,
  denyTraining = true,
  zdr = false,
  stage = 'opinion',
}) {
  if (isMock()) {
    return mockChat({ model, messages, maxTokens, stage });
  }

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    provider: {
      allow_fallbacks: true,
      ...(denyTraining && { data_collection: 'deny' }),
      ...(zdr && { zdr: true }),
    },
  };
  const payloadString = JSON.stringify(body);

  const started = Date.now();
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/AccentGroup/playwright-typescript',
        // X-Title is the more commonly documented OpenRouter app-title header;
        // X-OpenRouter-Title shows up as an alternative in some docs — adjust if needed.
        'X-Title': 'Playwright TS Framework - LLM Council (dev tool)',
      },
      body: payloadString,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new OpenRouterError(`Network error calling ${model}: ${err.message}`, {
      status: 'NETWORK',
      cause: err,
    });
  }
  const latencyMs = Date.now() - started;

  const rawText = await res.text();
  let json = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // Non-JSON body handled below via res.ok / json checks.
  }

  if (!res.ok) {
    const errBody = json?.error;
    if (res.status === 401 || res.status === 402) {
      throw new FatalAuthError(
        `OpenRouter ${res.status} for ${model}: ${errBody?.message ?? rawText.slice(0, 200)}`
      );
    }
    throw new OpenRouterError(
      `OpenRouter HTTP ${res.status} for ${model}: ${errBody?.message ?? rawText.slice(0, 200)}`,
      { status: res.status, retryAfterMs: parseRetryAfterMs(res.headers.get('retry-after')) }
    );
  }

  // Documented OpenRouter quirk: some errors come back as HTTP 200 with a populated `error` field.
  if (json?.error) {
    throw new OpenRouterError(
      `OpenRouter returned 200 with an error body for ${model}: ${json.error.message ?? JSON.stringify(json.error)}`,
      { status: 'ERROR_BODY_200' }
    );
  }

  const text = json?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    throw new OpenRouterError(
      `Empty completion content from ${model} (prompt cost was still incurred)`,
      { status: 'EMPTY_CONTENT' }
    );
  }

  const usage = json?.usage ?? {};
  return {
    text,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      cost: usage.cost ?? 0,
    },
    model,
    provider: json?.provider ?? null,
    latencyMs,
  };
}

const RETRYABLE_STATUSES = new Set(['NETWORK', 'EMPTY_CONTENT', 408, 429, 500, 502, 503]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter. Retries only network errors, 408/429/
 * 500/502/503, and empty-completion responses. 400/403 are deterministic
 * failures and are not retried. FatalAuthError (401/402) always aborts
 * immediately — never retried, never swallowed.
 */
export async function withRetry(fn, { retries = 2, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof FatalAuthError) throw err;
      if (!RETRYABLE_STATUSES.has(err?.status)) throw err;

      lastErr = err;
      if (attempt === retries) throw err;

      const delay = err.retryAfterMs ?? baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await sleep(delay);
    }
  }
  throw lastErr;
}
