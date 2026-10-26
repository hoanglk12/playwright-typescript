// Syncs vault notes to LightRAG.
// For new files: inserts via POST /documents/text (bypasses file-tracker).
// For changed files, and docs whose indexing failed: deletes old doc then re-inserts.
// Uses POST /documents/text with file_source — the only reliable insert path
// (scan misses changed files; MCP insert_document omits required file_source field).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { md5, readIndexSnapshot, UNPREDICTABLE_HASH } from './lightrag-doc-status.mjs';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const VAULT_DIR = join(PROJECT_ROOT, 'memory-vault', '20-memory');
const WORKING_DIR = process.env.LIGHTRAG_WORKING_DIR ?? join(PROJECT_ROOT, '.lightrag');
const LIGHTRAG_URL = 'http://localhost:9621';
// A failed doc blocks its own re-insert (409) until it's deleted, so it's retried here. At most hourly
// unless the note changed: a doc that fails every time would otherwise re-index after every turn.
const RETRY_FAILED_AFTER_MS = 60 * 60 * 1000;

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
    const err = new Error(`${res.status} ${txt.slice(0, 120)}`);
    // A 409 either names an existing doc ("already contains 'x.md' (Status: pending)") or says the
    // pipeline is busy deleting. Only a failed existing doc needs attention; the rest clear up.
    err.retryLater = res.status === 409 && txt.match(/\(Status: (\w+)\)/)?.[1] !== 'failed';
    throw err;
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

async function waitForIdle(maxMs) {
  for (const end = Date.now() + maxMs; Date.now() < end; ) {
    try {
      const hr = await fetch(`${LIGHTRAG_URL}/health`, { signal: AbortSignal.timeout(5000) });
      const hj = await hr.json();
      if (!hj.pipeline_destructive_busy && !hj.pipeline_busy) return true;
    } catch {
      return false;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
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

  // Get current docs — GET /documents was removed in lightrag-hku 1.5.7, replaced by
  // POST /documents/paginated (page_size max is 200, well above the vault's note count)
  const docsRes = await fetch(`${LIGHTRAG_URL}/documents/paginated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 1, page_size: 200 }),
  });
  if (!docsRes.ok) {
    console.log(
      `[sync-vault-to-lightrag] /documents/paginated returned ${docsRes.status} — aborting (would otherwise re-insert everything as new)`
    );
    return;
  }
  const docsData = await docsRes.json();
  const docs = docsData.documents ?? [];
  const total = docsData.status_counts?.all ?? docs.length;
  if (total > docs.length) {
    console.log(
      `[sync-vault-to-lightrag] Only ${docs.length} of ${total} docs fetched — page_size cap hit, aborting`
    );
    return;
  }
  const byStatus = (status) => new Map(docs.filter((d) => d.status === status).map((d) => [d.file_path, d]));
  const processed = byStatus('processed');
  const failed = byStatus('failed');
  // WHY: the end-of-turn Stop hook runs seconds after the PostToolUse hook inserted a note,
  // while it is still being indexed. Re-inserting it then fails with 409 "already contains".
  const inFlight = new Set(
    docs.filter((d) => d.status !== 'processed' && d.status !== 'failed').map((d) => d.file_path)
  );
  const snapshot = readIndexSnapshot(WORKING_DIR);

  // The API reports only content_length, which misses an edit that keeps the length (a date, a
  // status word). The doc-status store on disk has md5 of the indexed text; it's used whenever its
  // record is as new as the live doc, since the store can trail the server by an indexing batch.
  function isChanged(file, doc) {
    const saved = snapshot?.docs.get(file.name);
    if (saved?.hash && saved.updatedAt === doc.updated_at && !UNPREDICTABLE_HASH.test(file.content)) {
      return md5(file.content.trim()) !== saved.hash;
    }
    // LightRAG strips 1–2 chars (trailing newline/CRLF) when storing, so without a hash a length
    // within 2 chars counts as unchanged.
    return Math.abs(doc.content_length - file.contentLength) > 2;
  }

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
  let inProgress = 0;
  let errors = 0;

  // Separate unchanged from files that need work
  const toInsert = [];
  let toUpdate = [];

  for (const file of vaultFiles) {
    if (inFlight.has(file.name)) {
      inProgress++;
      continue;
    }
    const existing = processed.get(file.name);
    const failedDoc = failed.get(file.name);
    if (existing) {
      if (isChanged(file, existing)) toUpdate.push({ file, existing });
      else unchanged++;
    } else if (failedDoc) {
      const reason = (failedDoc.error_msg ?? 'no error message').slice(0, 100);
      const retryAt = Date.parse(failedDoc.updated_at) + RETRY_FAILED_AFTER_MS;
      const retryDue = !Number.isFinite(retryAt) || Date.now() >= retryAt;
      if (retryDue || isChanged(file, failedDoc)) {
        console.log(`  Retrying failed: ${file.name} (${reason})`);
        toUpdate.push({ file, existing: failedDoc });
      } else {
        console.log(
          `  Error inserting ${file.name}: indexing failed (${reason}); retry after ${new Date(retryAt).toISOString().slice(11, 16)}Z`
        );
        errors++;
      }
    } else {
      toInsert.push({ file });
    }
  }

  // Pass 1 — delete all stale docs before any inserts (LightRAG delete is async)
  const deleteIds = toUpdate.map((u) => u.existing.id);
  if (deleteIds.length > 0) {
    // A delete sent while the pipeline is busy is refused with HTTP 200 and status "busy".
    await waitForIdle(20000);
    const res = await fetch(`${LIGHTRAG_URL}/documents/delete_document`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_ids: deleteIds }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.status === 'deletion_started') {
      // Re-inserting before the background delete finishes would 409 on the old doc
      await waitForIdle(60000);
    } else {
      console.log(
        `  Delete refused (${body.status ?? res.status}) — ${toUpdate.length} update(s) left for the next sync`
      );
      inProgress += toUpdate.length;
      toUpdate = [];
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
      // A concurrent sync (the PostToolUse and Stop hooks overlap) inserted it first, or a delete
      // is still running. The next sync inserts anything still missing.
      if (e.retryLater) {
        console.log(`  Deferred: ${file.name} (${e.message.slice(0, 100)})`);
        inProgress++;
        continue;
      }
      console.log(`  Error inserting ${file.name}: ${e.message}`);
      errors++;
    }
  }

  console.log(
    `[sync-vault-to-lightrag] Done — ${inserted} new, ${updated} updated, ${unchanged} unchanged${inProgress ? `, ${inProgress} in progress` : ''}${errors ? `, ${errors} errors` : ''}`
  );
}

main().catch((e) => {
  console.error('[sync-vault-to-lightrag] Error (non-fatal):', e.message);
});
