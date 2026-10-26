'use strict';
const fs = require('fs');
const path = require('path');

// Tunable constants
const THRESHOLD = 3;                  // repetitions of the same signature before nudging
const TIME_FLOOR_MS = 90 * 1000;     // 90s floor — suppresses fast intentional TDD re-runs
const EXPIRY_MS = 10 * 60 * 1000;   // 10 min — ends a nudged episode (advisor() is server-side and never reaches this hook)
const BATCH_WINDOW_MS = 30 * 1000;  // repeats this close to the last counted one are one batched change, not a retry
                                    // (slow PostToolUse hooks between batched edits can stretch a batch past 10s)
const STALE_GAP_MS = 10 * 60 * 1000; // a signature idle this long starts counting from zero

const STATE_DIR = path.join(__dirname, '..', '.state');
const TEST_RUN_RE = /npm (run )?test|npx playwright test/i;

// user-prompt-submit.js deletes this file on every real user message (resetAdvisorNudge)
function stateFile(sessionId) {
  return path.join(STATE_DIR, `advisor-nudge-${sessionId}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId), 'utf8'));
  } catch {
    return { signatures: {}, notified: false, notifiedAt: null };
  }
}

function saveState(sessionId, state) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile(sessionId), JSON.stringify(state));
}

function clearState(sessionId) {
  try { fs.unlinkSync(stateFile(sessionId)); } catch {}
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const sessionId = input.session_id || 'default';
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  // Only track test runs (Bash) and file edits (Edit/MultiEdit/Write)
  if (!['Bash', 'Edit', 'MultiEdit', 'Write'].includes(toolName)) {
    process.exit(0);
  }

  const state = loadState(sessionId);
  const now = Date.now();

  // Auto-expiry: clear the notified flag after EXPIRY_MS
  if (state.notified && state.notifiedAt && (now - state.notifiedAt) > EXPIRY_MS) {
    clearState(sessionId);
    process.exit(0);
  }

  // Already nudged this episode — stay silent
  if (state.notified) {
    process.exit(0);
  }

  // Compute signature for this tool call
  let signature = null;
  if (toolName === 'Bash') {
    const cmd = toolInput.command || '';
    if (TEST_RUN_RE.test(cmd)) signature = 'test-run';
  } else {
    const filePath = toolInput.file_path || '';
    if (filePath) signature = `edit:${path.basename(filePath)}`;
  }

  if (!signature) {
    process.exit(0);
  }

  // Timing is per signature so an earlier, unrelated file's edits can't satisfy the time floor.
  const prev = state.signatures[signature];
  // The batch window runs from the last *counted* call, so a steady stream of calls under 30s
  // apart still counts once per window instead of never.
  const entry =
    prev && typeof prev.countedTs === 'number' && now - prev.lastTs <= STALE_GAP_MS
      ? prev
      : { count: 0, firstTs: now, countedTs: 0, lastTs: 0 };
  if (now - entry.countedTs > BATCH_WINDOW_MS) {
    entry.count++;
    entry.countedTs = now;
  }
  entry.lastTs = now;
  state.signatures[signature] = entry;

  const count = entry.count;
  const elapsed = now - entry.firstTs;

  if (count >= THRESHOLD && elapsed >= TIME_FLOOR_MS) {
    state.notified = true;
    state.notifiedAt = now;
    saveState(sessionId, state);

    const minutes = Math.round(elapsed / 60000);
    const what = signature === 'test-run'
      ? `run the same test ${count}× without resolution`
      : `edited the same file (${path.basename(signature.replace('edit:', ''))}) ${count}× without resolution`;

    emit({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `## ⚠️ Stuck Loop Detected — Call advisor() Now\n\n` +
          `You have ${what} over the past ${minutes} minute${minutes !== 1 ? 's' : ''}. ` +
          `This is a stuck debugging loop.\n\n` +
          `**STOP. Call the \`advisor()\` tool before any further edits, test runs, or diagnostic scripts.** ` +
          `It forwards your full conversation history to a stronger reviewer and will identify the root cause ` +
          `faster than another iteration cycle.\n\n` +
          `This nudge stays silent for the next 10 minutes.`,
      },
    });
  } else {
    saveState(sessionId, state);
    process.exit(0);
  }
});
