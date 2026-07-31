#!/usr/bin/env node
/**
 * scripts/council/index.mjs
 *
 * Dev-time, opt-in tool that runs Karpathy's "llm-council" pattern
 * (independent opinions → anonymous peer review → chairman synthesis)
 * across genuinely different LLM providers via OpenRouter. Companion to,
 * NOT a replacement for, the free all-Claude .claude/skills/llm-council
 * skill — this one costs real money (see CLAUDE.md "LLM Council" section).
 *
 * Usage:
 *   node scripts/council/index.mjs "Should we adopt contract testing?"
 *   node scripts/council/index.mjs --question-file=question.txt --context=CLAUDE.md
 *   node scripts/council/index.mjs "question" --panel=quality --neutral
 *   node scripts/council/index.mjs "question" --dry-run          # manifest + cost estimate only
 *   node scripts/council/index.mjs "question" --yes               # skip interactive confirmation
 *
 * Flags:
 *   --question-file=<path>   Read the question from a file instead of positional args
 *   --context=<path>         Attach a file as context (repeatable). No automatic scanning.
 *   --panel=default|quality|smoke   Named panel (default: default)
 *   --models=slug,slug,...   Override panel model list (max 6, see HARD_CAPS.MAX_PANEL)
 *   --chairman=<slug>        Override panel chairman
 *   --neutral                Use Karpathy's neutral prompt for all models instead of personas
 *   --dry-run                Print manifest + cost estimate, make no chat calls
 *   --yes                    Skip the interactive "Type SEND" confirmation
 *   --max-cost=<usd>         Abort before spend if estimate exceeds this (default 0.50)
 *   --max-tokens=<n>         Override maxTokens.opinion
 *   --timeout=<ms>           Per-call timeout (default 120000)
 *   --zdr                    Opt-in zero-data-retention routing (off by default)
 *   --allow-training         Disable the default provider.data_collection = deny
 *   --out-dir=<path>         Output directory (default ./council-output)
 *   --show-payload           Print the full scrubbed payload in the manifest
 *
 * Env:
 *   OPENROUTER_API_KEY       Set in shell env or .env.local — never .env.{NODE_ENV}
 *   COUNCIL_MOCK=1           Zero-cost mock mode, no network calls
 *   COUNCIL_MOCK_FAIL=a,b    Comma-separated model slugs to simulate failing (mock mode only)
 *
 * Exit codes: 0 success, 1 fatal error, 2 consent required, 3 insufficient panel.
 */
import { readFileSync } from 'fs';
import { createInterface } from 'node:readline/promises';
import { PANELS, HARD_CAPS, DEFAULT_PERSONA_ASSIGNMENT, personaFor, familyOf, buildOpinionPrompt, buildReviewPrompt, buildSynthesisPrompt, SELF_ID_PATTERNS } from './panels.mjs';
import { scrub, buildManifest, assertNoApiKeyInPayload } from './scrub.mjs';
import { resolveApiKey, fetchModelCatalog, fetchKeyStatus, chat, withRetry, FatalAuthError, maskKey } from './openrouter.mjs';
import { writeHtmlReport, writeTranscript, writeRunJson, parseRanking, ts } from './report.mjs';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── CLI args ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = { context: [] };
  const positional = [];
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
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
  return { flags, positional };
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
 * Strict boolean-flag reader. parseArgs() stores a bare `--flag` as `true`
 * and a value-bearing `--flag=value` as the string `value` — Boolean(value)
 * would coerce `--yes=false` to `true`. Reject the value-bearing form instead
 * of coercing it.
 */
function asBool(flags, name) {
  const v = flags[name];
  if (v === undefined) return false;
  if (v === true) return true;
  throw new Error(`--${name} is a boolean flag and takes no value (got "--${name}=${v}"). Use bare --${name} or omit it.`);
}

// ── helpers ───────────────────────────────────────────────────────────────────
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function nearestMatch(slug, catalogKeys) {
  let best = null;
  let bestDist = Infinity;
  for (const key of catalogKeys) {
    const d = levenshtein(slug, key);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return best;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stripSelfId(text) {
  let result = text;
  for (const { pattern, replacement } of SELF_ID_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Returns { totalUsd, unknownPricingSlugs }. A slug with no pricing entry in
 * the catalog is excluded from totalUsd (not treated as $0) and listed in
 * unknownPricingSlugs — callers must show "unknown", never a bare dollar
 * figure, when that list is non-empty. See CLAUDE.md "LLM Council" section:
 * this provider has no confirmed /models pricing endpoint.
 */
function estimateCost({ framedQuestion, panelModels, chairmanModel, maxTokens, catalog }) {
  const tokensOf = chars => Math.ceil(chars / 4);
  const questionTokens = tokensOf(framedQuestion.length);
  const priceOf = slug => catalog.get(slug)?.pricing ?? null;
  const unknownPricingSlugs = new Set();

  let total = 0;

  for (const slug of panelModels) {
    const pricing = priceOf(slug);
    if (!pricing) {
      unknownPricingSlugs.add(slug);
      continue;
    }
    total += questionTokens * Number(pricing.prompt ?? 0) + maxTokens.opinion * Number(pricing.completion ?? 0);
  }

  const reviewPromptTokens = questionTokens + panelModels.length * maxTokens.opinion;
  for (const slug of panelModels) {
    const pricing = priceOf(slug);
    if (!pricing) {
      unknownPricingSlugs.add(slug);
      continue;
    }
    total += reviewPromptTokens * Number(pricing.prompt ?? 0) + maxTokens.review * Number(pricing.completion ?? 0);
  }

  const synthesisPromptTokens = questionTokens + panelModels.length * (maxTokens.opinion + maxTokens.review);
  const chairPricing = priceOf(chairmanModel);
  if (chairPricing) {
    total += synthesisPromptTokens * Number(chairPricing.prompt ?? 0) + maxTokens.synthesis * Number(chairPricing.completion ?? 0);
  } else {
    unknownPricingSlugs.add(chairmanModel);
  }

  return { totalUsd: total, unknownPricingSlugs: [...unknownPricingSlugs] };
}

function sumCost(entries) {
  return entries.filter(Boolean).reduce((sum, e) => sum + (e.usage?.cost ?? 0), 0);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.panel && !PANELS[flags.panel]) {
    console.error(`❌ Unknown --panel=${flags.panel}. Valid panels: ${Object.keys(PANELS).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const panelName = flags.panel && PANELS[flags.panel] ? flags.panel : 'default';
  const basePanel = PANELS[panelName];

  const modelSlugs = flags.models ? flags.models.split(',').map(s => s.trim()).filter(Boolean) : [...basePanel.models];
  if (modelSlugs.length > HARD_CAPS.MAX_PANEL) {
    console.error(`❌ --models lists ${modelSlugs.length} models, exceeding HARD_CAPS.MAX_PANEL (${HARD_CAPS.MAX_PANEL}).`);
    process.exitCode = 1;
    return;
  }
  const chairmanSlug = flags.chairman ?? basePanel.chairman;

  for (const slug of [...modelSlugs, chairmanSlug]) {
    if (slug.startsWith('~')) {
      console.error(`❌ Model slug "${slug}" starts with "~" — floating "latest" aliases break pinned cost estimates and pinned behavior. Pin an explicit version.`);
      process.exitCode = 1;
      return;
    }
  }

  const neutral = asBool(flags, 'neutral');
  const dryRun = asBool(flags, 'dry-run');
  const skipConfirm = asBool(flags, 'yes');
  const zdr = asBool(flags, 'zdr');
  const denyTraining = !asBool(flags, 'allow-training');
  const outDir = flags['out-dir'] ?? './council-output';
  const showPayload = asBool(flags, 'show-payload');

  const maxCostUsd = parseNumericFlag(flags, 'max-cost', HARD_CAPS.DEFAULT_MAX_COST_USD);
  const timeoutMs = parseNumericFlag(flags, 'timeout', HARD_CAPS.DEFAULT_TIMEOUT_MS);
  const maxTokensOverride = parseNumericFlag(flags, 'max-tokens', undefined);
  if (maxCostUsd === null || timeoutMs === null || maxTokensOverride === null) {
    process.exitCode = 1;
    return;
  }

  const maxTokens = { ...basePanel.maxTokens };
  if (maxTokensOverride !== undefined) maxTokens.opinion = maxTokensOverride;

  // ── question + context ────────────────────────────────────────────────────
  let rawQuestion;
  let sourceLabel;
  if (flags['question-file']) {
    rawQuestion = readFileSync(flags['question-file'], 'utf8');
    sourceLabel = `question-file:${flags['question-file']}`;
  } else if (positional.length) {
    rawQuestion = positional.join(' ');
    sourceLabel = 'positional';
  } else {
    console.error('❌ No question provided. Pass it as a positional argument or --question-file=<path>.');
    process.exitCode = 1;
    return;
  }

  const questionScrub = scrub(rawQuestion);
  const question = {
    sourceLabel,
    bytes: Buffer.byteLength(rawQuestion, 'utf8'),
    hits: questionScrub.hits,
    scrubbedText: questionScrub.text,
  };

  const contextFiles = flags.context.map(p => {
    const raw = readFileSync(p, 'utf8');
    const s = scrub(raw);
    return { path: p, bytes: Buffer.byteLength(raw, 'utf8'), hits: s.hits, scrubbedText: s.text };
  });

  let framedQuestion = `Question:\n${question.scrubbedText}\n`;
  if (contextFiles.length) {
    framedQuestion += '\nContext:\n';
    for (const f of contextFiles) {
      framedQuestion += `\n--- ${f.path} ---\n${f.scrubbedText}\n`;
    }
  }

  // ── catalog + validation ───────────────────────────────────────────────────
  const catalog = await fetchModelCatalog();
  for (const slug of [...modelSlugs, chairmanSlug]) {
    if (!catalog.has(slug)) {
      const suggestion = nearestMatch(slug, [...catalog.keys()]);
      console.error(`❌ Unknown model slug "${slug}" — not in the pinned panel list (no live catalog is available from this provider to verify against).`);
      if (suggestion) console.error(`   Nearest match: ${suggestion}`);
      process.exitCode = 1;
      return;
    }
    const entry = catalog.get(slug);
    if (entry.expiration_date) {
      console.warn(`⚠️  ${slug} has an expiration_date set (${entry.expiration_date}) — it may be retired soon.`);
    }
  }

  const { totalUsd: estimatedCostUsd, unknownPricingSlugs } = estimateCost({
    framedQuestion,
    panelModels: modelSlugs,
    chairmanModel: chairmanSlug,
    maxTokens,
    catalog,
  });
  if (unknownPricingSlugs.length) {
    console.warn(
      `⚠️  No pricing available from this provider for: ${unknownPricingSlugs.join(', ')}. ` +
        `Cost estimate below is INCOMPLETE — --max-cost cannot be fully enforced. ` +
        'You are relying on the consent step, not the cost cap, as your backstop.'
    );
  } else if (estimatedCostUsd > maxCostUsd) {
    console.error(`❌ Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds --max-cost $${maxCostUsd.toFixed(4)}. Aborting before any spend.`);
    process.exitCode = 1;
    return;
  }

  // ── manifest ───────────────────────────────────────────────────────────────
  // DEFAULT_PERSONA_ASSIGNMENT has 5 entries; a custom --models list of 6 (HARD_CAPS.MAX_PANEL)
  // leaves the 6th model with persona=null, i.e. it falls back to the neutral prompt for that
  // one model only. This is deliberate — extend DEFAULT_PERSONA_ASSIGNMENT if a 6th persona is wanted.
  const panelModelsForManifest = modelSlugs.map((slug, i) => ({
    slug,
    family: familyOf(slug),
    persona: neutral ? null : DEFAULT_PERSONA_ASSIGNMENT[i] ?? null,
  }));

  const manifest = buildManifest({
    question: { ...question, framedText: framedQuestion },
    contextFiles,
    panel: { models: panelModelsForManifest },
    chairman: { slug: chairmanSlug, family: familyOf(chairmanSlug) },
    estimate: { totalCostUsd: unknownPricingSlugs.length ? null : estimatedCostUsd },
    policy: { dataCollection: denyTraining ? 'deny' : 'allow', zdr },
    showFull: dryRun || showPayload,
  });
  console.log(manifest.printable);

  if (dryRun) {
    console.log('--dry-run: stopping here. No chat calls were made.');
    process.exitCode = 0;
    return;
  }

  // ── consent gate ───────────────────────────────────────────────────────────
  if (!skipConfirm) {
    if (!process.stdin.isTTY) {
      console.log('Non-interactive session without --yes. Review the manifest above, then re-run with --yes to proceed.');
      process.exitCode = 2;
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type SEND to transmit: ');
    rl.close();
    if (answer.trim() !== 'SEND') {
      console.log('Aborted — confirmation text did not match "SEND".');
      process.exitCode = 2;
      return;
    }
  }

  const apiKey = await resolveApiKey({ dryRun: false });

  let keyStatus;
  try {
    keyStatus = await fetchKeyStatus(apiKey);
  } catch (err) {
    if (err instanceof FatalAuthError) {
      console.error(`❌ ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
  console.log(`API key ${maskKey(apiKey)} — remaining credit: ${keyStatus.limit_remaining ?? 'unknown'}, usage: ${keyStatus.usage ?? 'unknown'}`);

  // ── run state, always flushed to disk from here on (real spend may occur below) ──
  const run = {
    question,
    contextFiles,
    framedQuestion,
    panelName,
    neutral,
    policy: { dataCollection: denyTraining ? 'deny' : 'allow', zdr },
    models: panelModelsForManifest,
    chairman: { slug: chairmanSlug, family: familyOf(chairmanSlug) },
    opinions: [],
    anonymization: [],
    reviews: [],
    chairmanResult: { model: chairmanSlug, status: 'skipped', actingChairman: false, text: '', error: 'Not attempted.' },
    totalCostUsd: 0,
    failures: [],
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: 0,
  };

  let fatalAuth = false;

  try {
    // Stage 1 — independent opinions. Each task catches its own errors so
    // messages/persona are always recorded, success or failure; the outer
    // Promise.allSettled is kept for literal compliance with the design spec
    // even though internal catches mean nothing actually rejects.
    const opinionResults = await Promise.allSettled(
      panelModelsForManifest.map(async m => {
        const persona = m.persona ? personaFor(m.persona) : null;
        const { system, user } = buildOpinionPrompt({ framedQuestion, persona });
        const messages = system ? [{ role: 'system', content: system }, { role: 'user', content: user }] : [{ role: 'user', content: user }];
        try {
          assertNoApiKeyInPayload(JSON.stringify({ model: m.slug, messages }), apiKey);
          const result = await withRetry(
            () => chat({ apiKey, model: m.slug, messages, maxTokens: maxTokens.opinion, timeoutMs, denyTraining, zdr, stage: 'opinion' }),
            { retries: HARD_CAPS.RETRIES }
          );
          return { model: m.slug, persona: m.persona, messages, status: 'ok', text: result.text, usage: result.usage, latencyMs: result.latencyMs };
        } catch (err) {
          return { model: m.slug, persona: m.persona, messages, status: 'failed', error: err.message, fatal: err instanceof FatalAuthError };
        }
      })
    );

    run.opinions = opinionResults.map((r, i) => {
      const value = r.status === 'fulfilled'
        ? r.value
        : { model: panelModelsForManifest[i].slug, persona: panelModelsForManifest[i].persona, status: 'failed', error: r.reason?.message ?? 'unknown error' };
      if (value.status === 'failed') {
        if (value.fatal) fatalAuth = true;
        run.failures.push({ model: value.model, stage: 'opinion', message: value.error });
      }
      return value;
    });

    const successfulOpinions = run.opinions.filter(o => o.status === 'ok');

    if (fatalAuth) {
      run.exitCode = 1;
    } else if (successfulOpinions.length < HARD_CAPS.MIN_PANEL) {
      run.exitCode = 3;
    } else {
      // Anonymize
      const shuffled = shuffle(successfulOpinions);
      const anonymized = shuffled.map((o, i) => ({ letter: LETTERS[i], model: o.model, text: stripSelfId(o.text) }));
      run.anonymization = anonymized.map(a => ({ letter: a.letter, model: a.model }));

      // Stage 2 — anonymous peer review (best effort)
      const reviewResults = await Promise.allSettled(
        successfulOpinions.map(async o => {
          const ownLetter = run.anonymization.find(a => a.model === o.model).letter;
          const { user } = buildReviewPrompt({ framedQuestion, anonymized: anonymized.map(a => ({ letter: a.letter, text: a.text })) });
          const messages = [{ role: 'user', content: user }];
          try {
            assertNoApiKeyInPayload(JSON.stringify({ model: o.model, messages }), apiKey);
            const result = await withRetry(
              () => chat({ apiKey, model: o.model, messages, maxTokens: maxTokens.review, timeoutMs, denyTraining, zdr, stage: 'review' }),
              { retries: HARD_CAPS.RETRIES }
            );
            return { model: o.model, letter: ownLetter, messages, status: 'ok', text: result.text, usage: result.usage, latencyMs: result.latencyMs, ranking: parseRanking(result.text) };
          } catch (err) {
            return { model: o.model, letter: ownLetter, messages, status: 'failed', error: err.message, fatal: err instanceof FatalAuthError };
          }
        })
      );

      run.reviews = reviewResults.map((r, i) => {
        const model = successfulOpinions[i].model;
        const ownLetter = run.anonymization.find(a => a.model === model)?.letter ?? null;
        const value = r.status === 'fulfilled'
          ? r.value
          : { model, letter: ownLetter, status: 'failed', error: r.reason?.message ?? 'unknown error' };
        if (value.status === 'failed') {
          if (value.fatal) fatalAuth = true;
          run.failures.push({ model: value.model, stage: 'review', message: value.error });
        }
        return value;
      });

      // Stage 3 — chairman synthesis, with acting-chairman fallback
      const attributedResponses = successfulOpinions.map(o => ({
        label: o.persona ? `${o.persona} (${o.model})` : o.model,
        text: o.text,
      }));
      const successfulReviews = run.reviews.filter(r => r.status === 'ok');
      const reviewsForChairman = successfulReviews.map(r => ({ label: `${r.model} (reviewed as Response ${r.letter})`, text: r.text }));
      const { user: synthesisUser } = buildSynthesisPrompt({ framedQuestion, attributedResponses, reviews: reviewsForChairman });
      const synthesisMessages = [{ role: 'user', content: synthesisUser }];

      async function callSynthesis(model) {
        assertNoApiKeyInPayload(JSON.stringify({ model, messages: synthesisMessages }), apiKey);
        return withRetry(
          () => chat({ apiKey, model, messages: synthesisMessages, maxTokens: maxTokens.synthesis, timeoutMs, denyTraining, zdr, stage: 'synthesis' }),
          { retries: HARD_CAPS.RETRIES }
        );
      }

      let synthesisErr;
      let chairmanOk = false;
      if (!fatalAuth) {
        for (let attempt = 0; attempt < 2 && !chairmanOk; attempt++) {
          try {
            const result = await callSynthesis(chairmanSlug);
            run.chairmanResult = { model: chairmanSlug, status: 'ok', actingChairman: false, messages: synthesisMessages, text: result.text, usage: result.usage, latencyMs: result.latencyMs };
            chairmanOk = true;
          } catch (err) {
            if (err instanceof FatalAuthError) {
              fatalAuth = true;
              synthesisErr = err;
              break;
            }
            synthesisErr = err;
          }
        }
      }

      if (!chairmanOk && !fatalAuth) {
        const topPickTally = new Map();
        for (const r of successfulReviews) {
          const top = r.ranking?.[0];
          if (top) topPickTally.set(top, (topPickTally.get(top) ?? 0) + 1);
        }
        const bestLetter = [...topPickTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const actingModel = bestLetter
          ? run.anonymization.find(a => a.letter === bestLetter)?.model
          : successfulOpinions[0]?.model;

        if (actingModel) {
          try {
            const result = await callSynthesis(actingModel);
            run.chairmanResult = { model: actingModel, status: 'ok', actingChairman: true, messages: synthesisMessages, text: result.text, usage: result.usage, latencyMs: result.latencyMs };
          } catch (err) {
            run.failures.push({ model: chairmanSlug, stage: 'synthesis', message: synthesisErr.message });
            run.failures.push({ model: actingModel, stage: 'synthesis-fallback', message: err.message });
            run.chairmanResult = { model: chairmanSlug, status: 'failed', actingChairman: false, messages: synthesisMessages, error: `Chairman failed (${synthesisErr.message}); acting chairman ${actingModel} also failed (${err.message})` };
          }
        } else {
          run.failures.push({ model: chairmanSlug, stage: 'synthesis', message: synthesisErr.message });
          run.chairmanResult = { model: chairmanSlug, status: 'failed', actingChairman: false, messages: synthesisMessages, error: synthesisErr.message };
        }
      } else if (fatalAuth) {
        run.chairmanResult = { model: chairmanSlug, status: 'failed', actingChairman: false, messages: synthesisMessages, error: synthesisErr?.message ?? 'Aborted after fatal auth error.' };
      }

      run.exitCode = fatalAuth ? 1 : 0;
    }
  } catch (err) {
    // Unexpected error mid-orchestration (not a per-model failure, which is caught above).
    // Never lose already-paid-for work: fall through to the write-artifacts block below.
    run.failures.push({ model: 'orchestrator', stage: 'unexpected', message: err.message });
    run.exitCode = 1;
  } finally {
    run.endedAt = new Date().toISOString();
    run.totalCostUsd = sumCost([...run.opinions, ...run.reviews, run.chairmanResult]);

    const runTs = ts();
    const htmlPath = writeHtmlReport(run, outDir, runTs);
    const transcriptPath = writeTranscript(run, outDir, runTs);
    const jsonPath = writeRunJson(run, outDir, runTs);

    console.log('');
    console.log('─────────────────────────────────────────────────────');
    console.log(`Total cost: $${run.totalCostUsd.toFixed(5)}`);
    for (const entry of [...run.opinions, ...run.reviews, run.chairmanResult].filter(Boolean)) {
      console.log(`  ${entry.model.padEnd(32)} ${entry.status.padEnd(8)} $${(entry.usage?.cost ?? 0).toFixed(5)}  ${entry.latencyMs ?? '-'}ms`);
    }
    if (run.failures.length) {
      console.log(`Failures: ${run.failures.map(f => `${f.model}/${f.stage}`).join(', ')}`);
    }
    console.log(`Report:     ${htmlPath}`);
    console.log(`Transcript: ${transcriptPath}`);
    console.log(`Run JSON:   ${jsonPath}`);

    process.exitCode = run.exitCode;
  }
}

main().catch(err => {
  console.error('❌', err.message);
  process.exitCode = 1;
});
