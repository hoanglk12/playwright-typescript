#!/usr/bin/env node
'use strict';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch (_) { process.exit(0); }

  // Handle multiple possible batch schemas
  const calls = input.tool_calls || input.tool_uses || input.results || [];
  if (!Array.isArray(calls) || calls.length === 0) process.exit(0);

  const tsFiles = new Set();
  for (const call of calls) {
    const name = call.tool_name || call.name || '';
    const inp = call.tool_input || call.input || {};
    const fp = inp.file_path || '';
    if (/^(Write|Edit|MultiEdit)$/.test(name) && (fp.endsWith('.ts') || fp.endsWith('.tsx'))) {
      tsFiles.add(fp);
    }
  }

  if (tsFiles.size === 0) process.exit(0);

  const { spawnSync } = require('child_process');
  const result = spawnSync('npx', ['tsc', '--noEmit'], {
    encoding: 'utf8',
    shell: true,
    cwd: process.cwd(),
  });

  const tscOutput = ((result.stdout || '') + (result.stderr || '')).trim();
  const n = tsFiles.size;
  const label = `Batch TypeScript check (${n} file${n !== 1 ? 's' : ''})`;

  if (result.status !== 0) {
    const errors = tscOutput
      .split('\n')
      .filter(l => /error TS\d+/.test(l))
      .slice(0, 5)
      .join('\n');
    const count = tscOutput.split('\n').filter(l => /error TS\d+/.test(l)).length;
    const msg = `${label}: ${count} error${count !== 1 ? 's' : ''}\n${errors}`;
    process.stdout.write(JSON.stringify({ systemMessage: msg }));
  } else {
    process.stdout.write(JSON.stringify({ systemMessage: `${label}: ✓` }));
  }

  process.exit(0);
});
