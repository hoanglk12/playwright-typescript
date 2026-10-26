'use strict';
// Stop hook (asyncRewake): runs up to 3 modified spec files and wakes Claude with the tail of the
// output when one fails. Each spec runs once per content change, so a spec that fails against
// staging doesn't rerun, and rewake, at the end of every turn until it's edited again.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
// Playwright's own CLI: spawnSync('npx', ...) can't start npx.cmd on Windows without a shell.
const PLAYWRIGHT_CLI = path.join(PROJECT_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const STATE_FILE = path.join(__dirname, '..', '.state', 'run-changed-specs.json');
const MAX_SPECS = 3;
const BUDGET_MS = 280 * 1000; // under the 300s settings.json timeout
const TAIL_LINES = 60;

function changedSpecs() {
  const r = spawnSync(
    'git',
    ['--no-optional-locks', 'status', '--porcelain', '-z', '--no-renames', '-uall'],
    { cwd: PROJECT_ROOT, encoding: 'utf8' }
  );
  if (r.status !== 0) return [];
  return r.stdout
    .split('\0')
    .filter(entry => entry.length > 3 && !entry.slice(0, 2).includes('D'))
    .map(entry => entry.slice(3))
    .filter(file => file.endsWith('.spec.ts'));
}

function contentHash(file) {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(path.join(PROJECT_ROOT, file))).digest('hex');
  } catch {
    return null;
  }
}

function playwrightArgs(file) {
  let target;
  if (file === 'tests/api/security-posture.spec.ts') {
    // Kept out of api.config.ts on purpose; only security-patch.config.ts matches it.
    target = ['--config=security-patch.config.ts', '--project=pla-au'];
  } else if (file.startsWith('tests/api/')) {
    // API specs only exist in api.config.ts; one GRA brand plus misc-api covers every spec family there.
    target = ['--config=api.config.ts', '--project=pla-au', '--project=misc-api'];
  } else {
    target = ['--project=chromium'];
  }
  return [PLAYWRIGHT_CLI, 'test', file, ...target, '--reporter=list', '--pass-with-no-tests'];
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {}
}

const specs = changedSpecs().filter(file =>
  // Ecommerce specs sign in to staging storefronts and need the shared test password.
  file.includes('/ecommerce/') ? !!process.env.GRA_TEST_PASSWORD : true
);
if (!specs.length) process.exit(0);

const lastRun = loadState();
// Only specs still dirty with unchanged content keep their record, so the file can't grow forever.
const state = {};
const toRun = [];
for (const file of specs) {
  const hash = contentHash(file);
  if (!hash) continue;
  if (lastRun[file] === hash) state[file] = hash;
  else if (toRun.length < MAX_SPECS) toRun.push({ file, hash });
}
saveState(state);

const deadline = Date.now() + BUDGET_MS;
const failures = [];
for (const { file, hash } of toRun) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) break;
  // Recorded before the run so one cut off by the hook timeout isn't retried on the next Stop.
  state[file] = hash;
  saveState(state);
  const r = spawnSync(process.execPath, playwrightArgs(file), {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: remaining,
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.status === 0) continue;
  const output = `${r.stdout || ''}${r.stderr || ''}`.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');
  const reason = r.error ? r.error.code || r.error.message : `exit code ${r.status}`;
  failures.push(`### ${file} (${reason})\n${output}`);
}

if (failures.length) {
  process.stderr.write(`Changed spec run failed:\n\n${failures.join('\n\n')}\n`);
  process.exit(2);
}
process.exit(0);
