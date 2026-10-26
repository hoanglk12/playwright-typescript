'use strict';
// PostToolUse (Write|Edit|MultiEdit): parse an edited .yml/.yaml file and report syntax errors.
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw); } catch {}
  const file = (input.tool_input || {}).file_path || '';
  if (!/\.ya?ml$/i.test(file)) process.exit(0);

  // Loaded in-process: spawnSync('npx', ...) can't start npx.cmd on Windows without a shell.
  try {
    const yaml = require(path.join(PROJECT_ROOT, 'node_modules', 'js-yaml'));
    yaml.loadAll(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.name === 'YAMLException') {
      const msg = `YAML syntax error in ${file}:\n${e.message}`;
      // systemMessage only reaches the user; additionalContext is what Claude sees.
      process.stdout.write(JSON.stringify({
        systemMessage: msg,
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg },
      }));
    }
  }
  process.exit(0);
});
