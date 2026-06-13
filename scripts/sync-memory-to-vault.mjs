import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

// Compute live memory path using the same encoding Claude Code applies to the project path:
// replace every non-alphanumeric-non-hyphen character with '-', strip any leading dashes.
const encoded = PROJECT_ROOT.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+/, '');
const LIVE_MEMORY_DIR = join(homedir(), '.claude', 'projects', encoded, 'memory');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault');

const TYPE_TO_SUBFOLDER = {
  user: '20-memory/user',
  feedback: '20-memory/feedback',
  project: '20-memory/project',
  reference: '20-memory/reference',
};

/**
 * Parse YAML frontmatter from file content.
 * Handles Shape A (top-level type), Shape B (metadata with node_type + type + originSessionId),
 * and Shape C (metadata with only type).
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const endMatch = content.indexOf('\n---', 3);
  if (endMatch === -1) {
    return { frontmatter: null, body: content };
  }

  const fmBlock = content.slice(4, endMatch);
  const body = content.slice(endMatch + 4).replace(/^\n/, '');

  const lines = fmBlock.split('\n');
  const result = {};
  let inMetadata = false;
  const metadata = {};

  for (const line of lines) {
    if (line.trim() === '') continue;

    const isIndented = line.startsWith('  ');

    if (inMetadata && isIndented) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (key && value) {
          metadata[key] = value;
        }
      }
      continue;
    }

    inMetadata = false;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'metadata') {
      inMetadata = true;
      continue;
    }

    if (key) {
      result[key] = value;
    }
  }

  if (Object.keys(metadata).length > 0) {
    result._metadata = metadata;
  }

  return { frontmatter: result, body };
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildFrontmatter(parsed, fileMtime) {
  const fm = parsed.frontmatter;
  const meta = fm._metadata || {};

  const type = fm.type || meta.type || 'project';
  const originSessionId = meta.originSessionId || null;
  const name = fm.name || '';
  const description = fm.description || '';
  const lastVerified = formatDate(fileMtime);

  const lines = ['---'];
  if (name) lines.push(`name: ${name}`);
  if (description) lines.push(`description: ${description}`);
  lines.push(`type: ${type}`);
  lines.push(`tags: [memory, ${type}]`);
  if (originSessionId) lines.push(`source_session: ${originSessionId}`);
  lines.push(`last_verified: ${lastVerified}`);
  lines.push('---');

  return lines.join('\n');
}

function convertToWikilinks(content) {
  return content.replace(
    /\[([^\]]+)\]\(([^)]+\.md)\)/g,
    (match, displayText, filePath) => {
      const fileRef = filePath.replace(/\.md$/, '');
      return `[[${fileRef}|${displayText}]]`;
    }
  );
}

function processMemoryFile(filename, sourceDir, vaultDir, today) {
  const sourcePath = join(sourceDir, filename);
  const content = readFileSync(sourcePath, 'utf8');
  const fileMtime = statSync(sourcePath).mtime;

  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter) {
    return null;
  }

  const meta = parsed.frontmatter._metadata || {};
  const type = parsed.frontmatter.type || meta.type || 'project';

  const subfolder = TYPE_TO_SUBFOLDER[type] || '20-memory/project';
  const destDir = join(vaultDir, subfolder);
  mkdirSync(destDir, { recursive: true });

  const normalizedFm = buildFrontmatter(parsed, fileMtime);
  const finalContent = normalizedFm + '\n' + parsed.body;

  const destPath = join(destDir, filename);
  writeFileSync(destPath, finalContent, 'utf8');
  console.log(`  Written: ${subfolder}/${filename}`);

  return { type, subfolder, filename };
}

function processMemoryIndex(sourceDir, vaultDir, today) {
  const sourcePath = join(sourceDir, 'MEMORY.md');
  const content = readFileSync(sourcePath, 'utf8');

  const withWikilinks = convertToWikilinks(content);

  const indexFrontmatter = [
    '---',
    'type: index',
    'tags: [memory, index]',
    `last_verified: ${today}`,
    '---',
  ].join('\n');

  const finalContent = indexFrontmatter + '\n' + withWikilinks;

  const destPath = join(vaultDir, '00-index.md');
  writeFileSync(destPath, finalContent, 'utf8');
  console.log(`  Written: 00-index.md`);
}

function ensureSubfolders(vaultDir) {
  for (const subfolder of Object.values(TYPE_TO_SUBFOLDER)) {
    const dir = join(vaultDir, subfolder);
    mkdirSync(dir, { recursive: true });
    const gitkeepPath = join(dir, '.gitkeep');
    try {
      statSync(gitkeepPath);
    } catch {
      writeFileSync(gitkeepPath, '', 'utf8');
    }
  }
}

async function main() {
  const today = formatDate(new Date());
  console.log(`\nSyncing live memory → vault (${today})`);
  console.log(`  Source: ${LIVE_MEMORY_DIR}`);
  console.log(`  Target: ${VAULT_DIR}\n`);

  if (!existsSync(LIVE_MEMORY_DIR)) {
    console.log('  Live memory dir not found — run: node scripts/init-memory-from-vault.mjs');
    process.exit(0);
  }

  mkdirSync(VAULT_DIR, { recursive: true });
  ensureSubfolders(VAULT_DIR);

  processMemoryIndex(LIVE_MEMORY_DIR, VAULT_DIR, today);

  const files = readdirSync(LIVE_MEMORY_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'MEMORY.md'
  );

  for (const filename of files) {
    processMemoryFile(filename, LIVE_MEMORY_DIR, VAULT_DIR, today);
  }

  console.log(`\nSync complete. ${files.length + 1} files processed.`);
}

try {
  await main();
} catch (err) {
  console.error('Sync failed (non-fatal):', err.message);
}
process.exit(0);
