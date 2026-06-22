#!/usr/bin/env node
/**
 * scripts/bulk-ingest-jira.mjs
 *
 * Bulk-ingests GRA Jira Stories and Epics into memory-vault/20-memory/project/jira/.
 * Each issue becomes a separate vault note queryable via LightRAG hybrid search.
 *
 * Usage:
 *   JIRA_EMAIL=you@example.com JIRA_API_TOKEN=xxx node scripts/bulk-ingest-jira.mjs
 *   node scripts/bulk-ingest-jira.mjs --dry-run          # count only, no writes
 *   node scripts/bulk-ingest-jira.mjs --force            # overwrite existing files
 *   node scripts/bulk-ingest-jira.mjs --limit=20         # stop after N issues (for testing)
 *   node scripts/bulk-ingest-jira.mjs --jql="project = GRA AND ..."  # custom JQL
 *
 * Get a Jira API token at:
 *   https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * After running, sync to LightRAG:
 *   node scripts/sync-vault-to-lightrag.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dir, '..');

const CLOUD_ID = '48e4df75-4abf-4aa1-86ad-aeb5d4ddbd30';
const JIRA_BASE = `https://api.atlassian.com/ex/jira/${CLOUD_ID}/rest/api/3`;
const DEFAULT_JQL = 'project = GRA AND issuetype in (Story, Epic) ORDER BY created ASC';
const BATCH_SIZE = 50;
const DELAY_MS = 400; // rate-limit: pause between pages
const OUT_DIR = join(PROJECT_ROOT, 'memory-vault', '20-memory', 'project', 'jira');
const JIRA_WEB = 'https://accentgr.atlassian.net/browse';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0');
const JQL = args.find(a => a.startsWith('--jql='))?.split('=').slice(1).join('=') ?? DEFAULT_JQL;

// ── Auth ──────────────────────────────────────────────────────────────────────
const email = process.env.JIRA_EMAIL;
const token = process.env.JIRA_API_TOKEN;
if (!email || !token) {
  console.error('❌  Missing env vars. Export JIRA_EMAIL and JIRA_API_TOKEN before running.');
  console.error('   Get a token: https://id.atlassian.com/manage-profile/security/api-tokens');
  process.exit(1);
}
const AUTH = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

// ── ADF (Atlassian Document Format) → plain markdown ─────────────────────────
function adfToText(node, depth = 0, listIndex = null) {
  if (!node) return '';

  // Recurse into children with same depth
  const ch = (d = depth) => (node.content ?? []).map(c => adfToText(c, d)).join('');

  switch (node.type) {
    case 'doc':
      return (node.content ?? [])
        .map(c => adfToText(c))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    case 'text': {
      let t = node.text ?? '';
      for (const m of node.marks ?? []) {
        if (m.type === 'link') t += ` (${m.attrs?.href ?? ''})`;
        if (m.type === 'code') t = `\`${t}\``;
      }
      return t;
    }

    case 'paragraph':   return ch() + '\n';
    case 'hardBreak':   return '\n';
    case 'heading':     return `${'#'.repeat(node.attrs?.level ?? 2)} ${ch()}\n`;

    case 'bulletList':
      return (node.content ?? []).map(c => adfToText(c, depth + 1, null)).join('') + '\n';

    case 'orderedList':
      return (node.content ?? []).map((c, i) => adfToText(c, depth + 1, i + 1)).join('') + '\n';

    case 'listItem': {
      const indent = '  '.repeat(Math.max(0, depth - 1));
      const bullet = listIndex !== null ? `${listIndex}. ` : '- ';
      const inner = (node.content ?? [])
        .map(c => adfToText(c, depth))
        .join('')
        .trimEnd();
      return indent + bullet + inner + '\n';
    }

    case 'codeBlock':   return '```\n' + ch() + '\n```\n';
    case 'blockquote':  return (node.content ?? []).map(c => '> ' + adfToText(c, depth)).join('');
    case 'table':       return '*(table — view in Jira)*\n';

    // Skip images/attachments
    case 'mediaSingle':
    case 'mediaGroup':
    case 'media':       return '';

    case 'inlineCard':  return node.attrs?.url ?? '';
    case 'mention':     return `@${node.attrs?.text ?? node.attrs?.id ?? ''}`;
    case 'emoji':       return node.attrs?.text ?? '';
    case 'rule':        return '\n---\n';

    // Pass-through inline marks
    case 'strong':
    case 'em':
    default:            return ch();
  }
}

// ── Vault note formatter ──────────────────────────────────────────────────────
function formatNote(issue) {
  const f = issue.fields;
  const key = issue.key;
  const summary = (f.summary ?? '').replace(/"/g, "'");
  const type = f.issuetype?.name ?? 'Unknown';
  const status = f.status?.name ?? 'Unknown';
  const statusCat = f.status?.statusCategory?.name ?? '';
  const priority = f.priority?.name ?? '';
  const labels = (f.labels ?? []).join(', ') || 'none';
  const assignee = f.assignee?.displayName ?? 'Unassigned';
  const reporter = f.reporter?.displayName ?? '';
  const created = (f.created ?? '').slice(0, 10);
  const updated = (f.updated ?? '').slice(0, 10);
  const url = `${JIRA_WEB}/${key}`;
  const description = f.description ? adfToText(f.description) : '*(No description)*';
  const today = new Date().toISOString().slice(0, 10);
  const tagType = type === 'Epic' ? 'epic' : 'story';

  return `---
name: jira-${key.toLowerCase()}
description: "${key} [${type}] ${summary} — ${priority} | ${status}"
type: project
tags: [memory, project, jira, gra, ${tagType}]
jira_key: ${key}
jira_url: ${url}
jira_status: ${status}
jira_status_category: ${statusCat}
jira_priority: ${priority}
jira_assignee: ${assignee}
jira_labels: ${labels}
jira_created: ${created}
jira_updated: ${updated}
last_verified: ${today}
---

# ${key} — ${summary}

| Field | Value |
|---|---|
| Type | ${type} |
| Status | **${status}** (${statusCat}) |
| Priority | ${priority} |
| Assignee | ${assignee} |
| Reporter | ${reporter} |
| Labels | ${labels} |
| Created | ${created} |
| Updated | ${updated} |
| Jira | [${key}](${url}) |

## Description

${description}
`.trimEnd() + '\n';
}

// ── Jira API pagination ───────────────────────────────────────────────────────
async function fetchPage(jql, nextPageToken) {
  const body = {
    jql,
    maxResults: BATCH_SIZE,
    fields: ['summary', 'description', 'issuetype', 'status', 'priority', 'labels', 'assignee', 'reporter', 'created', 'updated'],
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;

  const res = await fetch(`${JIRA_BASE}/search/jql`, {
    method: 'POST',
    headers: { Authorization: AUTH, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jira API ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const modeLabel = DRY_RUN
    ? 'DRY RUN (no writes)'
    : FORCE
    ? 'FORCE (overwrite existing)'
    : 'INCREMENTAL (skip existing)';

  console.log('\n🔍 GRA Jira Bulk Ingestion');
  console.log(`   JQL  : ${JQL}`);
  console.log(`   Mode : ${modeLabel}`);
  if (LIMIT) console.log(`   Limit: ${LIMIT} issues`);
  console.log(`   Out  : ${OUT_DIR}`);
  console.log('');

  if (!DRY_RUN && !existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
    console.log(`📁 Created output directory\n`);
  }

  let written = 0;
  let skipped = 0;
  let errors = 0;
  let nextPageToken;

  while (true) {
    const processed = written + skipped + errors;
    if (LIMIT && processed >= LIMIT) break;

    let page;
    try {
      page = await fetchPage(JQL, nextPageToken);
    } catch (e) {
      console.error(`\n❌ Fetch failed: ${e.message}`);
      process.exit(1);
    }

    const issues = page.issues ?? [];
    if (issues.length === 0) break;

    for (const issue of issues) {
      const processedNow = written + skipped + errors;
      if (LIMIT && processedNow >= LIMIT) break;

      const filename = `jira-${issue.key.toLowerCase()}.md`;
      const filepath = join(OUT_DIR, filename);
      const exists = existsSync(filepath);

      if (exists && !FORCE && !DRY_RUN) {
        skipped++;
        continue;
      }

      try {
        const content = formatNote(issue);

        if (!DRY_RUN) {
          writeFileSync(filepath, content, 'utf8');
        }

        written++;
        const icon = DRY_RUN ? '🔍' : exists ? '🔄' : '✅';
        const title = (issue.fields.summary ?? '').slice(0, 60);
        const status = issue.fields.status?.name ?? '';
        console.log(`${icon} ${issue.key.padEnd(9)} [${status.padEnd(20)}]  ${title}`);
      } catch (e) {
        errors++;
        console.error(`❌ ${issue.key}: ${e.message}`);
      }
    }

    if (page.isLast || !page.nextPageToken) break;
    nextPageToken = page.nextPageToken;

    // Pause between pages to avoid rate-limiting
    await sleep(DELAY_MS);
  }

  const total_processed = written + skipped + errors;
  console.log('\n─────────────────────────────────────────────────────');
  console.log(`✅ Written    : ${written}`);
  if (skipped > 0) console.log(`⏭️  Skipped    : ${skipped}  (already exist — use --force to refresh)`);
  if (errors > 0)  console.log(`❌ Errors     : ${errors}`);
  console.log(`📦 Total seen : ${total_processed}`);

  if (!DRY_RUN && written > 0) {
    console.log('\n📡 Sync new notes to LightRAG:');
    console.log('   node scripts/sync-vault-to-lightrag.mjs');
    console.log('\n   Or via npm:');
    console.log('   npm run sync:vault');
  }
}

main().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
