'use strict';
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', '.state');
const AGENT_FILE_RE = /(^|\/)\.claude\/agents\/[^/]+\.md$/i;
const CLAUDE_MD_RE = /(^|\/)CLAUDE\.md$/i;
const VAULT_WRITE_RE = /(^|\/)memory-vault\/20-memory\//i;
const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit']);

function stateFile(sessionId) {
  return path.join(STATE_DIR, `vault-capture-nudge-${sessionId}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId), 'utf8'));
  } catch {
    return { notified: false };
  }
}

function saveState(sessionId, state) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile(sessionId), JSON.stringify(state));
}

function normalize(filePath) {
  return (filePath || '').replace(/\\/g, '/');
}

function collectToolUses(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectToolUses(item, out);
    return;
  }
  if (node.type === 'tool_use' && typeof node.name === 'string') {
    out.push(node);
  }
  for (const key of Object.keys(node)) {
    collectToolUses(node[key], out);
  }
}

function scanTranscript(transcriptPath) {
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null;
  }

  const result = { advisorCalled: false, agentFileEdited: false, vaultWritten: false };
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const toolUses = [];
    collectToolUses(entry, toolUses);
    for (const use of toolUses) {
      if (use.name === 'advisor') {
        result.advisorCalled = true;
        continue;
      }
      if (!EDIT_TOOL_NAMES.has(use.name)) continue;
      const filePath = normalize(use.input && use.input.file_path);
      if (!filePath) continue;
      if (AGENT_FILE_RE.test(filePath) || CLAUDE_MD_RE.test(filePath)) result.agentFileEdited = true;
      if (VAULT_WRITE_RE.test(filePath)) result.vaultWritten = true;
    }
  }

  return result;
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
  const state = loadState(sessionId);

  if (state.notified) {
    process.exit(0);
  }

  const signal = input.transcript_path ? scanTranscript(input.transcript_path) : null;
  if (!signal || (!signal.advisorCalled && !signal.agentFileEdited) || signal.vaultWritten) {
    process.exit(0);
  }

  state.notified = true;
  saveState(sessionId, state);

  const what = signal.advisorCalled && signal.agentFileEdited
    ? 'an advisor() consult and an edit to an agent-definition or CLAUDE.md file'
    : signal.advisorCalled
      ? 'an advisor() consult'
      : 'an edit to an agent-definition or CLAUDE.md file';

  const reason =
    `This session included ${what}. Consider whether a memory-vault note under ` +
    `memory-vault/20-memory/{feedback,project}/ should capture the lesson before ending — ` +
    `if not clearly needed, proceed to stop.`;

  emit({
    decision: 'block',
    reason,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: reason,
    },
  });
});
