'use strict';
// Runs sync-vault-to-lightrag.mjs and turns its output into a user-visible systemMessage.
// Stays silent when nothing changed. Used by the Stop hook directly and by sync-memory.js.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SYNC_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'sync-vault-to-lightrag.mjs');
const VAULT_DIR = path.join(PROJECT_ROOT, 'memory-vault', '20-memory');
const STATE_FILE = path.join(__dirname, '..', '.state', 'lightrag-last-sync.json');

function readLastSuccess() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).lastSuccessMs;
  } catch {
    return undefined;
  }
}

function writeLastSuccess(ms) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSuccessMs: ms }));
  } catch {}
}

function countChangedSince(dir, sinceMs) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__parsed__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countChangedSince(full, sinceMs);
    else if (entry.name.endsWith('.md') && fs.statSync(full).mtimeMs > sinceMs) count++;
  }
  return count;
}

function syncAndSummarize(timeoutMs) {
  // Taken before the run so a note written mid-sync still counts as unsynced next time.
  const startedMs = Date.now();
  const r = spawnSync(process.execPath, [SYNC_SCRIPT], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  if (r.error) {
    return r.error.code === 'ETIMEDOUT'
      ? `LightRAG sync timed out after ${Math.round(timeoutMs / 1000)}s; the next sync will retry.`
      : `LightRAG sync could not start: ${r.error.message}`;
  }
  const output = `${r.stdout || ''}${r.stderr || ''}`.trim();

  if (output.includes('LightRAG not running')) {
    const last = readLastSuccess();
    if (last === undefined) return null;
    let pending = 0;
    try {
      pending = countChangedSince(VAULT_DIR, last);
    } catch {}
    return pending > 0
      ? `LightRAG not running: ${pending} vault note(s) changed since the last sync are not indexed. Start scripts\\start-rag.bat and the next sync catches up.`
      : null;
  }

  const done = output.match(/Done — (\d+) new, (\d+) updated/);
  if (!done) {
    const lastLine = output.split('\n').pop() || `exit code ${r.status}`;
    return `LightRAG sync problem: ${lastLine.replace('[sync-vault-to-lightrag] ', '')}`;
  }

  const queued = [...output.matchAll(/^\s*(Inserted|Updated): (.+)$/gm)].map(
    (m) => `${m[2].trim()} (${m[1] === 'Inserted' ? 'new' : 'updated'})`
  );
  const failed = [...output.matchAll(/^\s*Error inserting (.+?): (.+)$/gm)].map(
    (m) => `${m[1]} (${m[2].trim().slice(0, 100)})`
  );
  if (failed.length === 0) writeLastSuccess(startedMs);

  const parts = [];
  if (queued.length) parts.push(`queued for indexing: ${queued.join(', ')}`);
  if (failed.length) parts.push(`failed: ${failed.join(', ')}`);
  return parts.length ? `LightRAG sync: ${parts.join('; ')}` : null;
}

module.exports = { syncAndSummarize };

if (require.main === module) {
  const message = syncAndSummarize(110000);
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}
