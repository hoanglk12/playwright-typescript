#!/usr/bin/env node
/**
 * scripts/council/dispatch.mjs
 *
 * Dev-time, opt-in generic dispatcher backing /council-review: fans one
 * grounded question (plus explicit --context files) out to a fixed 2-model
 * panel in parallel, one round, no ranking, no chairman — the human
 * compares the independent responses. See CLAUDE.md "LLM Council" section
 * and docs/technical-research/ai-council-dispatch.research.md for the
 * design this implements and what it deliberately does not do.
 *
 * Always invoked via the /council-review slash command, never with the
 * question typed inline — see .claude/commands/council-review.md for why
 * (question text must never be interpolated into a shell string).
 *
 * Usage:
 *   node scripts/council/dispatch.mjs --question-file=<path> --dry-run
 *   node scripts/council/dispatch.mjs --question-file=<path> --context=<path> --yes
 *
 * Flags:
 *   --question-file=<path>   (required) question/instruction text, read as-is
 *   --context=<path>         (repeatable) attach a file as context
 *   --tier=<name>             accepted, currently a no-op — v1 ships exactly
 *                             one panel (see tiers.mjs); kept so the flag is
 *                             forward-compatible if a second tier ships later
 *   --dry-run                 manifest + estimate only, no chat calls
 *   --yes                     required for a real run outside mock mode
 *   --max-cost=<usd>          default 0.25 — informational only, NOT enforced
 *                             by design (see tiers.mjs pricing + the printed
 *                             warning); the --yes consent step is the real
 *                             cost backstop
 *   --max-tokens=<n>          default 1200 — per-response cap; overridden
 *                             per-model for kimi-k3 (see tiers.mjs
 *                             MODEL_MAX_TOKENS_OVERRIDE) unless this flag is
 *                             passed explicitly, in which case it wins for
 *                             every model
 *   --timeout=<ms>            default 120000 — per-call timeout
 *   --out-dir=<path>          default ./council-output
 *
 * Env:
 *   COUNCIL_BASE_URL                    default https://direct.shopaikey.com/v1
 *   OPENROUTER_API_KEY                  shell env or gitignored .env.local — never .env.{NODE_ENV}
 *   COUNCIL_MOCK=1                       zero-cost mock mode, no network calls
 *   COUNCIL_MOCK_FAIL=slug,slug          simulate a per-model non-fatal failure (mock only)
 *   COUNCIL_MOCK_FATAL_AUTH=1            simulate a 401/402 that aborts the whole run (mock only)
 *
 * Exit codes: 0 success (including partial per-model failure), 1 fatal
 * error / aborted run, 2 consent required (dry-run, or missing --yes
 * outside mock mode).
 */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { scrub, buildManifest, assertNoApiKeyInPayload } from './scrub.mjs';
import { resolveApiKey, chat, withRetry, FatalAuthError, maskKey, API_BASE_URL, isMock } from './client.mjs';
import { DEFAULT_PANEL, assertPinnedSlug, MODEL_MAX_TOKENS_OVERRIDE } from './tiers.mjs';
import { writeTranscript, writeRunJson, ts } from './output.mjs';

/** Rough pre-call estimate: chars/4 for prompt tokens (no tokenizer
 * dependency), the per-model max_tokens as the completion-side figure.
 * This is a ceiling for models that honor max_tokens exactly (confirmed for
 * kimi-k3) but a floor for gpt-5.6-sol — a real run returned 3289
 * completion tokens against a 1200 cap (2026-08-02), suggesting its SSE
 * path does not enforce max_tokens. Never presented as a billed cost. */
export function estimateCallCostUsd(promptChars, maxTokens, pricing) {
  if (!pricing) return 0;
  const promptTokens = Math.ceil(promptChars / 4);
  return (promptTokens / 1_000_000) * pricing.input + (maxTokens / 1_000_000) * pricing.completion;
}

/** Actual cost from a completed call's real usage — still an estimate in
 * the sense that the provider never returns a billed `usage.cost`, but it
 * uses the real token counts instead of the chars/4 approximation. */
export function actualCallCostUsd(usage, pricing) {
  if (!pricing || !usage) return 0;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.completion;
}

export function maxTokensForModel(slug, explicitMaxTokens, defaultMaxTokens) {
  if (explicitMaxTokens) return defaultMaxTokens;
  return MODEL_MAX_TOKENS_OVERRIDE[slug] ?? defaultMaxTokens;
}

function parseArgs(argv) {
  const flags = { context: [] };
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      flags[arg.slice(2)] = true;
      continue;
    }
    const key = arg.slice(2, eq);
    const val = arg.slice(eq + 1);
    if (key === 'context') flags.context.push(val);
    else flags[key] = val;
  }
  return flags;
}

function parseNumericFlag(flags, name, fallback) {
  if (flags[name] === undefined) return fallback;
  if (flags[name] === true) {
    console.error(`❌ --${name} requires a value (e.g. --${name}=100) — got a bare flag with no "=value".`);
    return null;
  }
  const n = Number(flags[name]);
  if (!Number.isFinite(n)) {
    console.error(`❌ --${name} must be a finite number, got "${flags[name]}".`);
    return null;
  }
  return n;
}

/**
 * Strict boolean-flag reader — a bare --flag is true, a value-bearing
 * --flag=value is rejected rather than coerced (so --yes=false can't be
 * mistaken for consent).
 */
function asBool(flags, name) {
  const v = flags[name];
  if (v === undefined) return false;
  if (v === true) return true;
  throw new Error(`--${name} is a boolean flag and takes no value (got "--${name}=${v}"). Use bare --${name} or omit it.`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (!flags['question-file']) {
    console.error('❌ --question-file=<path> is required. Never pass question text as a positional/shell argument.');
    process.exitCode = 1;
    return;
  }

  const dryRun = asBool(flags, 'dry-run');
  const skipConsent = asBool(flags, 'yes');
  const outDir = flags['out-dir'] ?? './council-output';

  const maxCostUsd = parseNumericFlag(flags, 'max-cost', 0.25);
  const timeoutMs = parseNumericFlag(flags, 'timeout', 120000);
  const maxTokens = parseNumericFlag(flags, 'max-tokens', 1200);
  if (maxCostUsd === null || timeoutMs === null || maxTokens === null) {
    process.exitCode = 1;
    return;
  }
  const explicitMaxTokens = flags['max-tokens'] !== undefined;

  for (const model of DEFAULT_PANEL) assertPinnedSlug(model.slug);

  // ── question + context — scrub happens before the payload is ever built ──
  const rawQuestion = readFileSync(flags['question-file'], 'utf8');
  const questionScrub = scrub(rawQuestion);
  const question = {
    sourceLabel: `question-file:${flags['question-file']}`,
    bytes: Buffer.byteLength(rawQuestion, 'utf8'),
    hits: questionScrub.hits,
    scrubbedText: questionScrub.text,
  };

  const contextFiles = flags.context.map(p => {
    const raw = readFileSync(p, 'utf8');
    const s = scrub(raw);
    return { path: p, bytes: Buffer.byteLength(raw, 'utf8'), hits: s.hits, scrubbedText: s.text };
  });

  let framedQuestion = question.scrubbedText;
  if (contextFiles.length) {
    framedQuestion += '\n\nContext:\n';
    for (const f of contextFiles) {
      framedQuestion += `\n--- ${f.path} ---\n${f.scrubbedText}\n`;
    }
  }
  const messages = [{ role: 'user', content: framedQuestion }];

  // ── key resolution + hard key-leak check — runs even under --dry-run, before any network call ──
  const apiKey = await resolveApiKey({ dryRun });
  for (const model of DEFAULT_PANEL) {
    assertNoApiKeyInPayload(JSON.stringify({ model: model.slug, messages }), apiKey);
  }

  // ── manifest ───────────────────────────────────────────────────────────
  // Per-model max_tokens: an explicit --max-tokens always wins; otherwise
  // kimi-k3 gets its reasoning-budget override (see tiers.mjs). The estimate
  // below uses these same per-model values, so it reflects what will
  // actually be sent, not the flag's raw default.
  const perModelMaxTokens = new Map(
    DEFAULT_PANEL.map(model => [model.slug, maxTokensForModel(model.slug, explicitMaxTokens, maxTokens)])
  );
  const estimatedCostUsd = DEFAULT_PANEL.reduce(
    (sum, model) =>
      sum + estimateCallCostUsd(framedQuestion.length, perModelMaxTokens.get(model.slug), model.pricingPerMillionUsd),
    0
  );

  const manifest = buildManifest({
    question: { ...question, framedText: framedQuestion },
    contextFiles,
    models: DEFAULT_PANEL,
    estimate: { totalCostUsd: estimatedCostUsd },
    showFull: dryRun,
  });
  console.log(manifest.printable);

  if (dryRun) {
    console.log('--dry-run: stopping here. No chat calls were made.');
    process.exitCode = 2;
    return;
  }

  console.warn(
    `⚠️  --max-cost=${maxCostUsd} is informational only and is NOT enforced, by design — the consent step ` +
      '(this manifest + --yes) is the actual cost backstop. The estimate above is a chars/4-token approximation, ' +
      'a ceiling for models that honor max_tokens exactly and a floor for any that don\'t (gpt-5.6-sol has been ' +
      'observed exceeding its cap) — never a billed figure, since this provider does not return one.'
  );

  // ── consent gate ───────────────────────────────────────────────────────
  if (!skipConsent) {
    if (isMock()) {
      console.log('[MOCK] Skipping the consent gate — mock mode makes no network calls, nothing leaves this machine.');
    } else {
      console.log('No --yes given. Review the manifest above, then re-run the identical command with --yes to proceed.');
      process.exitCode = 2;
      return;
    }
  }

  console.log(`Using API key ${maskKey(apiKey)} at ${API_BASE_URL}`);

  // ── dispatch — flat fan-out, one round, no ranking, no chairman ────────
  // A shared AbortController means a 401/402 on one model cancels the other
  // in-flight requests immediately, instead of letting them run to
  // completion (and bill) while their results get discarded afterwards.
  const abortController = new AbortController();
  const startedAt = new Date().toISOString();
  const settled = await Promise.allSettled(
    DEFAULT_PANEL.map(async model => {
      try {
        const result = await withRetry(() =>
          chat({
            apiKey,
            model: model.slug,
            messages,
            maxTokens: perModelMaxTokens.get(model.slug),
            timeoutMs,
            signal: abortController.signal,
          })
        );
        return { slug: model.slug, family: model.family, status: 'ok', text: result.text, usage: result.usage, latencyMs: result.latencyMs };
      } catch (err) {
        if (err instanceof FatalAuthError) abortController.abort(err);
        // err.usage is only set for EMPTY_CONTENT — it's the wasted spend on
        // a prompt (and any reasoning tokens) that was billed for nothing.
        return {
          slug: model.slug,
          family: model.family,
          status: 'failed',
          error: err.message,
          fatal: err instanceof FatalAuthError,
          wastedUsage: err.usage ?? null,
        };
      }
    })
  );

  const results = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { slug: DEFAULT_PANEL[i].slug, family: DEFAULT_PANEL[i].family, status: 'failed', error: r.reason?.message ?? 'unknown error' }
  );

  const fatalResults = results.filter(r => r.fatal);
  if (fatalResults.length) {
    const completed = results.filter(r => r.status === 'ok').map(r => r.slug);
    console.error(
      `❌ Fatal auth error (401/402) from: ${fatalResults.map(r => r.slug).join(', ')}. Aborting the run — no output written.`
    );
    if (completed.length) {
      console.error(
        `   ⚠️  ${completed.join(', ')} completed before the abort and were billed; their responses are discarded, not written.`
      );
    }
    console.error('   Check OPENROUTER_API_KEY / account credits before retrying.');
    process.exitCode = 1;
    return;
  }

  // Real cost from actual usage where available (successful calls' own
  // usage, plus wasted spend attached to EMPTY_CONTENT failures) — the
  // provider never returns a billed `usage.cost`, so this is still our own
  // computation against static pricing, just from real token counts instead
  // of the chars/4 pre-call approximation. Failures with no usage attached
  // (network errors, HTTP errors before a body was billed) contribute $0 and
  // are undercounted, not zero-cost — see the per-result note in the run JSON.
  const pricingBySlug = new Map(DEFAULT_PANEL.map(m => [m.slug, m.pricingPerMillionUsd]));
  let actualCostUsd = 0;
  for (const r of results) {
    const pricing = pricingBySlug.get(r.slug);
    if (r.status === 'ok') actualCostUsd += actualCallCostUsd(r.usage, pricing);
    else if (r.wastedUsage) actualCostUsd += actualCallCostUsd(r.wastedUsage, pricing);
  }

  const run = {
    question,
    contextFiles,
    framedQuestion,
    models: DEFAULT_PANEL,
    results,
    failures: results.filter(r => r.status === 'failed').map(r => ({ slug: r.slug, message: r.error, wastedUsage: r.wastedUsage ?? null })),
    estimatedCostUsd,
    actualCostUsd,
    startedAt,
    endedAt: new Date().toISOString(),
    exitCode: 0,
  };

  const runTs = ts();
  const transcriptPath = writeTranscript(run, outDir, runTs);
  const jsonPath = writeRunJson(run, outDir, runTs);

  console.log('');
  console.log('─────────────────────────────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.slug.padEnd(20)} ${r.status.padEnd(8)} ${r.latencyMs ?? '-'}ms${r.status === 'failed' ? `  (${r.error})` : ''}`);
  }
  console.log(
    `Cost: ~$${actualCostUsd.toFixed(4)} (computed from real usage × static shopaikey.com/models pricing, ` +
      'not a provider-billed figure — this endpoint never returns one; failed calls with no usage attached ' +
      'are undercounted, not free)'
  );
  console.log(`Transcript: ${transcriptPath}`);
  console.log(`Run JSON:   ${jsonPath}`);

  process.exitCode = 0;
}

// Only auto-run when executed directly (`node dispatch.mjs ...`) — guarded so
// a sanity-check script can import the pure helpers above (estimateCallCostUsd,
// actualCallCostUsd, maxTokensForModel) without triggering a real CLI run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('❌', err.message);
    process.exitCode = 1;
  });
}
