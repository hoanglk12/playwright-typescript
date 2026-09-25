'use strict';

const { spawnSync } = require('child_process');

const FETCH_TIMEOUT_MS = 8000;

function git(args, cwd, timeout = 3000) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    // Hooks have no terminal: a git or Git Credential Manager prompt would block until the timeout.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  });
  return r.status === 0 ? (r.stdout || '').trim() : null;
}

function plural(n) {
  return `${n} commit${n === 1 ? '' : 's'}`;
}

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw); } catch {}
  const cwd = input.cwd || process.cwd();

  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd);
  if (!upstream) process.exit(0);

  if (git(['fetch', '--quiet'], cwd, FETCH_TIMEOUT_MS) === null) process.exit(0);

  const counts = git(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], cwd);
  const [ahead, behind] = (counts || '0 0').split(/\s+/).map(Number);
  if (!behind) process.exit(0);

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) || 'HEAD';
  const dirty = !!git(['status', '--porcelain'], cwd);

  let msg = `${branch} is ${plural(behind)} behind ${upstream}`;
  if (ahead) msg += ` and ${plural(ahead)} ahead (diverged)`;
  msg += ' — run git pull before editing.';
  if (dirty) msg += ' Uncommitted changes present: commit or stash first.';

  process.stdout.write(JSON.stringify({
    systemMessage: `Git: ${msg}`,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `Git: ${msg} Tell the user before editing files; do not pull without their go-ahead.`,
    },
  }));
  process.exit(0);
});
