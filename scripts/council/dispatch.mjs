#!/usr/bin/env node
/**
 * scripts/council/dispatch.mjs
 *
 * Dev-time, opt-in generic dispatcher backing /council-review: fans one
 * grounded question (plus explicit --context files) out to a fixed 3-model
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
 *   --max-cost=<usd>          default 0.25 — unenforceable while pricing is
 *                             UNKNOWN (see tiers.mjs); a warning is printed
 *   --max-tokens=<n>          default 1200 — per-response cap
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
import { scrub, buildManifest, assertNoApiKeyInPayload } from './scrub.mjs';
import { resolveApiKey, chat, withRetry, FatalAuthError, maskKey, API_BASE_URL, isMock } from './client.mjs';
import { DEFAULT_PANEL, assertPinnedSlug } from './tiers.mjs';
import { writeTranscript, writeRunJson, ts } from './output.mjs';

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
  const manifest = buildManifest({
    question: { ...question, framedText: framedQuestion },
    contextFiles,
    models: DEFAULT_PANEL,
    estimate: { totalCostUsd: null },
    showFull: dryRun,
  });
  console.log(manifest.printable);

  if (dryRun) {
    console.log('--dry-run: stopping here. No chat calls were made.');
    process.exitCode = 2;
    return;
  }

  console.warn(
    `⚠️  Cost estimate is UNKNOWN on ${API_BASE_URL} — --max-cost=${maxCostUsd} cannot be enforced. ` +
      'The consent step below is your only cost backstop.'
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
          chat({ apiKey, model: model.slug, messages, maxTokens, timeoutMs, signal: abortController.signal })
        );
        return { slug: model.slug, family: model.family, status: 'ok', text: result.text, usage: result.usage, latencyMs: result.latencyMs };
      } catch (err) {
        if (err instanceof FatalAuthError) abortController.abort(err);
        return { slug: model.slug, family: model.family, status: 'failed', error: err.message, fatal: err instanceof FatalAuthError };
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

  const run = {
    question,
    contextFiles,
    framedQuestion,
    models: DEFAULT_PANEL,
    results,
    failures: results.filter(r => r.status === 'failed').map(r => ({ slug: r.slug, message: r.error })),
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
  console.log('Cost: UNKNOWN (this endpoint has no confirmed pricing catalog)');
  console.log(`Transcript: ${transcriptPath}`);
  console.log(`Run JSON:   ${jsonPath}`);

  process.exitCode = 0;
}

main().catch(err => {
  console.error('❌', err.message);
  process.exitCode = 1;
});
