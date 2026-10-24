import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { PINNED_DIFF_OPTIONS, fenceUntrusted, git, textResult } from '../harness/git.ts';
import { MAX_DIFF_CHARS, PAIR_DIFF_CONTEXT_LINES } from '../harness/limits.ts';
import { redactText } from '../harness/sanitize.ts';
import { readTrackedFile } from '../harness/tracked-files.ts';
import type { AgentTool } from '../harness/types.ts';
import { MIRROR_PAIRS, pairFiles } from './pairs.ts';
import type { MirrorPair, MirrorPairId } from './pairs.ts';
import type { PairSide } from './schema.ts';

export const HUNK_TRUNCATION_NOTICE = '\n[hunks truncated at the size cap]';

export interface CandidatePair {
  pair: MirrorPair;
  changedSide: PairSide;
}

export interface PairScan {
  candidates: CandidatePair[];
  bothSidesChanged: MirrorPairId[];
}

export interface PairToolContext {
  repoRoot: string;
  sha: string;
  base: string;
  candidate: CandidatePair;
}

export interface PairTools {
  tools: AgentTool[];
  served: () => boolean;
}

function changedFile({ pair, changedSide }: CandidatePair): string {
  return changedSide === 'source' ? pair.source : pair.mirror;
}

function counterpartFile({ pair, changedSide }: CandidatePair): string {
  return changedSide === 'source' ? pair.mirror : pair.source;
}

export function assertPairFilesTracked(repoRoot: string, sha: string): void {
  const files = pairFiles();
  const present = new Set(git(repoRoot, ['ls-tree', '-r', '--name-only', '-z', sha, '--', ...files]).split('\0'));
  const missing = files.filter((file) => !present.has(file));
  if (missing.length > 0) throw new Error(`pair file missing or untracked at ${sha}: ${missing.join(', ')}`);
}

export function scanPairs(repoRoot: string, base: string, sha: string): PairScan {
  const changed = new Set(
    git(repoRoot, ['diff', '--name-only', '-z', '--no-renames', base, sha, '--', ...pairFiles()])
      .split('\0')
      .filter((file) => file !== ''),
  );
  const scan: PairScan = { candidates: [], bothSidesChanged: [] };
  for (const pair of MIRROR_PAIRS) {
    const sourceChanged = changed.has(pair.source);
    const mirrorChanged = changed.has(pair.mirror);
    if (sourceChanged && mirrorChanged) scan.bothSidesChanged.push(pair.id);
    else if (sourceChanged || mirrorChanged) scan.candidates.push({ pair, changedSide: sourceChanged ? 'source' : 'mirror' });
  }
  return scan;
}

// Redaction runs after the +/- marker so an email at the start of a line cannot swallow it.
function renderHunks(diff: string): string {
  const rendered = diff
    .split('\n')
    .map((line) => line.slice(0, 1) + redactText(line.slice(1)))
    .join('\n');
  if (rendered.length <= MAX_DIFF_CHARS) return rendered;
  const lastWholeLineEnd = Math.max(0, rendered.lastIndexOf('\n', MAX_DIFF_CHARS));
  return rendered.slice(0, lastWholeLineEnd) + HUNK_TRUNCATION_NOTICE;
}

export function getPairChange(ctx: PairToolContext, requested: string): ReturnType<typeof textResult> {
  const { candidate } = ctx;
  if (requested !== candidate.pair.id) return textResult('pair is not a candidate for this run', true);
  const changed = changedFile(candidate);
  const counterpart = counterpartFile(candidate);

  const hunks = git(ctx.repoRoot, [
    'diff',
    ...PINNED_DIFF_OPTIONS,
    `--unified=${PAIR_DIFF_CONTEXT_LINES}`,
    ctx.base,
    ctx.sha,
    '--',
    changed,
  ]);
  const read = readTrackedFile(ctx.repoRoot, new Set([counterpart]), ctx.sha, counterpart);
  if (!read.ok) return textResult(read.error, true);

  const header = `pair=${candidate.pair.id} changedSide=${candidate.changedSide} changedFile=${changed} counterpartFile=${counterpart}`;
  const counterpartHeader = `path=${read.path} totalLines=${read.totalLines} truncated=${read.truncated}`;
  return textResult(
    [
      header,
      fenceUntrusted('changed-hunks', renderHunks(hunks)),
      fenceUntrusted('counterpart-file', `${counterpartHeader}\n${redactText(read.content)}`),
    ].join('\n\n'),
  );
}

export function createPairTools(ctx: PairToolContext): PairTools {
  let served = false;
  const getPairChangeTool = tool(
    'get_pair_change',
    'Changed hunks of the side of the pair that changed in the pushed range, plus the full text of the other side at the pushed commit.',
    { pair: z.enum([ctx.candidate.pair.id]) },
    async (args) => {
      const result = getPairChange(ctx, args.pair);
      if (result.isError !== true) served = true;
      return result;
    },
  );
  return { tools: [getPairChangeTool], served: () => served };
}
