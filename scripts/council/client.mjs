/**
 * scripts/council/client.mjs
 *
 * HTTP layer for the council dispatcher. Raw fetch, no SDK — zero new
 * package.json dependencies (CLAUDE.md "LLM Council" section).
 *
 * Endpoint is https://direct.shopaikey.com/v1 by default (COUNCIL_BASE_URL
 * overrides it), not OpenRouter — see docs/technical-research/
 * ai-council-dispatch.research.md §8.6 / §10 Phase 0. This means /models
 * and /key are NOT confirmed to exist on this provider; both fail soft to
 * "UNKNOWN" rather than erroring or fabricating a $0 estimate.
 *
 * Mock mode: when process.env.COUNCIL_MOCK === '1', every function here
 * returns deterministic canned data and makes NO network request. This is
 * what npm run council:mock exercises, and what validation must use —
 * never a real chat-completions call outside a one-time manual smoke test.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { assertNoApiKeyInPayload } from './scrub.mjs';
import { MODELS_WITHOUT_TEMPERATURE } from './tiers.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.join(__dir, '..', '..');

export const API_BASE_URL = process.env.COUNCIL_BASE_URL ?? 'https://direct.shopaikey.com/v1';

/** Single source of truth for mock-mode detection — dispatch.mjs's consent
 * gate and this module's network short-circuit must never disagree on what
 * counts as "mock". */
export function isMock() {
  return process.env.COUNCIL_MOCK === '1';
}

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

/** ...<last4> for diagnostic printing. Never print/persist the full key. */
export function maskKey(key) {
  if (!key) return '(none)';
  return `...${key.slice(-4)}`;
}

/**
 * Resolves OPENROUTER_API_KEY from process.env, falling back to a local,
 * gitignored .env.local (never .env.testing/.env.staging/.env.production).
 * Name kept for continuity with the reverted tool this was salvaged from.
 * In mock mode, returns a placeholder without touching the filesystem.
 */
export async function resolveApiKey({ dryRun = false } = {}) {
  if (isMock()) {
    return 'mock-key-0000000000000000000000000000000000';
  }

  if (!process.env.OPENROUTER_API_KEY) {
    try {
      const dotenv = await import('dotenv');
      dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), quiet: true, override: false });
    } catch {
      // .env.local is optional — no dotenv config found is not an error.
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  console.error('❌ OPENROUTER_API_KEY is not set.');
  console.error(`   1. Get a key for ${API_BASE_URL}`);
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

/** Used as a real-run fallback when the provider has no /models endpoint. */
function buildUnknownPricingCatalog(slugs) {
  return new Map(slugs.map(slug => [slug, { pricing: null, context_length: null, expiration_date: null }]));
}

/** Used only under COUNCIL_MOCK=1 — fake pricing is fine, it's a mock run. */
function buildMockCatalog(slugs) {
  return new Map(
    slugs.map(slug => [
      slug,
      {
        pricing: { prompt: '0.0000005', completion: '0.0000015' },
        context_length: 128000,
        expiration_date: null,
      },
    ])
  );
}

/**
 * GET /models — catalog endpoint. Not confirmed to exist on the current
 * provider (it's an OpenRouter-specific convenience, not core OpenAI spec),
 * so this fails soft: on any error, fall back to the passed-in slug list
 * with UNKNOWN pricing instead of crashing the run. `slugs` is the panel
 * being dispatched to (see tiers.mjs) — this module has no panel of its own.
 */
export async function fetchModelCatalog(slugs, { timeoutMs = 30000 } = {}) {
  if (isMock()) {
    return buildMockCatalog(slugs);
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
    return buildUnknownPricingCatalog(slugs);
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

export function parseRetryAfterMs(headerValue) {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(headerValue);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function shouldMockFail(model) {
  const list = (process.env.COUNCIL_MOCK_FAIL ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return list.includes(model);
}

/**
 * COUNCIL_MOCK_FATAL_AUTH=1 simulates a 401/402: applied globally (not
 * per-slug) because a real auth/credit failure is an account-level problem
 * that affects every model behind the same API key, not a single model.
 * Used by validation check 7 (§11) — mock mode has no other way to exercise
 * the run-aborting path.
 */
function mockChat({ model, messages, maxTokens }) {
  if (process.env.COUNCIL_MOCK_FATAL_AUTH === '1') {
    throw new FatalAuthError(`[MOCK] Simulated fatal auth failure for ${model} (COUNCIL_MOCK_FATAL_AUTH=1) — HTTP 401/402.`);
  }
  if (shouldMockFail(model)) {
    // Non-retryable status so mock-failure validation runs don't burn real
    // backoff sleeps (400 is deterministic per withRetry's classifier).
    throw new OpenRouterError(`[MOCK] Simulated failure for ${model} (COUNCIL_MOCK_FAIL)`, { status: 400 });
  }

  const promptChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  const promptTokens = Math.max(10, Math.round(promptChars / 4));
  const completionTokens = Math.min(maxTokens ?? 300, 120 + Math.round(Math.random() * 80));
  const latencyMs = 50 + Math.floor(Math.random() * 150);
  const text =
    `[MOCK ${model}] This is a simulated independent opinion for validation purposes. ` +
    'It takes a clear position, gives one concrete supporting reason, and stays within ' +
    'the requested word budget without hedging.';

  return {
    text,
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, cost: null },
    model,
    latencyMs,
  };
}

/**
 * Reassembles an SSE stream (`data: {...}\n\n` chunks, terminated by a
 * literal `data: [DONE]`) into the same shape as a single-JSON chat-
 * completions body, so callers of chat() don't need to know which path
 * a given model took. Content is `delta.content` (not `message.content`)
 * per the chunk shape; `usage` is taken from whichever chunk actually
 * carries a non-null value, since earlier chunks report `usage: null`.
 */
function parseSseBody(rawText) {
  let content = '';
  let usage = null;
  let error = null;
  for (const line of rawText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') continue;
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      continue;
    }
    if (chunk.error) error = chunk.error;
    content += chunk.choices?.[0]?.delta?.content ?? '';
    if (chunk.usage) usage = chunk.usage;
  }
  return { choices: [{ message: { content } }], usage, error };
}

/**
 * gpt-5.6-sol's proxy streams SSE chunks even for a non-streaming request
 * (no `stream: true` in the payload) — confirmed via curl on 2026-08-02, so
 * the response shape has to be sniffed rather than assumed to be JSON.
 */
function parseChatBody(rawText, contentType) {
  if (rawText.trimStart().startsWith('data:') || contentType.includes('text/event-stream')) {
    return parseSseBody(rawText);
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return null; // an unparseable body is not fatal — the res.ok / json?. checks in chat() handle it
  }
}

/**
 * POST /chat/completions. No OpenRouter-specific body fields (`provider`,
 * `HTTP-Referer`, `X-Title`) — a generic OpenAI-compatible proxy may reject
 * unknown fields, and a 400 from that would look indistinguishable from a
 * bad model slug. Only `model`, `messages`, `max_tokens`, and — for models
 * not in MODELS_WITHOUT_TEMPERATURE — `temperature`.
 */
export async function chat({ apiKey, model, messages, maxTokens, temperature = 0.7, timeoutMs = 120000, signal }) {
  if (isMock()) {
    return mockChat({ model, messages, maxTokens });
  }

  const body = { model, messages, max_tokens: maxTokens };
  if (!MODELS_WITHOUT_TEMPERATURE.has(model)) {
    body.temperature = temperature;
  }
  const payloadString = JSON.stringify(body);
  assertNoApiKeyInPayload(payloadString, apiKey);

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const started = Date.now();
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: payloadString,
      signal: combinedSignal,
    });
  } catch (err) {
    throw new OpenRouterError(`Network error calling ${model}: ${err.message}`, {
      status: 'NETWORK',
      cause: err,
    });
  }
  const latencyMs = Date.now() - started;

  const rawText = await res.text();
  const json = parseChatBody(rawText, res.headers.get('content-type') ?? '');

  if (!res.ok) {
    const detail = json?.error?.message ?? rawText.slice(0, 200);
    const failure = `HTTP ${res.status} for ${model}: ${detail}`;
    if (res.status === 401 || res.status === 402) {
      throw new FatalAuthError(failure);
    }
    throw new OpenRouterError(failure, {
      status: res.status,
      retryAfterMs: parseRetryAfterMs(res.headers.get('retry-after')),
    });
  }

  // Documented OpenRouter quirk, unconfirmed but harmless to keep checking for on any
  // OpenAI-compatible proxy: some errors come back as HTTP 200 with a populated `error` field.
  if (json?.error) {
    throw new OpenRouterError(
      `Provider returned 200 with an error body for ${model}: ${json.error.message ?? JSON.stringify(json.error)}`,
      { status: 'ERROR_BODY_200' }
    );
  }

  const text = json?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    throw new OpenRouterError(`Empty completion content from ${model} (prompt cost was still incurred)`, {
      status: 'EMPTY_CONTENT',
    });
  }

  const usage = json?.usage ?? {};
  return {
    text,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      cost: usage.cost ?? null,
    },
    model,
    latencyMs,
  };
}

export const RETRYABLE_STATUSES = new Set(['NETWORK', 'EMPTY_CONTENT', 408, 429, 500, 502, 503]);

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
