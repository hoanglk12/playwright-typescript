// Shared by sync-vault-to-lightrag.mjs and eval-lightrag.mjs, so the sync and the eval agree on
// whether a note's indexed copy is current.
import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export const md5 = text => createHash('md5').update(text).digest('hex');

// The API reports content_length only, which misses an edit that keeps the length (a date, a status
// word). LightRAG's working dir keeps md5 of the stored text: the note after sanitize_text_for_encoding
// (strip, html.unescape, control characters removed). Without entities or control characters that is
// md5(trim()); for other notes the stored hash can't be predicted.
export const UNPREDICTABLE_HASH =
  /&(#x?[0-9a-f]+|[a-z][a-z0-9]*);|&(amp|lt|gt|quot|nbsp|copy|reg|not)|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085﻿]/i;

export function readIndexSnapshot(workingDir) {
  const file = join(workingDir, 'kv_store_doc_status.json');
  if (!existsSync(file)) return null;
  try {
    const docs = new Map();
    for (const [id, d] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
      if (docs.get(d.file_path)?.status === 'processed' && d.status !== 'processed') continue;
      docs.set(d.file_path, {
        id,
        status: d.status,
        hash: d.content_hash,
        length: d.content_length,
        updatedAt: d.updated_at,
      });
    }
    return { savedAt: statSync(file).mtime, docs };
  } catch {
    return null;
  }
}
