/**
 * PostToolUse hook: sync vault to LightRAG when a memory vault file is written.
 *
 * Triggers when Write/Edit/MultiEdit touches a file under:
 *   memory-vault/20-memory/**  (the vault — authoritative source)
 *
 * The seed directory (~/.claude/projects/.../memory/) is deprecated.
 * Claude Code writes memory notes directly to memory-vault/20-memory/{type}/.
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

    // Only trigger on vault memory writes (inside project, under memory-vault/20-memory/)
    const isVaultMemory =
      filePath.startsWith(projectRootFwd) &&
      filePath.includes('/memory-vault/20-memory/');

    if (!isVaultMemory) {
      process.exit(0);
      return;
    }

    // Sync vault → LightRAG
    spawnSync('node', ['scripts/sync-vault-to-lightrag.mjs'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
