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

  // Separate unchanged from files that need work
  const toInsert = [];
  const toUpdate = [];

  for (const file of vaultFiles) {
    const existing = lrMap.get(file.name);
    // WHY: LightRAG strips 1–2 chars (trailing newline/CRLF) when storing, so stored
    // content_length is always 1–2 less than the raw file length. Tolerance prevents
    // every file appearing as "changed" on every sync run, which causes batch-delete
    // races and 409 errors on re-insert.
    if (existing && Math.abs(existing.contentLength - file.contentLength) <= 2) {
      unchanged++;
    } else if (existing) {
      toUpdate.push({ file, existing });
    } else {
      toInsert.push({ file });
    }
  }

  // Pass 1 — delete all stale docs before any inserts (LightRAG delete is async)
  const deleteIds = toUpdate.map((u) => u.existing.id);
  if (deleteIds.length > 0) {
    const res = await fetch(`${LIGHTRAG_URL}/documents/delete_document`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_ids: deleteIds }),
    });
    if (!res.ok) {
      console.log(`  Batch delete warning (${res.status}) — proceeding anyway`);
    }
    // Poll until LightRAG finishes the delete pipeline before re-inserting
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const hr = await fetch(`${LIGHTRAG_URL}/health`, { signal: AbortSignal.timeout(5000) });
        const hj = await hr.json();
        const busy = hj.pipeline_destructive_busy || hj.pipeline_busy;
        if (!busy) break;
      } catch { break; }
    }
  }

  // Pass 2 — insert new + updated files
  for (const { file } of [...toUpdate, ...toInsert]) {
    const isUpdate = toUpdate.some((u) => u.file.name === file.name);
    try {
      await insertDoc(file.content, file.name);
      if (isUpdate) {
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
