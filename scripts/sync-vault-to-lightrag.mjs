// Syncs vault notes to LightRAG.
// For new files: inserts via POST /documents/text (bypasses file-tracker).
// For changed files: deletes old doc then re-inserts.
// Uses POST /documents/text with file_source — the only reliable insert path
// (scan misses changed files; MCP insert_document omits required file_source field).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault', '20-memory');
const LIGHTRAG_URL = 'http://localhost:9621';

function getVaultFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__parsed__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...getVaultFiles(full));
    } else if (entry.endsWith('.md')) {
      const content = readFileSync(full, 'utf8');
      results.push({ name: entry, path: full, contentLength: content.length, content });
    }
  }
  return results;
}

async function insertDoc(text, fileSource) {
  const res = await fetch(`${LIGHTRAG_URL}/documents/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, file_source: fileSource }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${txt.slice(0, 120)}`);
  }
  return res.json();
}

async function deleteDoc(docId) {
  // DELETE /documents/delete_document — the correct per-doc endpoint.
  // Never use DELETE /documents (no body) — that wipes the entire doc store.
  const res = await fetch(`${LIGHTRAG_URL}/documents/delete_document`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_ids: [docId] }),
  });
  return res.ok;
}

async function main() {
  // Health check — silent exit if server not running
  try {
    const r = await fetch(`${LIGHTRAG_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const h = await r.json();
    if (h.status !== 'healthy') throw new Error(`unhealthy: ${h.status}`);
  } catch (e) {
    const isDown =
      e.cause?.code === 'ECONNREFUSED' ||
      e.name === 'TimeoutError' ||
      e.message?.includes('fetch failed') ||
      e.message?.includes('ECONNREFUSED');
    console.log(
      isDown
        ? '[sync-vault-to-lightrag] LightRAG not running — skipping'
        : `[sync-vault-to-lightrag] Health check failed (${e.message}) — skipping`
    );
    return;
  }

  console.log('[sync-vault-to-lightrag] LightRAG healthy — syncing...');

  // Get current docs
  const docsRes = await fetch(`${LIGHTRAG_URL}/documents`);
  const docsData = await docsRes.json();
  const processed = docsData.statuses?.processed ?? [];
  const lrMap = new Map(
    processed.map((d) => [d.file_path, { id: d.id, contentLength: d.content_length }])
  );

  // Walk vault files
  let vaultFiles;
  try {
    vaultFiles = getVaultFiles(VAULT_DIR);
  } catch {
    console.log('[sync-vault-to-lightrag] Vault dir not found — skipping');
    return;
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const file of vaultFiles) {
    const existing = lrMap.get(file.name);

    if (existing && existing.contentLength === file.contentLength) {
      unchanged++;
      continue;
    }

    // Delete stale doc before re-inserting
    if (existing) {
      const deleted = await deleteDoc(existing.id);
      if (!deleted) console.log(`  Delete warning: ${file.name} (${existing.id})`);
    }

    try {
      await insertDoc(file.content, file.name);
      if (existing) {
        console.log(`  Updated: ${file.name}`);
        updated++;
      } else {
        console.log(`  Inserted: ${file.name}`);
        inserted++;
      }
    } catch (e) {
      console.log(`  Error inserting ${file.name}: ${e.message}`);
      errors++;
    }
  }

  console.log(
    `[sync-vault-to-lightrag] Done — ${inserted} new, ${updated} updated, ${unchanged} unchanged${errors ? `, ${errors} errors` : ''}`
  );
}

main().catch((e) => {
  console.error('[sync-vault-to-lightrag] Error (non-fatal):', e.message);
});
