// Measures how well LightRAG serves the memory vault, using the same request the recall hook
// (.claude/hooks/user-prompt-submit.js) sends on every prompt.
//
//   node scripts/eval-lightrag.mjs                  golden-set check + coverage + live queries (~10 min)
//   node scripts/eval-lightrag.mjs --offline        golden-set and vault checks only, no LightRAG calls
//   node scripts/eval-lightrag.mjs --recall-stats   summarise real recall outcomes logged by the hook
//   --mode <m> --timeout <ms>                       try settings other than lightrag-recall-config.json
//
// Exits 1 when the golden set is out of date with the vault or a vault note is missing/failed in
// LightRAG. Quality numbers are reported, never enforced.
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault', '20-memory');
const GOLDEN_FILE = join(PROJECT_ROOT, 'scripts', 'lightrag-eval-golden.json');
const RECALL_LOG = join(PROJECT_ROOT, '.claude', '.state', 'lightrag-recall-log.jsonl');
const RECALL_CONFIG = JSON.parse(
  readFileSync(join(PROJECT_ROOT, '.claude', 'hooks', 'lightrag-recall-config.json'), 'utf8')
);
const LIGHTRAG_URL = 'http://localhost:9621';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const settings = {
  mode: option('--mode', RECALL_CONFIG.mode),
  timeoutMs: Number(option('--timeout', RECALL_CONFIG.timeoutMs)),
};
const noInfoRe = new RegExp(RECALL_CONFIG.noInfoPattern, 'i');
const wouldInject = (text) => text.length > RECALL_CONFIG.minChars && !noInfoRe.test(text);

function readVault(dir, notes = new Map()) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__parsed__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) readVault(full, notes);
    else if (entry.endsWith('.md')) notes.set(entry, readFileSync(full, 'utf8'));
  }
  return notes;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
}

const pct = (n, d) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '0/0');

// Every fact must still appear in its note and every "absent" term in no note, otherwise a
// score change could mean the vault changed rather than retrieval getting better or worse.
function validateGolden(golden, vault) {
  const problems = [];
  for (const g of golden.questions) {
    if (g.note) {
      const text = vault.get(g.note);
      if (!text) {
        problems.push(`${g.note}: not in the vault`);
        continue;
      }
      for (const f of g.facts) {
        if (!new RegExp(f, 'i').test(text)) problems.push(`${g.note}: fact /${f}/ no longer in the note`);
      }
    } else {
      for (const term of g.absent) {
        for (const [name, text] of vault) {
          if (new RegExp(term, 'i').test(text)) {
            problems.push(`"${g.question}" is answerable now: /${term}/ appears in ${name}`);
          }
        }
      }
    }
  }
  const covered = new Set(golden.questions.map((g) => g.note));
  const uncovered = [...vault.keys()].filter((n) => !covered.has(n) && !(n in golden.skip));
  return { problems, uncovered };
}

async function checkCoverage(vault) {
  const res = await fetch(`${LIGHTRAG_URL}/documents/paginated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 1, page_size: 200 }),
  });
  const data = await res.json();
  const docs = data.documents ?? [];
  const status = new Map(docs.map((d) => [d.file_path, d.status]));
  return {
    truncated: (data.status_counts?.all ?? docs.length) > docs.length,
    processed: [...vault.keys()].filter((n) => status.get(n) === 'processed').length,
    missing: [...vault.keys()].filter((n) => !status.has(n)),
    failed: docs.filter((d) => d.status === 'failed').map((d) => d.file_path),
    inFlight: docs.filter((d) => !['processed', 'failed'].includes(d.status)).map((d) => d.file_path),
    orphans: docs.filter((d) => !vault.has(d.file_path)).map((d) => d.file_path),
  };
}

async function runQuery(question, runId) {
  // The unique suffix defeats LightRAG's LLM response cache. A repeated question comes back
  // in ~2s instead of ~10s, which would overstate how fast recall is for a new prompt.
  const started = Date.now();
  try {
    const res = await fetch(`${LIGHTRAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `${question}\n(eval ${runId})`,
        mode: settings.mode,
        enable_rerank: RECALL_CONFIG.enable_rerank,
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json();
    return {
      ms: Date.now() - started,
      text: typeof data.response === 'string' ? data.response.trim() : '',
      refs: (data.references ?? []).map((r) => r.file_path),
    };
  } catch (e) {
    return { ms: Date.now() - started, text: '', refs: [], error: e.message };
  }
}

function recallStats() {
  if (!existsSync(RECALL_LOG)) {
    console.log('No recall log yet. The hook appends one line per prompt to:\n  ' + RECALL_LOG);
    return;
  }
  const rows = readFileSync(RECALL_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const byConfig = new Map();
  for (const r of rows) {
    const key = `mode=${r.mode} timeout=${r.timeoutMs}ms`;
    if (!byConfig.has(key)) byConfig.set(key, []);
    byConfig.get(key).push(r);
  }
  console.log(`Recall log: ${rows.length} prompts, ${rows[0]?.ts ?? '-'} → ${rows.at(-1)?.ts ?? '-'}`);
  for (const [key, group] of byConfig) {
    const queried = group.filter((r) => !r.outcome.startsWith('skipped'));
    const counts = {};
    for (const r of queried) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
    const answered = queried.filter((r) => r.outcome === 'injected' || r.outcome === 'no_info');
    console.log(`\n${key}`);
    console.log(`  prompts queried:   ${queried.length} (${group.length - queried.length} skipped: too short or a task notification)`);
    console.log(`  memory injected:   ${pct(counts.injected ?? 0, queried.length)}`);
    console.log(`  timed out:         ${pct(counts.timeout ?? 0, queried.length)}`);
    console.log(`  answered, no info: ${pct(counts.no_info ?? 0, queried.length)}`);
    const other = Object.entries(counts).filter(([k]) => !['injected', 'timeout', 'no_info'].includes(k));
    if (other.length) console.log(`  other:             ${other.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    const ms = answered.map((r) => r.ms);
    if (ms.length) console.log(`  answer latency:    p50 ${percentile(ms, 0.5)}ms, p90 ${percentile(ms, 0.9)}ms`);
  }
}

async function main() {
  if (args.includes('--recall-stats')) return recallStats();

  const golden = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'));
  const vault = readVault(VAULT_DIR);
  let failed = false;

  const { problems, uncovered } = validateGolden(golden, vault);
  console.log(`Golden set: ${golden.questions.length} questions, ${vault.size} vault notes`);
  for (const p of problems) console.log(`  STALE   ${p}`);
  for (const n of uncovered) console.log(`  NO QUESTION  ${n} (add one to scripts/lightrag-eval-golden.json)`);
  if (problems.length) failed = true;
  if (args.includes('--offline')) return failed;

  try {
    await fetch(`${LIGHTRAG_URL}/health`, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.log(`\nLightRAG not reachable at ${LIGHTRAG_URL}. Start scripts\\start-rag.bat, or use --offline.`);
    return true;
  }

  const cov = await checkCoverage(vault);
  console.log(`\nCoverage: ${cov.processed}/${vault.size} vault notes processed in LightRAG`);
  if (cov.truncated) console.log('  WARNING  more than 200 docs in LightRAG, listing truncated');
  for (const n of cov.missing) console.log(`  MISSING   ${n}`);
  for (const n of cov.failed) console.log(`  FAILED    ${n}`);
  for (const n of cov.inFlight) console.log(`  INDEXING  ${n}`);
  for (const n of cov.orphans) console.log(`  ORPHAN    ${n} (in LightRAG, not in the vault)`);
  if (cov.missing.length || cov.failed.length) failed = true;

  const runId = Date.now().toString(36);
  console.log(`\nQueries: mode=${settings.mode}, recall budget ${settings.timeoutMs}ms, run ${runId}`);
  const answerable = [];
  const unanswerable = [];
  for (const [i, g] of golden.questions.entries()) {
    const r = await runQuery(g.question, runId);
    const inTime = r.ms < settings.timeoutMs;
    const injectable = wouldInject(r.text);
    if (g.note) {
      const row = {
        note: g.note,
        ms: r.ms,
        inTime,
        hit: r.refs.includes(g.note),
        facts: injectable && g.facts.every((f) => new RegExp(f, 'i').test(r.text)),
        error: r.error,
      };
      row.delivered = row.facts && inTime;
      answerable.push(row);
    } else {
      unanswerable.push({ question: g.question, ms: r.ms, inTime, abstained: !injectable, error: r.error });
    }
    const mark = g.note ? (answerable.at(-1).facts ? 'ok ' : 'BAD') : unanswerable.at(-1).abstained ? 'ok ' : 'BAD';
    const label = g.note ?? `(unanswerable) ${g.question}`;
    console.log(`  [${String(i + 1).padStart(2)}] ${mark} ${String(r.ms).padStart(6)}ms  ${label}${r.error ? `  ERROR ${r.error}` : ''}`);
  }

  const all = [...answerable, ...unanswerable];
  const ms = all.map((r) => r.ms);
  const n = (rows, key) => rows.filter((r) => r[key]).length;
  console.log('\n=== Summary ===');
  console.log(`Note retrieved (expected note in references): ${pct(n(answerable, 'hit'), answerable.length)}`);
  console.log(`Answer contains the note's key facts:         ${pct(n(answerable, 'facts'), answerable.length)}`);
  console.log(`Declined unanswerable questions:              ${pct(n(unanswerable, 'abstained'), unanswerable.length)}`);
  console.log(`Answered within the ${settings.timeoutMs}ms recall budget:       ${pct(n(all, 'inTime'), all.length)}`);
  console.log(`Latency: p50 ${percentile(ms, 0.5)}ms, p90 ${percentile(ms, 0.9)}ms, max ${Math.max(...ms)}ms`);
  console.log(`Delivered by recall (right facts AND in time): ${pct(n(answerable, 'delivered'), answerable.length)}`);

  const misses = answerable.filter((r) => !r.facts);
  if (misses.length) {
    console.log('\nAnswers missing key facts (check the note is specific enough, or retrieval):');
    for (const r of misses) console.log(`  ${r.note}${r.hit ? '' : ' (note not retrieved)'}`);
  }
  const leaks = unanswerable.filter((r) => !r.abstained);
  if (leaks.length) {
    console.log('\nAnswered a question the vault cannot answer (possible hallucination):');
    for (const r of leaks) console.log(`  ${r.question}`);
  }
  return failed;
}

main()
  .then((failed) => process.exit(failed ? 1 : 0))
  .catch((e) => {
    console.error(`[eval-lightrag] ${e.message}`);
    process.exit(1);
  });
