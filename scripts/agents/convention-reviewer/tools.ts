import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { redactSensitiveText } from '../../../src/utils/redact.ts';
import { PINNED_DIFF_OPTIONS, fenceUntrusted, git, resolveBase, resolveSha, textResult } from '../harness/git.ts';
import { MAX_DIFF_CHARS, MAX_TOOL_TEXT_CHARS } from '../harness/limits.ts';
import { readTrackedFile } from '../harness/tracked-files.ts';
import type { AgentTool } from '../harness/types.ts';
import { walkDiff } from './prechecks.ts';
import type { DiffLine } from './prechecks.ts';
import type { ConventionFinding } from './schema.ts';

export const REVIEW_PATH_PREFIXES: readonly string[] = ['src/pages/', 'tests/', 'src/data/'];

export const NEVER_SEND_PATHSPECS: readonly string[] = [':(exclude,glob)**/.env*', ':(exclude,glob)**/.auth/**'];
export const DIFF_TRUNCATION_NOTICE = '\n[diff truncated at the size cap]';
const LINE_NUMBER_WIDTH = 4;

export { fenceUntrusted, resolveBase, resolveSha };

export interface ReviewToolContext {
  repoRoot: string;
  sha: string;
  diff: string;
  diffFiles: ReadonlySet<string>;
  trackedFiles: ReadonlySet<string>;
  prechecks: readonly ConventionFinding[];
}

export function getScopedDiff(repoRoot: string, base: string, sha: string, env?: NodeJS.ProcessEnv): string {
  const pathspecs = REVIEW_PATH_PREFIXES.map((prefix) => prefix.replace(/\/$/, ''));
  return git(
    repoRoot,
    [
      'diff',
      ...PINNED_DIFF_OPTIONS,
      '--unified=3',
      base,
      sha,
      '--',
      ...pathspecs,
      ...NEVER_SEND_PATHSPECS,
    ],
    env,
  );
}

// Numbered by the walk the pre-checks use, so the model's line numbers match theirs. Redacting after the marker keeps
// an email at the start of an added line from swallowing its "+".
function numberDiffLine(line: DiffLine): string {
  if (line.kind === 'meta') return redactSensitiveText(line.raw);
  const lineNumber = line.kind === 'added' || line.kind === 'context' ? String(line.newLine) : '';
  return `${line.raw[0] ?? ' '}${lineNumber.padStart(LINE_NUMBER_WIDTH)} | ${redactSensitiveText(line.raw.slice(1))}`;
}

export function renderDiff(diff: string): string {
  const rendered = Array.from(walkDiff(diff), numberDiffLine).join('\n');
  if (rendered.length <= MAX_DIFF_CHARS) return rendered;
  const lastWholeLineEnd = Math.max(0, rendered.lastIndexOf('\n', MAX_DIFF_CHARS));
  return rendered.slice(0, lastWholeLineEnd) + DIFF_TRUNCATION_NOTICE;
}

function capFindings(findings: readonly ConventionFinding[]): ConventionFinding[] {
  const kept: ConventionFinding[] = [];
  for (const finding of findings) {
    if (JSON.stringify([...kept, finding]).length > MAX_TOOL_TEXT_CHARS) break;
    kept.push(finding);
  }
  return kept;
}

export function createReviewTools(ctx: ReviewToolContext): AgentTool[] {
  const readable = new Set<string>([...ctx.diffFiles, ...ctx.trackedFiles]);

  const getDiff = tool(
    'get_diff',
    'Unified diff of the pushed commit, limited to src/pages, tests and src/data. Lines starting with + are the added lines to review. Each hunk line shows its new-file line number before the |; removed lines have none.',
    {},
    async () => textResult(fenceUntrusted('diff', renderDiff(ctx.diff))),
  );

  const readFile = tool(
    'read_file',
    'Read a tracked file at the pushed commit with line numbers. Allowed: files the diff touched, or tracked files under src/pages, tests and src/data.',
    { path: z.string(), startLine: z.number().int().optional(), endLine: z.number().int().optional() },
    async (args) => {
      const result = readTrackedFile(ctx.repoRoot, readable, ctx.sha, args.path, {
        startLine: args.startLine,
        endLine: args.endLine,
      });
      if (!result.ok) return textResult(result.error, true);
      const header = `path=${result.path} totalLines=${result.totalLines} truncated=${result.truncated}`;
      return textResult(fenceUntrusted('file', `${header}\n${redactSensitiveText(result.content)}`));
    },
  );

  const getPrecheckFindings = tool(
    'get_precheck_findings',
    'Deterministic rule violations already found on the added lines. Do not repeat them; focus on judgement rules.',
    {},
    async () => textResult(fenceUntrusted('precheck-findings', JSON.stringify(capFindings(ctx.prechecks)))),
  );

  return [getDiff, readFile, getPrecheckFindings];
}
