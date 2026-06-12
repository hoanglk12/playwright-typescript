import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
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
      results.push({ name: entry, contentLength: content.length });
    }
  }
  return results;
}

async function main() {
  // Health check — silent exit if server not running
  try {
    const r = await fetch(`${LIGHTRAG_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const h = await r.json();
    if (h.status !== 'healthy') throw new Error(`unhealthy: ${h.status}`);
  } catch (e) {
    const silent =
      e.cause?.code === 'ECONNREFUSED' ||
      e.name === 'TimeoutError' ||
      e.message?.includes('fetch failed') ||
      e.message?.includes('ECONNREFUSED');
    console.log(
      silent
        ? '[sync-vault-to-lightrag] LightRAG not running — skipping'
        : `[sync-vault-to-lightrag] Health check failed (${e.message}) — skipping`
    );
    return;
  }

  console.log('[sync-vault-to-lightrag] LightRAG healthy — syncing...');

  // Get current docs from LightRAG
  const docsRes = await fetch(`${LIGHTRAG_URL}/documents`);
  const docsData = await docsRes.json();
  const processed = docsData.statuses?.processed ?? [];

  // Build lookup: filename → { id, contentLength }
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

  // Detect changed files: exists in LightRAG but content length differs
  const toDelete = [];
  for (const { name, contentLength } of vaultFiles) {
    const existing = lrMap.get(name);
    if (existing && existing.contentLength !== contentLength) {
      toDelete.push(existing.id);
      console.log(`  Changed: ${name} (${existing.contentLength} → ${contentLength} chars)`);
    }
  }

  // Delete stale docs so scan re-ingests them as new
  if (toDelete.length > 0) {
    console.log(`  Deleting ${toDelete.length} stale doc(s)...`);
    const delRes = await fetch(`${LIGHTRAG_URL}/documents`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_ids: toDelete }),
    });
    if (!delRes.ok) {
      const txt = await delRes.text().catch(() => '');
      console.log(`  Delete warning: ${delRes.status} — ${txt.slice(0, 200)}`);
    }
  }

  // Trigger scan — picks up new files and re-deleted (now "new") ones
  const scanRes = await fetch(`${LIGHTRAG_URL}/documents/scan`, { method: 'POST' });
  const scanData = await scanRes.json();

  const newCount = vaultFiles.filter((f) => !lrMap.has(f.name)).length;
  const changedCount = toDelete.length;
  const unchanged = vaultFiles.length - newCount - changedCount;

  console.log(
    `  Result: ${newCount} new, ${changedCount} updated, ${unchanged} unchanged | scan: ${scanData.status ?? 'ok'}`
  );
  console.log('[sync-vault-to-lightrag] Done');
}

main().catch((e) => {
  console.error('[sync-vault-to-lightrag] Error (non-fatal):', e.message);
});
