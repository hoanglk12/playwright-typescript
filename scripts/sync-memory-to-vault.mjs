import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

const SEED_DIR = join(PROJECT_ROOT, '.claude', 'memory-seed');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault');

const TYPE_TO_SUBFOLDER = {
  user: '20-memory/user',
  feedback: '20-memory/feedback',
  project: '20-memory/project',
  reference: '20-memory/reference',
};

/**
 * Parse YAML frontmatter from file content.
 * Returns { frontmatter: Record<string, any>, body: string } or null if no frontmatter.
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

  const fmBlock = content.slice(4, endMatch); // between opening --- and closing ---
  const body = content.slice(endMatch + 4).replace(/^\n/, '');

  const lines = fmBlock.split('\n');
  const result = {};
  let inMetadata = false;
  const metadata = {};

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Check if we're in a metadata block (line is indented)
    const isIndented = line.startsWith('  ');

    if (inMetadata && isIndented) {
      // Parse metadata sub-key
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

    // Reset metadata mode if we hit a non-indented line
    inMetadata = false;

    // Parse top-level key: value (split on first colon only)
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

/**
 * Format a date as YYYY-MM-DD using local time (not UTC).
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build normalized frontmatter YAML string.
 */
function buildFrontmatter(parsed, fileMtime) {
  const fm = parsed.frontmatter;
  const meta = fm._metadata || {};

  // Determine type: top-level wins, else metadata.type
  const type = fm.type || meta.type || 'project';

  // Determine originSessionId
  const originSessionId = meta.originSessionId || null;

  // Preserve name and description verbatim
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

/**
 * Convert markdown links to wikilinks in MEMORY.md body.
 * [Display Text](file.md) — description → [[file|Display Text]] — description
 */
function convertToWikilinks(content) {
  // Match [Display Text](file.md) patterns
  return content.replace(
    /\[([^\]]+)\]\(([^)]+\.md)\)/g,
    (match, displayText, filePath) => {
      // Strip .md extension from the file reference
      const fileRef = filePath.replace(/\.md$/, '');
      return `[[${fileRef}|${displayText}]]`;
    }
  );
}

/**
 * Process a single memory seed file and write it to the vault.
 */
function processMemoryFile(filename, seedDir, vaultDir, today) {
  const sourcePath = join(seedDir, filename);
  const content = readFileSync(sourcePath, 'utf8');
  const fileStat = statSync(sourcePath);
  const fileMtime = fileStat.mtime;

  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter) {
    // No frontmatter — skip (MEMORY.md handled separately)
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

/**
 * Process MEMORY.md — convert md links to wikilinks, add index frontmatter.
 */
function processMemoryIndex(seedDir, vaultDir, today) {
  const sourcePath = join(seedDir, 'MEMORY.md');
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

/**
 * Ensure all type subfolders exist (with .gitkeep if empty).
 */
function ensureSubfolders(vaultDir) {
  for (const subfolder of Object.values(TYPE_TO_SUBFOLDER)) {
    const dir = join(vaultDir, subfolder);
    mkdirSync(dir, { recursive: true });
    // Create .gitkeep so git tracks the empty folder
    const gitkeepPath = join(dir, '.gitkeep');
    try {
      // Only write if it doesn't exist (avoid overwriting)
      statSync(gitkeepPath);
    } catch {
      writeFileSync(gitkeepPath, '', 'utf8');
    }
  }
}

async function main() {
  const today = formatDate(new Date());
  console.log(`\nSyncing memory seed → vault (${today})`);
  console.log(`  Source: ${SEED_DIR}`);
  console.log(`  Target: ${VAULT_DIR}\n`);

  // Ensure vault root and subfolders exist
  mkdirSync(VAULT_DIR, { recursive: true });
  ensureSubfolders(VAULT_DIR);

  // Process MEMORY.md → 00-index.md
  processMemoryIndex(SEED_DIR, VAULT_DIR, today);

  // Process all other .md files in seed dir
  const files = readdirSync(SEED_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'MEMORY.md'
  );

  for (const filename of files) {
    processMemoryFile(filename, SEED_DIR, VAULT_DIR, today);
  }

  console.log(`\nSync complete. ${files.length + 1} files processed.`);
}

try {
  await main();
} catch (err) {
  console.error('Sync failed (non-fatal):', err.message);
}
process.exit(0);
