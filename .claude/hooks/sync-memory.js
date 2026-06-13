/**
 * PostToolUse hook: sync vault when Claude Code writes a memory file.
 *
 * Triggers when Write/Edit/MultiEdit touches a file under:
 *   ~/.claude/projects/{encoded}/memory/*.md  (live auto-memory)
 *
 * Runs sync-memory-to-vault.mjs which reads directly from the live memory path.
 * LightRAG sync is handled separately by the Stop hook (intentionally slower path).
 */

const { resolve } = require('path');
const { spawnSync } = require('child_process');

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = ((input.tool_input || {}).file_path || '').replace(/\\/g, '/');

    if (!filePath.endsWith('.md')) {
      process.exit(0);
      return;
    }

    const projectRoot = resolve(__dirname, '..', '..');
    const projectRootFwd = projectRoot.replace(/\\/g, '/');

    // Only trigger on auto-memory writes (outside project root, under .claude/projects/.../memory/)
    const isAutoMemory =
      filePath.includes('/.claude/projects/') &&
      filePath.includes('/memory/') &&
      !filePath.startsWith(projectRootFwd);

    if (!isAutoMemory) {
      process.exit(0);
      return;
    }

    // Sync live memory → vault directly (no seed intermediary)
    spawnSync('node', ['scripts/sync-memory-to-vault.mjs'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
