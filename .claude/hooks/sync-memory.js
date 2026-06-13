/**
 * PostToolUse hook: sync memory files to vault on write.
 *
 * Triggers when Write/Edit/MultiEdit touches:
 *   - auto-memory dir: ~/.claude/projects/{encoded}/memory/*.md  → copy to .claude/memory-seed/ then sync
 *   - memory-seed dir: .claude/memory-seed/*.md                  → sync vault only
 *
 * Intentionally skips LightRAG (slow, handled by the Stop hook).
 */

const { resolve, join, basename } = require('path');
const { existsSync, copyFileSync, mkdirSync } = require('fs');
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
    const memorySeedDir = join(projectRoot, '.claude', 'memory-seed');

    const isMemorySeed = filePath.includes('/.claude/memory-seed/');
    // Auto-memory lives outside the project root, under ~/.claude/projects/.../memory/
    const isAutoMemory =
      filePath.includes('/.claude/projects/') &&
      filePath.includes('/memory/') &&
      !filePath.startsWith(projectRootFwd);

    if (!isMemorySeed && !isAutoMemory) {
      process.exit(0);
      return;
    }

    // Auto-memory → copy to memory-seed so the sync script picks it up
    if (isAutoMemory) {
      const fileName = basename(filePath);
      const destPath = join(memorySeedDir, fileName);
      mkdirSync(memorySeedDir, { recursive: true });
      if (existsSync(filePath.replace(/\//g, '\\'))) {
        copyFileSync(filePath.replace(/\//g, '\\'), destPath);
      }
    }

    // Run vault sync (memory-seed → memory-vault/)
    spawnSync('node', ['scripts/sync-memory-to-vault.mjs'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
