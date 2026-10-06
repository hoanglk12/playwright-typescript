// Measures how well LightRAG serves the memory vault, using the same request the recall hook
// (.claude/hooks/user-prompt-submit.js) sends on every prompt.
//
//   node scripts/eval-lightrag.mjs                  golden set, index and live queries (~10 min, billed)
//   node scripts/eval-lightrag.mjs --offline        golden set and index checks only, no LightRAG calls
//   node scripts/eval-lightrag.mjs --recall-stats   summarise real recall outcomes logged by the hook
//
// Live runs:
//   --mode <m> --timeout <ms>   try settings other than lightrag-recall-config.json
//   --param key=value           add a /query field, e.g. --param top_k=10 (repeatable)
//   --repeat <n>                ask every question n times, to tell a real change from noise
//   --only <regex>              only the questions whose note, style or text matches
//   --diagnose                  also fetch the retrieved context (/query/data, reusing the keywords
//                               just extracted) to split retrieval misses from facts the answer dropped
//   --no-save                   don't write the run to .claude/.state/lightrag-eval-runs/
// Saved runs, no LightRAG calls:
//   --rescore <file|latest>     score a saved run with the current golden set and config
//   --compare <file|prev>       paired comparison with an earlier run, both scored the same way
//
// Exits 1 when the golden set is invalid or out of date with the vault, a vault note is missing,
// failed or stale in LightRAG, or LightRAG errors instead of answering. Quality numbers are
// reported, never enforced.
import { createHash, randomInt } from 'crypto';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault', '20-memory');
const GOLDEN_FILE = join(PROJECT_ROOT, 'scripts', 'lightrag-eval-golden.json');
const RECALL_LOG = join(PROJECT_ROOT, '.claude', '.state', 'lightrag-recall-log.jsonl');
const RUNS_DIR = join(PROJECT_ROOT, '.claude', '.state', 'lightrag-eval-runs');
const RECALL_CONFIG = JSON.parse(
  readFileSync(join(PROJECT_ROOT, '.claude', 'hooks', 'lightrag-recall-config.json'), 'utf8')
);
const LIGHTRAG_URL = process.env.LIGHTRAG_URL ?? 'http://localhost:9621';
const WORKING_DIR = process.env.LIGHTRAG_WORKING_DIR ?? join(PROJECT_ROOT, '.lightrag');
const SERVER_LOG = process.env.LIGHTRAG_LOG ?? join(PROJECT_ROOT, 'lightrag.log');
const QUERY_TIMEOUT_MS = 120000;
// A fact that also matches this share of all notes says little about whether the right note was used.
const WEAK_FACT_SHARE = 0.3;
const BUDGETS_MS = [5000, 7000, 9000, 12000, 15000, 20000];

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const params = Object.fromEntries(
  args
    .flatMap((a, i) => (a === '--param' && args[i + 1] ? [args[i + 1]] : []))
    .map(kv => {
      const [key, ...rest] = kv.split('=');
      try {
        return [key, JSON.parse(rest.join('='))];
      } catch {
        return [key, rest.join('=')];
      }
    })
);
const settings = {
  mode: option('--mode', RECALL_CONFIG.mode),
  timeoutMs: Number(option('--timeout', RECALL_CONFIG.timeoutMs)),
  enable_rerank: RECALL_CONFIG.enable_rerank,
  maxInjectChars: RECALL_CONFIG.maxInjectChars ?? 1500,
  minChars: RECALL_CONFIG.minChars,
  noInfoPattern: RECALL_CONFIG.noInfoPattern,
  params,
};
const overrides = [
  settings.mode !== RECALL_CONFIG.mode && `mode=${settings.mode}`,
  settings.timeoutMs !== RECALL_CONFIG.timeoutMs && `timeout=${settings.timeoutMs}ms`,
  ...Object.entries(params).map(([k, v]) => `${k}=${JSON.stringify(v)}`),
].filter(Boolean);
const matchesHook = !overrides.length;
const repeat = Math.max(1, Number(option('--repeat', 1)) || 1);

const md5 = text => createHash('md5').update(text).digest('hex');
const share = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const pct = (n, d) => (d ? `${n}/${d} (${share(n, d)}%)` : '0/0');

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
}

// Wilson score interval. With --repeat the rows of one question are correlated, so the interval is
// computed over distinct questions, not rows.
function wilson(p, n, z = 1.96) {
  if (!n) return [0, 0];
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function rate(rows, key) {
  const k = rows.filter(r => r[key]).length;
  const n = rows.length;
  if (!n) return '0/0';
  const [lo, hi] = wilson(k / n, new Set(rows.map(r => r.question)).size);
  return `${pct(k, n)}  95% CI ${Math.round(lo * 100)}-${Math.round(hi * 100)}%`;
}

// Exact two-sided McNemar test on the questions that flipped between two runs.
function mcnemar(b, c) {
  const n = b + c;
  if (!n) return 1;
  let tail = 0;
  let coef = 1;
  for (let i = 0; i <= Math.min(b, c); i++) {
    tail += coef;
    coef = (coef * (n - i)) / (i + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

function readVault(dir, notes = new Map()) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__parsed__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) readVault(full, notes);
    else if (entry.endsWith('.md')) notes.set(entry, readFileSync(full, 'utf8'));
  }
  return notes;
}

const styleOf = g => g.style ?? (g.note ? 'question' : 'absent-topic');

// Every fact must still appear in its note and every "absent" term in no note, otherwise a score
// change could mean the vault changed rather than retrieval getting better or worse. A fact the
// question already contains, or one most notes contain, passes without the right note.
function validateGolden(golden, vault) {
  const problems = [];
  const weak = [];
  const seen = new Set();
  const notes = [...vault.values()];
  for (const g of golden.questions) {
    if (seen.has(g.question)) problems.push(`INVALID duplicate question "${g.question}"`);
    seen.add(g.question);
    if (g.note) {
      const text = vault.get(g.note);
      if (!text) {
        problems.push(`STALE   ${g.note}: not in the vault`);
        continue;
      }
      const shares = [];
      for (const f of g.facts) {
        const re = new RegExp(f, 'i');
        if (!re.test(text)) problems.push(`STALE   ${g.note}: fact /${f}/ no longer in the note`);
        if (re.test(g.question)) {
          problems.push(
            `INVALID ${g.note}: fact /${f}/ matches the question itself, so repeating the question passes`
          );
        }
        shares.push(notes.filter(t => re.test(t)).length / notes.length);
      }
      if (shares.every(s => s >= WEAK_FACT_SHARE)) {
        weak.push(
          `${g.note}: every fact matches ${Math.round(Math.min(...shares) * 100)}%+ of notes ("${g.question}")`
        );
      }
    } else {
      for (const term of g.absent) {
        for (const [name, text] of vault) {
          if (new RegExp(term, 'i').test(text)) {
            problems.push(
              `STALE   "${g.question}" is answerable now: /${term}/ appears in ${name}`
            );
          }
        }
      }
    }
  }
  const covered = new Set(golden.questions.map(g => g.note));
  const uncovered = [...vault.keys()].filter(n => !covered.has(n) && !(n in golden.skip));
  return { problems, weak, uncovered };
}

// The API reports content_length only, which misses an edit that keeps the length (a date, a status
// word). LightRAG's working dir keeps md5 of the stored text: the note after sanitize_text_for_encoding
// (strip, html.unescape, control characters removed). Without entities or control characters that is
// md5(trim()); for other notes the stored hash can't be predicted, so they are reported as unverified.
const UNPREDICTABLE_HASH =
  /&(#x?[0-9a-f]+|[a-z][a-z0-9]*);|&(amp|lt|gt|quot|nbsp|copy|reg|not)|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\ufeff]/i;

function readIndexSnapshot() {
  const file = join(WORKING_DIR, 'kv_store_doc_status.json');
  if (!existsSync(file)) return null;
  try {
    const docs = new Map();
    for (const [id, d] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
      if (docs.get(d.file_path)?.status === 'processed' && d.status !== 'processed') continue;
      docs.set(d.file_path, {
        id,
        status: d.status,
        hash: d.content_hash,
        length: d.content_length,
        updatedAt: d.updated_at,
      });
    }
    return { savedAt: statSync(file).mtime, docs };
  } catch {
    return null;
  }
}

async function fetchIndexStatus() {
  const res = await fetch(`${LIGHTRAG_URL}/documents/paginated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 1, page_size: 200 }),
  });
  const data = await res.json();
  const docs = data.documents ?? [];
  const byFile = new Map();
  for (const d of docs) {
    if (byFile.get(d.file_path)?.status !== 'processed') byFile.set(d.file_path, d);
  }
  return { truncated: (data.status_counts?.all ?? docs.length) > docs.length, docs, byFile };
}

function reportIndex(vault, { api, snapshot }) {
  const names = [...vault.keys()];
  const statusOf = n => (api ? api.byFile.get(n)?.status : snapshot.docs.get(n)?.status);
  const source = api
    ? 'LightRAG'
    : `the on-disk index (saved ${snapshot.savedAt.toISOString().slice(0, 16)}Z)`;
  const processed = names.filter(n => statusOf(n) === 'processed');
  const missing = names.filter(n => !statusOf(n));
  const failedDocs = api
    ? api.docs.filter(d => d.status === 'failed').map(d => d.file_path)
    : names.filter(n => statusOf(n) === 'failed');
  const inFlight = names.filter(n => statusOf(n) && !['processed', 'failed'].includes(statusOf(n)));
  const indexed = api ? [...api.byFile.keys()] : [...snapshot.docs.keys()];
  const orphans = indexed.filter(f => !vault.has(f));

  console.log(`\nIndex: ${processed.length}/${vault.size} vault notes processed in ${source}`);
  if (api?.truncated) console.log('  WARNING  more than 200 docs in LightRAG, listing truncated');
  for (const n of missing) console.log(`  MISSING   ${n}`);
  for (const n of failedDocs)
    console.log(`  FAILED    ${n} (see error_msg in /documents/paginated)`);
  for (const n of inFlight) console.log(`  INDEXING  ${n}`);
  for (const n of orphans) console.log(`  ORPHAN    ${n} (in LightRAG, not in the vault)`);

  const stale = [];
  const unverified = [];
  if (snapshot) {
    for (const n of processed) {
      const doc = snapshot.docs.get(n);
      const live = api?.byFile.get(n);
      // The JSON store is flushed after each indexing batch, so it can trail the server briefly.
      const lagging =
        !doc ||
        doc.status !== 'processed' ||
        (live && (live.id !== doc.id || live.updated_at !== doc.updatedAt));
      if (lagging || !doc.hash || UNPREDICTABLE_HASH.test(vault.get(n))) unverified.push(n);
      else if (md5(vault.get(n).trim()) !== doc.hash) {
        // sync-vault-to-lightrag.mjs compares lengths with a 2-char tolerance, so it never re-syncs these.
        const syncBlind = Math.abs(vault.get(n).trim().length - doc.length) <= 2;
        stale.push({ name: n, id: doc.id, syncBlind });
      }
    }
    console.log(
      `  Content: ${processed.length - stale.length - unverified.length} match the vault exactly, ${stale.length} stale, ${unverified.length} not verifiable`
    );
    for (const s of stale) {
      const fix = s.syncBlind
        ? `same length, so sync:vault won't pick it up: delete doc ${s.id}, then sync`
        : 'run npm run sync:vault';
      console.log(`  STALE     ${s.name} (LightRAG holds an older version; ${fix})`);
    }
  } else {
    console.log(`  Content not checked: no ${join(WORKING_DIR, 'kv_store_doc_status.json')}`);
  }
  return Boolean(missing.length || failedDocs.length || stale.length);
}

// Zero-width characters make every query unique, which defeats LightRAG's keyword and answer caches
// (an exact repeat comes back in ~2s instead of ~10s), without adding a word that keyword extraction
// or the query embedding would pick up, as the earlier "(eval <runId>)" suffix did.
const ZERO_WIDTH = [0x200b, 0x200c, 0x200d, 0x2060].map(c => String.fromCodePoint(c));
const nonce = () => Array.from({ length: 16 }, () => ZERO_WIDTH[randomInt(4)]).join('');

async function post(path, body) {
  const sentAt = Date.now();
  try {
    const res = await fetch(`${LIGHTRAG_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    const raw = await res.text();
    const receivedAt = Date.now();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {}
    if (!res.ok) {
      const detail = String(json?.detail ?? raw).slice(0, 160);
      return { sentAt, receivedAt, status: res.status, error: `HTTP ${res.status} ${detail}` };
    }
    return { sentAt, receivedAt, status: res.status, json };
  } catch (e) {
    const error =
      e.name === 'TimeoutError' ? `no answer in ${QUERY_TIMEOUT_MS / 1000}s` : e.message;
    return { sentAt, receivedAt: Date.now(), status: 0, error };
  }
}

const refsOf = refs => [...new Set((refs ?? []).map(r => r.file_path).filter(Boolean))];

function contextText(data = {}) {
  return [
    ...(data.entities ?? []).map(e => `${e.entity_name}: ${e.description}`),
    ...(data.relationships ?? []).map(
      r => `${r.src_id} - ${r.tgt_id}: ${r.description} ${r.keywords ?? ''}`
    ),
    ...(data.chunks ?? []).map(c => c.content),
  ].join('\n');
}

async function ask(g, rep, diagnose) {
  const body = {
    query: g.question + nonce(),
    mode: settings.mode,
    enable_rerank: settings.enable_rerank,
    ...settings.params,
  };
  const q = await post('/query', body);
  const row = {
    question: g.question,
    rep,
    sentAt: q.sentAt,
    receivedAt: q.receivedAt,
    ms: q.receivedAt - q.sentAt,
    status: q.status,
    error: q.error ?? null,
    answer: typeof q.json?.response === 'string' ? q.json.response.trim() : '',
    refs: refsOf(q.json?.references),
  };
  if (diagnose && g.note && !row.error) {
    // The same query text hits the keyword cache the /query call just filled, so this returns the
    // context that answer was generated from, and costs only the embedding call.
    const d = await post('/query/data', body);
    const context = contextText(d.json?.data);
    row.data = d.error
      ? { error: d.error }
      : {
          ms: d.receivedAt - d.sentAt,
          refs: refsOf(d.json?.data?.references),
          contextChars: context.length,
          contextFacts: Object.fromEntries(g.facts.map(f => [f, new RegExp(f, 'i').test(context)])),
          keywords: d.json?.metadata?.keywords ?? null,
        };
  }
  return row;
}

const SOFT_REFUSAL =
  /\b(no (specific |relevant |further )?(information|details|mention|data)|not (mentioned|provided|specified|documented|available|included|found|covered)|(does not|doesn'?t) (contain|mention|include|specify|provide)|(unable|not able) to (find|determine|locate|identify)|cannot (find|determine|locate|identify))\b/i;

const CAUSES = {
  slow: 'right facts, but after the recall budget',
  retrieval: 'a fact was missing from the retrieved context',
  generation: 'the context had every fact, the answer left one out',
  truncated: 'the facts came after the maxInjectChars cut',
  declined: 'a no-info reply, or shorter than minChars',
  facts: 'a fact was missing from the answer (--diagnose tells retrieval from generation)',
  error: 'LightRAG returned an error or no answer',
};

function scoreRow(g, r, sc) {
  const noInfoRe = new RegExp(sc.noInfoPattern, 'i');
  const s = { ...r, note: g.note, style: styleOf(g) };
  s.ok = !r.error;
  s.inTime = s.ok && r.ms < sc.timeoutMs;
  s.injectable = s.ok && r.answer.length > sc.minChars && !noInfoRe.test(r.answer);
  if (!g.note) {
    s.abstained = s.ok && !s.injectable;
    s.softRefusal = s.injectable && SOFT_REFUSAL.test(r.answer);
    return s;
  }
  // The hook injects only the first maxInjectChars, so a fact past the cut never reaches Claude.
  const injected = r.answer.slice(0, sc.maxInjectChars);
  const res = g.facts.map(f => new RegExp(f, 'i'));
  s.hit = r.refs.includes(g.note);
  s.factHits = res.map(re => s.injectable && re.test(injected));
  s.facts = s.factHits.every(Boolean);
  s.factRecall = s.factHits.filter(Boolean).length / res.length;
  s.delivered = s.facts && s.inTime;
  let inContext = null;
  if (r.data && !r.data.error) {
    s.contextHit = r.data.refs.includes(g.note);
    const known = g.facts.map(f => r.data.contextFacts?.[f]);
    inContext = known.includes(undefined) ? null : known.every(Boolean);
    s.contextFacts = inContext;
  }
  const inFullAnswer = s.injectable && res.every(re => re.test(r.answer));
  if (s.delivered) s.cause = null;
  else if (!s.ok) s.cause = 'error';
  else if (!s.injectable) s.cause = 'declined';
  else if (s.facts) s.cause = 'slow';
  else if (inFullAnswer) s.cause = 'truncated';
  else s.cause = inContext === false ? 'retrieval' : inContext ? 'generation' : 'facts';
  return s;
}

function scoreRun(run, golden, sc) {
  const byQuestion = new Map(golden.questions.map(g => [g.question, g]));
  const gone = new Set(run.rows.filter(r => !byQuestion.has(r.question)).map(r => r.question));
  if (gone.size)
    console.log(
      `  (${gone.size} question(s) in the run are no longer in the golden set, left out)`
    );
  return run.rows
    .filter(r => byQuestion.has(r.question))
    .map(r => scoreRow(byQuestion.get(r.question), r, sc));
}

function rowLabel(s) {
  if (!s.note) return `(${s.style}) ${s.question}`;
  return s.style === 'question' ? s.note : `${s.note} (${s.style}: "${s.question}")`;
}

function rowMark(s) {
  if (!s.ok) return 'ERR ';
  if (!s.note) return s.abstained ? 'ok  ' : 'BAD ';
  return s.delivered ? 'ok  ' : s.facts ? 'slow' : 'BAD ';
}

// lightrag.log stamps lines with Python's local-time asctime ("2026-10-02 23:45:14,141") and the eval
// runs on the same machine, so lines are parsed as local time and compared as epoch ms. Four lines per
// uncached query bound the phases: keyword LLM call, query embedding, graph/vector retrieval, answer.
const LOG_LINE = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d),(\d{3}) - lightrag - INFO - (.*)$/;
const PHASE_MARKS = [
  ['keywords', /== LLM cache == saving: \w+:keywords:/],
  ['nodes', /^Query nodes:/],
  ['context', /^Final context:/],
  ['answer', /== LLM cache == saving: \w+:query:/],
];

function joinServerPhases(rows) {
  const timed = rows.filter(r => r.sentAt);
  if (!timed.length) return false;
  const from = Math.min(...timed.map(r => r.sentAt)) - 1000;
  const events = [];
  for (const file of [`${SERVER_LOG}.1`, SERVER_LOG]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = LOG_LINE.exec(line.trimEnd());
      if (!m) continue;
      const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]).getTime();
      const mark = t >= from && PHASE_MARKS.find(([, re]) => re.test(m[8].trim()));
      if (mark) events.push({ t, kind: mark[0] });
    }
  }
  if (!events.length) return false;
  // Each query's lines are written between its request and its response; the eval is sequential, so
  // more than one keyword or answer line in a window means other traffic (the hook, MCP) overlapped.
  for (const r of timed) {
    const w = events.filter(e => e.t >= r.sentAt && e.t <= r.receivedAt);
    const at = kind => w.find(e => e.kind === kind)?.t ?? null;
    const count = kind => w.filter(e => e.kind === kind).length;
    if (count('keywords') > 1 || count('answer') > 1) r.phases = { flag: 'ambiguous' };
    else if (!count('keywords')) r.phases = { flag: 'no_keyword_call' };
    else {
      const [k, n, c, a] = ['keywords', 'nodes', 'context', 'answer'].map(at);
      r.phases = {
        keywordMs: k - r.sentAt,
        embedMs: n && n - k,
        retrievalMs: n && c && c - n,
        answerMs: c && a && a - c,
      };
    }
  }
  return true;
}

function summarize(scored, sc) {
  const answerable = scored.filter(s => s.note);
  const unanswerable = scored.filter(s => !s.note);
  const okAnswerable = answerable.filter(s => s.ok);
  const okUnanswerable = unanswerable.filter(s => s.ok);
  const ms = scored.filter(s => s.ok).map(s => s.ms);
  const errors = scored.filter(s => !s.ok);
  const line = (label, value) => console.log(`${label.padEnd(50)} ${value}`);
  const byStyle = (rows, key) =>
    [...new Set(rows.map(r => r.style))]
      .map(style => {
        const group = rows.filter(r => r.style === style);
        return `${style} ${pct(group.filter(r => r[key]).length, group.length)}`;
      })
      .join(', ');

  console.log('\n=== Summary ===');
  if (errors.length)
    line('LightRAG errors (left out of the quality rows):', pct(errors.length, scored.length));
  line('Note retrieved (expected note in references):', rate(okAnswerable, 'hit'));
  line('Answer contains the key facts, as injected:', rate(okAnswerable, 'facts'));
  if (okAnswerable.length) {
    const recall = okAnswerable.reduce((t, s) => t + s.factRecall, 0) / okAnswerable.length;
    line('  mean share of facts present:', `${Math.round(recall * 100)}%`);
  }
  line('Declined unanswerable questions:', rate(okUnanswerable, 'abstained'));
  if (new Set(okUnanswerable.map(s => s.style)).size > 1)
    line('  by style:', byStyle(okUnanswerable, 'abstained'));
  line(`Answered within the ${sc.timeoutMs}ms recall budget:`, rate(scored, 'inTime'));
  if (ms.length)
    line(
      'Latency:',
      `p50 ${percentile(ms, 0.5)}ms, p90 ${percentile(ms, 0.9)}ms, max ${Math.max(...ms)}ms`
    );
  line('Delivered by recall (right facts AND in time):', rate(answerable, 'delivered'));
  if (new Set(answerable.map(s => s.style)).size > 1)
    line('  by style:', byStyle(answerable, 'delivered'));

  const misses = answerable.filter(s => s.cause);
  if (misses.length) {
    console.log(`\nWhy answers weren't delivered (${misses.length}):`);
    for (const [cause, why] of Object.entries(CAUSES)) {
      const group = misses.filter(s => s.cause === cause);
      if (!group.length) continue;
      console.log(`  ${cause.padEnd(10)} ${String(group.length).padStart(3)}  ${why}`);
      if (cause !== 'slow')
        for (const s of group)
          console.log(`             ${rowLabel(s)}${s.hit ? '' : ' (note not retrieved)'}`);
    }
  }

  if (answerable.length) {
    const at = BUDGETS_MS.map(b => {
      const n = answerable.filter(s => s.facts && s.ms < b).length;
      return `${b / 1000}s ${share(n, answerable.length)}%`;
    });
    console.log('');
    line('Delivered if the recall budget were:', at.join(' · '));
  }

  const diagnosed = okAnswerable.filter(s => s.data && !s.data.error);
  if (diagnosed.length) {
    console.log(`\nRetrieved context (--diagnose, ${diagnosed.length} answers):`);
    line(
      '  Expected note in the context:',
      pct(diagnosed.filter(s => s.contextHit).length, diagnosed.length)
    );
    const known = diagnosed.filter(s => s.contextFacts !== null);
    line(
      '  Every fact in the context:',
      pct(known.filter(s => s.contextFacts).length, known.length)
    );
    const dms = diagnosed.map(s => s.data.ms);
    line(
      '  Retrieval only (keywords cached):',
      `p50 ${percentile(dms, 0.5)}ms, p90 ${percentile(dms, 0.9)}ms`
    );
    const chars = diagnosed.map(s => s.data.contextChars);
    line(
      '  Context size sent to the answer LLM:',
      `p50 ${percentile(chars, 0.5)} chars, max ${Math.max(...chars)}`
    );
  }

  const phased = scored.filter(s => s.phases);
  if (phased.length) {
    const clean = phased.filter(s => !s.phases.flag);
    const flagged = phased.length - clean.length;
    console.log(
      `\nServer phases from lightrag.log (${clean.length} queries${flagged ? `, ${flagged} ambiguous or cached, left out` : ''}):`
    );
    for (const [key, label] of [
      ['keywordMs', 'keyword LLM'],
      ['embedMs', 'embedding'],
      ['retrievalMs', 'retrieval'],
      ['answerMs', 'answer LLM'],
    ]) {
      const v = clean.map(s => s.phases[key]).filter(x => typeof x === 'number');
      if (v.length)
        console.log(
          `  ${label.padEnd(12)} p50 ${percentile(v, 0.5)}ms, p90 ${percentile(v, 0.9)}ms`
        );
    }
  }

  const leaks = okUnanswerable.filter(s => !s.abstained);
  if (leaks.length) {
    console.log('\nAnswered a question the vault cannot answer:');
    for (const s of leaks) {
      const kind = s.softRefusal
        ? 'reads like a refusal noInfoPattern missed'
        : 'possible hallucination';
      console.log(
        `  [${s.style}] ${s.question}\n      ${kind}: "${s.answer.slice(0, 140).replace(/\s+/g, ' ')}"`
      );
    }
  }

  const reps = new Map();
  for (const s of answerable) reps.set(s.question, [...(reps.get(s.question) ?? []), s.delivered]);
  const flaky = [...reps].filter(([, v]) => v.length > 1 && v.some(Boolean) && !v.every(Boolean));
  if (flaky.length) {
    console.log(`\nInconsistent across repeats (${flaky.length}):`);
    for (const [q, v] of flaky)
      console.log(`  ${v.filter(Boolean).length}/${v.length} delivered  ${q}`);
  }
}

function compareRuns(baseFile, baseRun, curRun, golden, sc) {
  const base = scoreRun(baseRun, golden, sc);
  const cur = scoreRun(curRun, golden, sc);
  console.log(`\n=== Compared with ${basename(baseFile)} ===`);
  const diffs = [];
  for (const key of ['mode', 'enable_rerank']) {
    if (baseRun.settings[key] !== curRun.settings[key])
      diffs.push(`${key} ${baseRun.settings[key]} -> ${curRun.settings[key]}`);
  }
  if (
    JSON.stringify(baseRun.settings.params ?? {}) !== JSON.stringify(curRun.settings.params ?? {})
  ) {
    diffs.push(
      `params ${JSON.stringify(baseRun.settings.params ?? {})} -> ${JSON.stringify(curRun.settings.params ?? {})}`
    );
  }
  if (diffs.length) console.log(`  Settings differ: ${diffs.join('; ')}`);
  if (baseRun.vaultFingerprint !== curRun.vaultFingerprint)
    console.log('  The vault changed between the runs, so note edits can explain differences.');
  if (baseRun.lightragVersion !== curRun.lightragVersion)
    console.log(`  LightRAG ${baseRun.lightragVersion} -> ${curRun.lightragVersion}`);

  // A question passes when it passed in at least half its repeats; only questions in both runs count.
  const passes = (rows, key) => {
    const m = new Map();
    for (const r of rows) m.set(r.question, [...(m.get(r.question) ?? []), Boolean(r[key])]);
    return new Map([...m].map(([q, v]) => [q, v.filter(Boolean).length * 2 >= v.length]));
  };
  for (const [key, label, filter] of [
    ['delivered', 'Delivered by recall', s => s.note],
    ['facts', 'Answer contains the key facts', s => s.note && s.ok],
    ['abstained', 'Declined unanswerable', s => !s.note && s.ok],
  ]) {
    const b = passes(base.filter(filter), key);
    const c = passes(cur.filter(filter), key);
    const common = [...b.keys()].filter(q => c.has(q));
    if (!common.length) continue;
    const improved = common.filter(q => !b.get(q) && c.get(q));
    const regressed = common.filter(q => b.get(q) && !c.get(q));
    const before = common.filter(q => b.get(q)).length;
    const after = common.filter(q => c.get(q)).length;
    const p = mcnemar(improved.length, regressed.length);
    const verdict = p < 0.05 ? 'a real change' : 'within noise';
    console.log(
      `  ${label.padEnd(30)} ${before}/${common.length} -> ${after}/${common.length}  (+${improved.length} / -${regressed.length}, McNemar p=${p.toFixed(2)}, ${verdict})`
    );
    if (key !== 'delivered') continue;
    for (const [mark, list] of [
      ['worse ', regressed],
      ['better', improved],
    ]) {
      for (const q of list.slice(0, 8)) console.log(`      ${mark} ${q}`);
      if (list.length > 8) console.log(`      ${mark} ... and ${list.length - 8} more`);
    }
  }
  const lat = rows => rows.filter(s => s.ok).map(s => s.ms);
  console.log(
    `  Latency p50 ${percentile(lat(base), 0.5)} -> ${percentile(lat(cur), 0.5)}ms, p90 ${percentile(lat(base), 0.9)} -> ${percentile(lat(cur), 0.9)}ms`
  );
}

function listRuns() {
  return existsSync(RUNS_DIR)
    ? readdirSync(RUNS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .map(f => join(RUNS_DIR, f))
    : [];
}

function resolveRun(ref, exclude) {
  if (ref === 'latest' || ref === 'prev')
    return (
      listRuns()
        .filter(f => f !== exclude)
        .at(-1) ?? null
    );
  for (const candidate of [resolve(ref), join(RUNS_DIR, ref), join(RUNS_DIR, `${ref}.json`)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function loadRun(ref, exclude) {
  const file = resolveRun(ref, exclude);
  if (!file)
    throw new Error(
      `no saved run matches "${ref}" (runs live in ${relative(PROJECT_ROOT, RUNS_DIR)})`
    );
  return { file, run: JSON.parse(readFileSync(file, 'utf8')) };
}

function gitCommit() {
  try {
    const run = a => execFileSync('git', a, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
    return run(['status', '--porcelain'])
      ? `${run(['rev-parse', '--short', 'HEAD'])}+dirty`
      : run(['rev-parse', '--short', 'HEAD']);
  } catch {
    return null;
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
    .flatMap(line => {
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
  console.log(
    `Recall log: ${rows.length} prompts, ${rows[0]?.ts ?? '-'} → ${rows.at(-1)?.ts ?? '-'}`
  );
  for (const [key, group] of byConfig) {
    const queried = group.filter(r => !r.outcome.startsWith('skipped'));
    const counts = {};
    for (const r of queried) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
    const answered = queried.filter(r => r.outcome === 'injected' || r.outcome === 'no_info');
    console.log(`\n${key}`);
    console.log(
      `  prompts queried:   ${queried.length} (${group.length - queried.length} skipped: too short or a task notification)`
    );
    console.log(`  memory injected:   ${pct(counts.injected ?? 0, queried.length)}`);
    console.log(`  timed out:         ${pct(counts.timeout ?? 0, queried.length)}`);
    console.log(`  answered, no info: ${pct(counts.no_info ?? 0, queried.length)}`);
    const other = Object.entries(counts).filter(
      ([k]) => !['injected', 'timeout', 'no_info'].includes(k)
    );
    if (other.length)
      console.log(`  other:             ${other.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    const ms = answered.map(r => r.ms);
    if (ms.length)
      console.log(
        `  answer latency:    p50 ${percentile(ms, 0.5)}ms, p90 ${percentile(ms, 0.9)}ms`
      );
    // The whole prompt is the query, so a long prompt makes a long keyword-extraction call.
    const buckets = [
      [0, 100],
      [100, 500],
      [500, 2000],
      [2000, Infinity],
    ]
      .map(([lo, hi]) => {
        const b = queried.filter(r => r.promptChars >= lo && r.promptChars < hi);
        const label = hi === Infinity ? `${lo}+` : `${lo}-${hi}`;
        return b.length
          ? `${label} chars: ${b.filter(r => r.outcome === 'timeout').length}/${b.length}`
          : null;
      })
      .filter(Boolean);
    if (buckets.length) console.log(`  timeouts by size:  ${buckets.join(', ')}`);
  }
}

async function main() {
  if (flag('--recall-stats')) return recallStats();

  const goldenText = readFileSync(GOLDEN_FILE, 'utf8');
  const golden = JSON.parse(goldenText);
  const vault = readVault(VAULT_DIR);
  let failed = false;

  const { problems, weak, uncovered } = validateGolden(golden, vault);
  const unanswerableCount = golden.questions.filter(g => !g.note).length;
  console.log(
    `Golden set: ${golden.questions.length} questions (${golden.questions.length - unanswerableCount} answerable, ${unanswerableCount} unanswerable), ${vault.size} vault notes`
  );
  for (const p of problems) console.log(`  ${p}`);
  for (const w of weak) console.log(`  WEAK    ${w}`);
  for (const n of uncovered)
    console.log(`  NO QUESTION  ${n} (add one to scripts/lightrag-eval-golden.json)`);
  if (problems.length) failed = true;

  if (option('--rescore')) {
    const { file, run } = loadRun(option('--rescore'));
    console.log(
      `\nRescoring ${basename(file)}: ${run.rows.length} answers from ${run.startedAt}, mode=${run.settings.mode}, budget ${settings.timeoutMs}ms`
    );
    const scored = scoreRun(run, golden, settings);
    summarize(scored, settings);
    if (option('--compare')) {
      const base = loadRun(option('--compare'), file);
      compareRuns(base.file, base.run, run, golden, settings);
    }
    return failed;
  }

  const snapshot = readIndexSnapshot();
  if (flag('--offline')) {
    if (snapshot) failed = reportIndex(vault, { snapshot }) || failed;
    else console.log(`\nIndex not checked: no LightRAG working dir at ${WORKING_DIR}`);
    return failed;
  }

  let health;
  try {
    health = await (
      await fetch(`${LIGHTRAG_URL}/health`, { signal: AbortSignal.timeout(5000) })
    ).json();
  } catch {
    console.log(
      `\nLightRAG not reachable at ${LIGHTRAG_URL}. Start scripts\\start-rag.bat, or use --offline.`
    );
    return true;
  }
  failed = reportIndex(vault, { api: await fetchIndexStatus(), snapshot }) || failed;

  const only = option('--only') && new RegExp(option('--only'), 'i');
  const questions = golden.questions.filter(
    g => !only || only.test(`${g.note ?? ''} ${styleOf(g)} ${g.question}`)
  );
  const diagnose = flag('--diagnose');
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${settings.mode}`;
  console.log(
    `\nQueries: mode=${settings.mode}, recall budget ${settings.timeoutMs}ms, ${questions.length} questions x ${repeat}${diagnose ? ', with --diagnose' : ''}, run ${runId}`
  );
  if (!matchesHook)
    console.log(`  EXPERIMENT: differs from what the recall hook sends (${overrides.join(', ')})`);

  const startedAt = new Date().toISOString();
  const rows = [];
  const total = questions.length * repeat;
  let aborted = null;
  let errorStreak = 0;
  outer: for (let rep = 1; rep <= repeat; rep++) {
    for (const g of questions) {
      const r = await ask(g, rep, diagnose);
      rows.push(r);
      const s = scoreRow(g, r, settings);
      const n = `${rows.length}`.padStart(`${total}`.length);
      console.log(
        `  [${n}/${total}] ${rowMark(s)} ${String(r.ms).padStart(6)}ms  ${rowLabel(s)}${r.error ? `  ${r.error}` : ''}`
      );
      errorStreak = r.error ? errorStreak + 1 : 0;
      // An outage (expired LLM key, used-up quota) fails every query the same way. Stop instead of
      // spending ten minutes recording it.
      if (errorStreak >= 3 || (rows.length === 1 && r.status >= 500)) {
        aborted = r.error;
        break outer;
      }
    }
  }

  if (aborted) {
    console.log(`\nStopped: LightRAG is up but fails queries (${aborted}).`);
    console.log(
      '  Its LLM or embedding calls are failing. Look up the error_id in lightrag.log; an expired key or'
    );
    console.log('  used-up quota at the provider shows up as a 401/403 there. Nothing was saved.');
    return true;
  }

  const phases = joinServerPhases(rows);
  const run = {
    schema: 1,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    lightragVersion: health?.core_version ?? null,
    matchesHook,
    settings,
    repeat,
    diagnose,
    only: option('--only') ?? null,
    serverPhases: phases,
    vaultFingerprint: md5(
      [...vault]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([n, t]) => `${n}:${md5(t.trim())}`)
        .join('\n')
    ),
    goldenFingerprint: md5(goldenText),
    rows,
  };
  let savedFile = null;
  if (!flag('--no-save')) {
    mkdirSync(RUNS_DIR, { recursive: true });
    savedFile = join(RUNS_DIR, `${runId}.json`);
    writeFileSync(savedFile, JSON.stringify(run, null, 1));
  }

  summarize(scoreRun(run, golden, settings), settings);
  if (savedFile)
    console.log(
      `\nSaved ${relative(PROJECT_ROOT, savedFile)} (rescore it later with --rescore latest)`
    );
  if (option('--compare')) {
    const base = loadRun(option('--compare'), savedFile);
    compareRuns(base.file, base.run, run, golden, settings);
  }
  return failed;
}

main()
  .then(failed => process.exit(failed ? 1 : 0))
  .catch(e => {
    console.error(`[eval-lightrag] ${e.message}`);
    process.exit(1);
  });
