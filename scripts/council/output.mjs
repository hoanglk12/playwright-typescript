/**
 * scripts/council/output.mjs
 *
 * Writes the two output artifacts for a /council-review run: a Markdown
 * transcript (one heading per model — this is what a human reads) and a
 * machine-readable run.json. No HTML report — this tool is a flat fan-out
 * of independent responses, not the reverted 5-persona debate pattern that
 * justified an HTML report (see CLAUDE.md "LLM Council" section).
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/** YYYYMMDD-HHmmss, used in both output filenames. */
export function ts() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function ensureOutDir(outDir) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
}

/**
 * `run.results` = [{ slug, family, status: 'ok'|'failed', text?, error? }].
 * Failures render as `## <slug> - FAILED: <reason>` per the report spec.
 */
export function writeTranscript(run, outDir, timestamp = ts()) {
  ensureOutDir(outDir);
  const filepath = join(outDir, `council-review-transcript-${timestamp}.md`);

  const lines = [];
  lines.push('# Council Review Transcript');
  lines.push('');
  lines.push('## Question');
  lines.push('');
  lines.push(run.question.scrubbedText);
  lines.push('');

  if (run.contextFiles.length) {
    lines.push('## Context Sources');
    lines.push('');
    for (const f of run.contextFiles) {
      const hitsNote = f.hits.length ? `, scrub hits: ${f.hits.map(h => `${h.rule}×${h.count}`).join(', ')}` : '';
      lines.push(`- ${f.path} (${f.bytes} bytes${hitsNote})`);
    }
    lines.push('');
  }

  for (const r of run.results) {
    if (r.status === 'ok') {
      lines.push(`## ${r.slug} (${r.family})`);
      lines.push('');
      lines.push(r.text);
    } else {
      lines.push(`## ${r.slug} - FAILED: ${r.error}`);
    }
    lines.push('');
  }

  writeFileSync(filepath, lines.join('\n'), 'utf8');
  return filepath;
}

export function writeRunJson(run, outDir, timestamp = ts()) {
  ensureOutDir(outDir);
  const filepath = join(outDir, `council-review-run-${timestamp}.json`);
  writeFileSync(filepath, JSON.stringify(run, null, 2), 'utf8');
  return filepath;
}
