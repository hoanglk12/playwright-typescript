#!/usr/bin/env node
/**
 * scripts/council/sanity-check.mjs
 *
 * Manual, zero-cost regression check for the kimi-k3 empty-content fix and
 * the static pricing wiring (2026-08-02). Not part of `npm test` / CI, same
 * as the rest of scripts/council/ — see CLAUDE.md "LLM Council" section
 * ("Never in CI, never in the test suite"). Run by hand after touching
 * client.mjs, tiers.mjs, or dispatch.mjs:
 *
 *   node scripts/council/sanity-check.mjs
 *
 * Stubs global.fetch with canned response bodies shaped exactly like the
 * live reproductions captured on 2026-08-02 — no network call, no cost.
 * `npm run council:mock` (COUNCIL_MOCK=1) is a different, complementary
 * check: it exercises dispatch.mjs's control flow end-to-end but never
 * touches chat()'s real-response parsing, because mock mode short-circuits
 * before it. This script targets exactly the parsing/retry logic mock mode
 * skips.
 */
import assert from 'assert';
import { chat, withRetry, OpenRouterError, RETRYABLE_STATUSES } from './client.mjs';
import { KIMI_K3, GPT_SOL_5_6, MODEL_MAX_TOKENS_OVERRIDE, PRICING_PER_MILLION_TOKENS_USD, DEFAULT_PANEL } from './tiers.mjs';
import { estimateCallCostUsd, actualCallCostUsd, maxTokensForModel } from './dispatch.mjs';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

/** Builds a fake fetch() Response for chat()'s res.ok / res.headers.get() /
 * res.text() usage, matching the live reproduction's raw JSON shape. */
function fakeJsonResponse(status, bodyObj) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(bodyObj),
  };
}

// Captured verbatim from the live 2026-08-02 reproduction against the real
// login-page.ts review prompt: max_tokens=1200, 1197 spent on reasoning.
const BUDGET_EXHAUSTED_BODY = {
  id: 'chatcmpl-fixture',
  choices: [
    {
      index: 0,
      finish_reason: 'length',
      message: { role: 'assistant', content: '', reasoning_content: 'x'.repeat(5496) },
    },
  ],
  usage: { prompt_tokens: 3804, completion_tokens: 1200, completion_tokens_details: { reasoning_tokens: 1197 } },
};

// A different empty-content shape: no reasoning_content, finish_reason
// "stop" — the "provider returned nothing" case, not budget exhaustion.
const TRANSIENT_EMPTY_BODY = {
  id: 'chatcmpl-fixture-2',
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
  usage: { prompt_tokens: 50, completion_tokens: 0 },
};

async function withStubbedFetch(response, fn) {
  const original = global.fetch;
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    return typeof response === 'function' ? response(callCount) : response;
  };
  try {
    await fn(() => callCount);
  } finally {
    global.fetch = original;
  }
}

async function main() {
  console.log('Council fix sanity check\n');

  console.log('client.mjs — EMPTY_CONTENT classification');
  await check('reasoning-budget exhaustion is detected and marked non-retryable', async () => {
    await withStubbedFetch(fakeJsonResponse(200, BUDGET_EXHAUSTED_BODY), async () => {
      await assert.rejects(
        chat({ apiKey: 'test-key', model: KIMI_K3, messages: [{ role: 'user', content: 'x' }], maxTokens: 1200 }),
        err => {
          assert.ok(err instanceof OpenRouterError, 'should throw OpenRouterError');
          assert.strictEqual(err.status, 'EMPTY_CONTENT');
          assert.strictEqual(err.retryable, false, 'budget-exhausted EMPTY_CONTENT must be non-retryable');
          assert.match(err.message, /reasoning-budget exhausted/);
          assert.strictEqual(err.usage?.completion_tokens, 1200, 'wasted usage must be attached to the error');
          return true;
        }
      );
    });
  });

  await check('a transient empty completion (no reasoning_content) stays retryable', async () => {
    await withStubbedFetch(fakeJsonResponse(200, TRANSIENT_EMPTY_BODY), async () => {
      await assert.rejects(
        chat({ apiKey: 'test-key', model: GPT_SOL_5_6, messages: [{ role: 'user', content: 'x' }], maxTokens: 1200 }),
        err => {
          assert.strictEqual(err.status, 'EMPTY_CONTENT');
          assert.notStrictEqual(err.retryable, false, 'non-budget-exhaustion EMPTY_CONTENT must stay retryable');
          assert.match(err.message, /transient provider fault/);
          return true;
        }
      );
    });
  });

  console.log('\nclient.mjs — withRetry honors err.retryable');
  await check('budget-exhausted failure is attempted exactly once (no wasted retries)', async () => {
    await withStubbedFetch(fakeJsonResponse(200, BUDGET_EXHAUSTED_BODY), async getCallCount => {
      await assert.rejects(
        withRetry(() => chat({ apiKey: 'test-key', model: KIMI_K3, messages: [{ role: 'user', content: 'x' }], maxTokens: 1200 }), {
          retries: 2,
          baseDelayMs: 1,
        })
      );
      assert.strictEqual(getCallCount(), 1, `expected exactly 1 fetch call, got ${getCallCount()}`);
    });
  });

  await check('a transient failure retries up to the configured limit', async () => {
    await withStubbedFetch(fakeJsonResponse(200, TRANSIENT_EMPTY_BODY), async getCallCount => {
      await assert.rejects(
        withRetry(
          () => chat({ apiKey: 'test-key', model: GPT_SOL_5_6, messages: [{ role: 'user', content: 'x' }], maxTokens: 1200 }),
          { retries: 2, baseDelayMs: 1 }
        )
      );
      assert.strictEqual(getCallCount(), 3, `expected 3 attempts (1 + 2 retries), got ${getCallCount()}`);
    });
  });

  await check('HTTP 529 (confirmed live as ShopAIKey overload) is retryable', () => {
    assert.ok(RETRYABLE_STATUSES.has(529), '529 must be in RETRYABLE_STATUSES');
  });

  console.log('\ntiers.mjs — pricing and per-model max_tokens override');
  await check('kimi-k3 has a raised max_tokens override', () => {
    assert.strictEqual(MODEL_MAX_TOKENS_OVERRIDE[KIMI_K3], 8000);
  });
  await check('both panel models have numeric per-million pricing', () => {
    for (const slug of [KIMI_K3, GPT_SOL_5_6]) {
      const p = PRICING_PER_MILLION_TOKENS_USD[slug];
      assert.ok(p, `${slug} must have a pricing entry`);
      assert.strictEqual(typeof p.input, 'number');
      assert.strictEqual(typeof p.completion, 'number');
    }
  });
  await check('DEFAULT_PANEL exposes pricingPerMillionUsd (not the old null "pricing" field)', () => {
    for (const model of DEFAULT_PANEL) {
      assert.ok(model.pricingPerMillionUsd, `${model.slug} must carry pricingPerMillionUsd`);
      assert.strictEqual(model.pricing, undefined, 'the old pricing:null field must not reappear');
    }
  });

  console.log('\ndispatch.mjs — cost estimate and per-model max_tokens selection');
  await check('an explicit --max-tokens overrides the per-model default for every model', () => {
    assert.strictEqual(maxTokensForModel(KIMI_K3, true, 1200), 1200);
    assert.strictEqual(maxTokensForModel(GPT_SOL_5_6, true, 1200), 1200);
  });
  await check('without an explicit flag, kimi-k3 gets its override and gpt-5.6-sol gets the default', () => {
    assert.strictEqual(maxTokensForModel(KIMI_K3, false, 1200), 8000);
    assert.strictEqual(maxTokensForModel(GPT_SOL_5_6, false, 1200), 1200);
  });
  await check('estimateCallCostUsd matches hand-computed arithmetic', () => {
    // 4000 chars -> 1000 prompt tokens; kimi-k3 pricing $20/$100 per 1M.
    const cost = estimateCallCostUsd(4000, 8000, PRICING_PER_MILLION_TOKENS_USD[KIMI_K3]);
    const expected = (1000 / 1_000_000) * 20 + (8000 / 1_000_000) * 100;
    assert.ok(Math.abs(cost - expected) < 1e-9, `expected ${expected}, got ${cost}`);
  });
  await check('actualCallCostUsd uses real usage tokens, not the chars/4 approximation', () => {
    const cost = actualCallCostUsd({ prompt_tokens: 3804, completion_tokens: 1200 }, PRICING_PER_MILLION_TOKENS_USD[KIMI_K3]);
    const expected = (3804 / 1_000_000) * 20 + (1200 / 1_000_000) * 100;
    assert.ok(Math.abs(cost - expected) < 1e-9, `expected ${expected}, got ${cost}`);
  });
  await check('actualCallCostUsd is 0 for a failure with no usage attached (not silently NaN)', () => {
    assert.strictEqual(actualCallCostUsd(null, PRICING_PER_MILLION_TOKENS_USD[KIMI_K3]), 0);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

main();
