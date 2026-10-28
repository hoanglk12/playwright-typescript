---
name: claude-code-statusline-subagent-cost
description: "How the user's Claude Code status line shows per-subagent model/tokens/branch/cost (~/.claude/statusline-command.js, one script driving statusLine and subagentStatusLine), plus verified facts about Claude Code cost data and transcript layout"
type: reference
tags: [memory, reference]
last_verified: 2026-10-28
---

Set up 2026-10-28 in user-global config, outside the repo. `~/.claude/statusline-command.js` is wired to both `statusLine` (with `refreshInterval: 10`) and `subagentStatusLine` in `~/.claude/settings.json`. If stdin has a `tasks` array, the script renders subagent rows. Otherwise it renders the main line. Backups: `*.bak-20261028-133840` next to each file.

Verified on Claude Code 2.1.312:

- **The main `statusLine` stdin has no per-subagent data.** Per-agent model, effort, `tokenCount`, `contextWindowSize`, `cwd`, `status` and `startTime` come only from `subagentStatusLine`. It outputs one `{"id","content"}` JSON line per row.
- **`tasks[].id` matches the agent id in the transcript filename:** `<dirname(transcript_path)>/<session_id>/subagents/agent-<id>.jsonl`. A `.meta.json` with `agentType` and `description` sits next to each transcript.
- **`cost.total_cost_usd` already includes subagent spend.** Across a Sonnet subagent run, the reported change was $0.556. Main + subagent priced from transcripts gave $0.564; main alone gave $0.317. The `prompt_cache` stats, by contrast, exclude subagents.
- **Pricing transcripts:**
  - Dedupe by `message.id`. Each response repeats its `usage` on every content-block line, so summing lines overcounts about 3×.
  - Advisor calls bill on their own model and appear only under `usage.iterations[type=advisor_message]`.
  - `"<synthetic>"` lines (errors, interrupts) carry all-zero usage.
  - Lines also carry `gitBranch`, `cwd` and `timestamp`.
- With those rules, list-price math matches Claude Code's own figure to within about 1%. Rates came from the `claude-api` skill, not from memory.

Testing gotcha: piping JSON from Windows PowerShell 5.1 into `node` mangles stdin. Drive test payloads from a Node `execFileSync(..., {input})` harness instead.

## Set up on another machine (e.g. the ACER laptop)

1. Save the script below as `~/.claude/statusline-command.js`. It needs Node only, no npm packages.
2. Merge these two keys into `~/.claude/settings.json`. Back it up first, and edit only these keys: the file also holds hooks and plugins.

```json
"statusLine": {
  "type": "command",
  "command": "node ~/.claude/statusline-command.js",
  "refreshInterval": 10
},
"subagentStatusLine": {
  "type": "command",
  "command": "node ~/.claude/statusline-command.js"
}
```

3. Restart Claude Code, or wait for the next status refresh. Spawn any subagent to see a row.

Script as of 2026-10-28 (316 lines). The live copy in `~/.claude/` wins if they differ:

```js
#!/usr/bin/env node
// Claude Code status line — Node.js version (no jq dependency)
// Wired to both `statusLine` and `subagentStatusLine`; the stdin shape picks the mode.
//   main:      cwd | git branch | model · effort | context % | session cost · subagent share
//   subagents: one row per agent: status name · model · effort · tokens ctx% · branch · ~cost · elapsed · label

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// --- ANSI colours ---
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BRIGHT_WHITE = '\x1b[97m';
const RESET = '\x1b[0m';

// List price, USD per MTok: [input, output, cache read]. Cache writes are 1.25x input (5m) / 2x input (1h).
// Models missing here still render, just without a dollar figure.
const PRICES = {
  'claude-fable-5-1': [10, 50, 0.25],
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-sonnet-5-5': [2, 10, 0.2],
  'claude-sonnet-5': [2, 10, 0.2],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
  'claude-opus-4-8': [5, 25, 0.5],
  'claude-opus-4-7': [5, 25, 0.5],
  'claude-opus-4-6': [5, 25, 0.5],
  'claude-sonnet-4-6': [3, 15, 0.3],
  'claude-haiku-4-5': [1, 5, 0.1],
};
// Haiku 5.5 switches rate card per request once the prompt exceeds 100K tokens.
const HAIKU_55_LONG = [0.5, 2.5, 0.05];

const CACHE_FILE_TTL_MS = 24 * 60 * 60 * 1000;

let raw = '';
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw); } catch (_) {}

  if (Array.isArray(input.tasks)) renderSubagentRows(input);
  else renderMainLine(input);
});

// --- Main status line ---
function renderMainLine(input) {
  const cwd = (input.workspace && input.workspace.current_dir) || input.cwd || '';
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const displayDir = cwd
    ? cwd.replace(home, '~').replace(/\\/g, '/') || '?'
    : '?';

  const branch = (input.worktree && input.worktree.branch) || gitBranch(cwd);

  const model = (input.model && input.model.display_name) || '';
  const effort = input.effort && input.effort.level;

  let ctxDisplay = '';
  const usedPct = input.context_window && input.context_window.used_percentage;
  if (usedPct != null) ctxDisplay = `${Math.round(100 - usedPct)}% ctx`;

  // total_cost_usd already includes subagent spend (verified against transcripts), so the
  // agent figure is a breakdown of the session total, not an addition to it.
  let costDisplay = '';
  const total = input.cost && input.cost.total_cost_usd;
  if (total) {
    costDisplay = `${BLUE}${fmtCost(total)} session${RESET}`;
    let agents = { count: 0 };
    try { agents = sessionSubagentCost(input); } catch (_) {}
    if (agents.count) {
      // "+" marks a lower bound: at least one agent ran on a model missing from PRICES.
      const share = agents.cost ? ` ~${fmtCost(agents.cost)}${agents.priced ? '' : '+'}` : '';
      costDisplay += `${DIM} · ${agents.count} agent${agents.count > 1 ? 's' : ''}${share}${RESET}`;
    }
  }

  const parts = [];
  parts.push(`${CYAN}${BOLD}${displayDir}${RESET}`);
  if (branch) parts.push(`${GREEN}${BOLD} ${branch}${RESET}`);
  if (model) parts.push(`${MAGENTA}${model}${RESET}${effort ? `${DIM} · ${RESET}${BRIGHT_WHITE}${effort}${RESET}` : ''}`);
  if (ctxDisplay) parts.push(`${YELLOW}${ctxDisplay}${RESET}`);
  if (costDisplay) parts.push(costDisplay);

  const sep = `${DIM} | ${RESET}`;
  process.stdout.write(parts.join(sep) + '\n');
}

function sessionSubagentCost(input) {
  const result = { count: 0, cost: 0, priced: true };
  const dir = subagentDir(input);
  if (!dir) return result;
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')); } catch (_) { return result; }

  const cache = loadCache('main');
  for (const f of files) {
    const stats = transcriptStats(cache, path.join(dir, f));
    result.count++;
    if (stats.unpriced) result.priced = false;
    result.cost += stats.cost;
  }
  saveCache('main', cache);
  return result;
}

// --- Subagent rows (subagentStatusLine) ---
function renderSubagentRows(input) {
  const columns = input.columns || 120;
  const dir = subagentDir(input);
  const cache = loadCache('sub');
  const branchByCwd = new Map();

  for (const task of input.tasks) {
    try {
      const stats = dir ? transcriptStats(cache, path.join(dir, `agent-${task.id}.jsonl`)) : null;
      const row = buildRow(task, stats, branchByCwd);
      process.stdout.write(JSON.stringify({ id: task.id, content: fitRow(row, task.label || task.description, columns) }) + '\n');
    } catch (_) {
      // Leave this row to Claude Code's default rendering.
    }
  }
  saveCache('sub', cache);
}

function buildRow(task, stats, branchByCwd) {
  const status = {
    running: `${YELLOW}●${RESET}`,
    completed: `${GREEN}✓${RESET}`,
    failed: `${RED}✗${RESET}`,
    killed: `${RED}✗${RESET}`,
  }[task.status] || `${DIM}○${RESET}`;
  const name = (task.name || task.agentType || 'agent').split(':').pop();

  const parts = [`${status} ${BOLD}${name}${RESET}`];

  const modelId = task.model || (stats && stats.model);
  if (modelId) parts.push(`${MAGENTA}${shortModel(modelId)}${RESET}${task.effort != null ? ` ${BRIGHT_WHITE}${task.effort}${RESET}` : ''}`);

  let tokens = fmtTokens(task.tokenCount || 0);
  if (task.contextWindowSize) tokens += ` ${Math.round((task.tokenCount / task.contextWindowSize) * 100)}%`;
  parts.push(`${YELLOW}${tokens}${RESET}`);

  let branch = stats && stats.branch;
  if (!branch && task.cwd) {
    if (!branchByCwd.has(task.cwd)) branchByCwd.set(task.cwd, gitBranch(task.cwd));
    branch = branchByCwd.get(task.cwd);
  }
  if (branch) parts.push(`${GREEN} ${branch}${RESET}`);

  if (stats && stats.cost && !stats.unpriced) parts.push(`${BLUE}~${fmtCost(stats.cost)}${RESET}`);

  const end = task.status === 'running' ? Date.now() : (stats && stats.lastTs) || Date.now();
  if (task.startTime) parts.push(`${DIM}${fmtDuration(end - task.startTime)}${RESET}`);

  return parts.join(`${DIM} · ${RESET}`);
}

// The row can't wrap, so the free-text label gets whatever width the fixed fields leave.
function fitRow(row, label, columns) {
  const room = columns - visibleLength(row) - 3;
  if (!label || room < 8) return row;
  const text = label.length > room ? `${label.slice(0, room - 1)}…` : label;
  return `${row}${DIM} · ${text}${RESET}`;
}

// --- Transcript cost, read incrementally ---
// Each API response appears on several transcript lines (one per content block) repeating the
// same usage, so cost is keyed by message.id; summing lines would overcount ~3x.
function transcriptStats(cache, file) {
  const entry = cache[file] || (cache[file] = { offset: 0, msgs: {}, unpriced: false });
  entry.seen = Date.now();

  let size = 0;
  try { size = fs.statSync(file).size; } catch (_) { return summarize(entry); }
  if (size < entry.offset) Object.assign(entry, { offset: 0, msgs: {}, unpriced: false });

  if (size > entry.offset) {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size - entry.offset);
    fs.readSync(fd, buf, 0, buf.length, entry.offset);
    fs.closeSync(fd);
    // Only consume complete lines; a running agent may be mid-write.
    const end = buf.lastIndexOf(0x0a) + 1;
    for (const line of buf.toString('utf8', 0, end).split('\n')) ingestLine(entry, line);
    entry.offset += end;
  }
  return summarize(entry);
}

function ingestLine(entry, line) {
  if (!line.includes('"usage"')) return;
  let o;
  try { o = JSON.parse(line); } catch (_) { return; }
  const msg = o.message;
  if (!msg || !msg.usage || !msg.id) return;

  let cost = priceUsage(msg.model, msg.usage);
  // Advisor calls bill on their own model and only show up under usage.iterations.
  for (const it of msg.usage.iterations || []) {
    if (it.type === 'advisor_message') cost += priceUsage(it.model, it);
  }
  if (Number.isNaN(cost)) entry.unpriced = true;
  else entry.msgs[msg.id] = cost;

  if (normalizeModel(msg.model)) entry.model = msg.model;
  if (o.gitBranch) entry.branch = o.gitBranch;
  if (o.timestamp) entry.lastTs = Date.parse(o.timestamp);
}

function summarize(entry) {
  let cost = 0;
  for (const c of Object.values(entry.msgs)) cost += c;
  return { cost, unpriced: entry.unpriced, model: entry.model, branch: entry.branch, lastTs: entry.lastTs };
}

function priceUsage(model, u) {
  const write1h = (u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || 0;
  const write5m = (u.cache_creation_input_tokens || 0) - write1h;
  const input = u.input_tokens || 0;
  const read = u.cache_read_input_tokens || 0;
  const output = u.output_tokens || 0;
  // "<synthetic>" lines (errors, interrupts) carry all-zero usage; they must not mark the agent unpriced.
  if (!input && !read && !output && !write5m && !write1h) return 0;

  const id = normalizeModel(model);
  let p = PRICES[id];
  if (!p) return NaN;
  if (id === 'claude-haiku-5-5' && input + read + write5m + write1h > 100000) p = HAIKU_55_LONG;
  const cost = (input * p[0] + output * p[1] + read * p[2] + write5m * p[0] * 1.25 + write1h * p[0] * 2) / 1e6;
  return u.speed === 'fast' ? cost * 2 : cost;
}

// Strips provider prefixes, date snapshots and [1m] suffixes: us.anthropic.claude-opus-4-8[1m] -> claude-opus-4-8
function normalizeModel(model) {
  const m = /claude-[a-z]+-\d+(?:-\d{1,2})?(?!\d)/.exec(model || '');
  return m ? m[0] : '';
}

function shortModel(model) {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(model);
  if (!m) return model;
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[3] ? `${m[2]}.${m[3]}` : m[2]}`;
}

// --- Cache (one file per mode so main and subagent runs never race on the same file) ---
function cachePath(mode) {
  return path.join(os.tmpdir(), `claude-statusline-${mode}.json`);
}

function loadCache(mode) {
  try { return JSON.parse(fs.readFileSync(cachePath(mode), 'utf8')); } catch (_) { return {}; }
}

function saveCache(mode, cache) {
  const cutoff = Date.now() - CACHE_FILE_TTL_MS;
  for (const key of Object.keys(cache)) if (!(cache[key].seen > cutoff)) delete cache[key];
  // Claude Code kills an in-flight run when the next tick starts; rename keeps the file whole.
  const file = cachePath(mode);
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, file);
  } catch (_) {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

// --- Helpers ---
function subagentDir(input) {
  if (!input.transcript_path || !input.session_id) return '';
  return path.join(path.dirname(input.transcript_path), input.session_id, 'subagents');
}

function gitBranch(cwd) {
  if (!cwd) return '';
  const opts = { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', timeout: 3000 };
  try {
    return execFileSync('git', ['-C', cwd, '--no-optional-locks', 'symbolic-ref', '--short', 'HEAD'], opts).trim();
  } catch (_) {
    try {
      return execFileSync('git', ['-C', cwd, '--no-optional-locks', 'rev-parse', '--short', 'HEAD'], opts).trim();
    } catch (_) {
      return '';
    }
  }
}

function visibleLength(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function fmtCost(usd) {
  return `$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`;
}

function fmtTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return String(n);
}

function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}
```
