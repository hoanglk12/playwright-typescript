'use strict';
const fs = require('fs');
const path = require('path');

// Tunable constants
const THRESHOLD = 3;                  // repetitions of the same signature before nudging
const TIME_FLOOR_MS = 90 * 1000;     // 90s floor — suppresses fast intentional TDD re-runs
const EXPIRY_MS = 10 * 60 * 1000;   // 10 min — self-heal if advisor tool call doesn't reset state

const STATE_DIR = path.join(__dirname, '..', '.state');
const TEST_RUN_RE = /npm (run )?test|npx playwright test/i;

function stateFile(sessionId) {
  return path.join(STATE_DIR, `advisor-nudge-${sessionId}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId), 'utf8'));
  } catch {
    return { signatures: {}, firstSignalTs: null, notified: false, notifiedAt: null };
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

  // Reset counter whenever Claude consults the advisor
  if (toolName === 'advisor') {
    clearState(sessionId);
    process.exit(0);
  }

  // Only track test runs (Bash) and file edits (Edit/MultiEdit/Write)
  if (!['Bash', 'Edit', 'MultiEdit', 'Write'].includes(toolName)) {
    process.exit(0);
  }

  const state = loadState(sessionId);
  const now = Date.now();

  // Auto-expiry: clear notified flag after EXPIRY_MS in case advisor tool didn't fire
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

  // Increment count and record first-signal timestamp
  state.signatures[signature] = (state.signatures[signature] || 0) + 1;
  if (!state.firstSignalTs) state.firstSignalTs = now;

  const count = state.signatures[signature];
  const elapsed = now - state.firstSignalTs;

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
          `After calling advisor(), the counter resets automatically.`,
      },
    });
  } else {
    saveState(sessionId, state);
    process.exit(0);
  }
});
