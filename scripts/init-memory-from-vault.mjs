/**
 * Bootstrap Claude Code live memory from the committed vault.
 * Run once on a new machine after cloning:
 *   node scripts/init-memory-from-vault.mjs
 *
 * Reads memory-vault/20-memory/** and memory-vault/00-index.md,
 * writes them into ~/.claude/projects/{encoded}/memory/ so Claude Code
 * picks them up at the next session start.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault');
const MEMORY_SUBDIR = join(VAULT_DIR, '20-memory');
const INDEX_FILE = join(VAULT_DIR, '00-index.md');

// Same encoding Claude Code uses for the project path
const encoded = PROJECT_ROOT.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+/, '');
const MEMORY_DIR = join(homedir(), '.claude', 'projects', encoded, 'memory');

function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return content;
  return content.slice(endIdx + 4).replace(/^\n/, '');
}

// [[filename|Display Text]] → [Display Text](filename.md)
function wikilinksToMarkdown(content) {
  return content.replace(
    /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
    (_, fileRef, displayText) => `[${displayText}](${fileRef}.md)`,
  );
}

function collectVaultFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.gitkeep' || entry === '__parsed__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectVaultFiles(full));
    } else if (entry.endsWith('.md')) {
      results.push({ name: entry, path: full });
    }
  }
  return results;
}

async function main() {
  if (!existsSync(MEMORY_SUBDIR)) {
    console.error(`  Vault not found at ${MEMORY_SUBDIR}`);
    console.error('  Run: node scripts/sync-memory-to-vault.mjs first to populate the vault.');
    process.exit(1);
  }

  if (existsSync(MEMORY_DIR)) {
    const existing = readdirSync(MEMORY_DIR).filter((f) => f.endsWith('.md'));
    if (existing.length > 0) {
      console.log(`  Live memory already exists at ${MEMORY_DIR} (${existing.length} files).`);
      console.log('  Overwriting with vault contents...\n');
    }
  }

  mkdirSync(MEMORY_DIR, { recursive: true });
  console.log(`\nBootstrapping live memory from vault`);
  console.log(`  Source: ${VAULT_DIR}`);
  console.log(`  Target: ${MEMORY_DIR}\n`);

  // 00-index.md → MEMORY.md (strip vault frontmatter, convert wikilinks back to md links)
  const indexContent = readFileSync(INDEX_FILE, 'utf8');
  const indexBody = stripFrontmatter(indexContent);
  const indexMarkdown = wikilinksToMarkdown(indexBody);
  writeFileSync(join(MEMORY_DIR, 'MEMORY.md'), indexMarkdown, 'utf8');
  console.log('  Written: MEMORY.md');

  // All memory note files (flattened — live memory is a flat directory)
  const files = collectVaultFiles(MEMORY_SUBDIR);
  for (const { name, path } of files) {
    const content = readFileSync(path, 'utf8');
    writeFileSync(join(MEMORY_DIR, name), content, 'utf8');
    console.log(`  Written: ${name}`);
  }

  console.log(`\nBootstrap complete. ${files.length + 1} files written to ${MEMORY_DIR}`);
  console.log('  Start a new Claude Code session to pick up the bootstrapped memory.');
}

try {
  await main();
} catch (err) {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
}
