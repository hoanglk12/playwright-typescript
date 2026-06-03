#!/usr/bin/env node
'use strict';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch (_) { process.exit(0); }

  const toolName = input.tool_name || '';
  const filePath = (input.tool_input || {}).file_path || '';
  const error = input.error || 'unknown error';

  const isFileOp = /^(Write|Edit|MultiEdit)$/.test(toolName);
  const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  if (!isFileOp || !isTs) process.exit(0);

  const { spawnSync } = require('child_process');
  const result = spawnSync('npx', ['tsc', '--noEmit'], {
    encoding: 'utf8',
    shell: true,
    cwd: process.cwd(),
  });

  const tscOutput = ((result.stdout || '') + (result.stderr || '')).trim();
  const errors = tscOutput
    .split('\n')
    .filter(l => /error TS\d+/.test(l))
    .slice(0, 5)
    .join('\n');

  const lines = [
    `${toolName} failed on: ${filePath}`,
    `Reason: ${error}`,
    errors ? `\nCurrent TypeScript errors:\n${errors}` : '\n(No TypeScript errors found)',
  ];

  process.stdout.write(JSON.stringify({ systemMessage: lines.join('\n') }));
  process.exit(0);
});
