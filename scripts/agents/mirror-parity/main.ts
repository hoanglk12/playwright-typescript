import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCapOverride } from '../harness/caps.ts';
import { isEntryPoint } from '../harness/entry-point.ts';
import { parseAuthMode } from '../harness/env.ts';
import { EMPTY_TREE, isRootCommit, repoToplevel, resolveBase, resolveSha } from '../harness/git.ts';
import {
  MAX_PARITY_EXPLANATION_CHARS,
  MAX_PARITY_MISSING_CHANGE_CHARS,
  MIRROR_PARITY_MAX_BUDGET_USD,
  MIRROR_PARITY_MAX_TURNS,
} from '../harness/limits.ts';
import { runAgent } from '../harness/run-agent.ts';
import { hasLeak, sanitizeText } from '../harness/sanitize.ts';
import type { AgentRunReport, AgentSpec, AuthMode, ModelTokenUsage } from '../harness/types.ts';
import { assertWorkflowPathsMatch } from './pairs.ts';
import type { MirrorPairId } from './pairs.ts';
import { buildSystemPrompt, buildUserPrompt, loadPairRuleText } from './prompt.ts';
import { MirrorParityOutputSchema, ModelParityOutputSchema, PARITY_STATUSES } from './schema.ts';
import type { MirrorParityOutput, ModelParityOutput, PairVerdict, ParityStatus } from './schema.ts';
import { assertPairFilesTracked, createPairTools, scanPairs } from './tools.ts';
import type { CandidatePair } from './tools.ts';

export const MIRROR_PARITY_AGENT_NAME = 'mirror-parity';
export const MIRROR_PARITY_MODEL = 'haiku';
const DEFAULT_OUT_DIR = 'agent-reports';
const REPORT_FILE = 'mirror-parity.json';
const RUN_LOG_FILE = 'run-log.json';
const USAGE = 'usage: --sha <commit> [--base <commit>] [--out <dir>] [--max-turns <n>] [--max-budget-usd <usd>]';
const NO_VERDICT_EXPLANATION = 'The model returned no verdict for this pair.';
const SEVERAL_VERDICTS_EXPLANATION = 'The model returned more than one verdict for this pair.';
const UNREAD_CHANGE_EXPLANATION = 'The model gave a verdict without reading the change.';
const NOT_COMPLETED_EXPLANATION = 'The model run did not complete, so this pair was not checked.';
const NOT_RUN_EXPLANATION = 'Not checked: an earlier pair run did not complete.';

export interface ParityRequest {
  targetRoot: string;
  ruleRoot: string;
  sha: string;
  base?: string;
  authMode: AuthMode;
  maxTurns?: number;
  maxBudgetUsd?: number;
}

export interface PairRunLog {
  pair: MirrorPairId;
  outcome: string;
  resultSubtype?: string;
  status: ParityStatus;
  costUsdEstimate: number;
  numTurns: number;
  durationMs: number;
}

export interface EmptyParity {
  kind: 'empty';
  sha: string;
  base: string;
  bothSidesChanged: MirrorPairId[];
}

export interface CompletedParity {
  kind: 'checked';
  sha: string;
  base: string;
  bothSidesChanged: MirrorPairId[];
  report: AgentRunReport<MirrorParityOutput>;
  runs: PairRunLog[];
}

export type ParityResult = EmptyParity | CompletedParity;
export type ParityRunner = typeof runAgent;

export interface ParityRunLogFile {
  sha: string;
  base: string;
  outcome: string;
  resultSubtype?: string;
  candidates: MirrorPairId[];
  bothSidesChanged: MirrorPairId[];
  statusCounts: Record<ParityStatus, number>;
  costUsdEstimate: number;
  numTurns: number;
  permissionDenials: number;
  claudeCodeVersion?: string;
  resolvedModel?: string;
  durationMs: number;
  runs: PairRunLog[];
  errors: string[];
}

function unclearVerdict(candidate: CandidatePair, explanation: string): PairVerdict {
  return { pair: candidate.pair.id, status: 'unclear', explanation, missingChange: '', changedSide: candidate.changedSide };
}

// A verdict for any pair other than the one this run was given is dropped. Anything the harness cannot vouch for
// (no verdict, several, or one given without the tool having served the change) is "unclear" with harness text,
// because a wrong "in-sync" posts nothing.
export function settleVerdict(candidate: CandidatePair, report: AgentRunReport<ModelParityOutput>, served: boolean): PairVerdict {
  if (report.outcome !== 'success') return unclearVerdict(candidate, NOT_COMPLETED_EXPLANATION);
  const matches = (report.output?.pairs ?? []).filter((entry) => entry.pair === candidate.pair.id);
  if (matches.length === 0) return unclearVerdict(candidate, NO_VERDICT_EXPLANATION);
  if (matches.length > 1) return unclearVerdict(candidate, SEVERAL_VERDICTS_EXPLANATION);
  if (!served) return unclearVerdict(candidate, UNREAD_CHANGE_EXPLANATION);
  const [verdict] = matches;
  return {
    pair: verdict.pair,
    status: verdict.status,
    explanation: sanitizeText(verdict.explanation, MAX_PARITY_EXPLANATION_CHARS),
    missingChange: sanitizeText(verdict.missingChange, MAX_PARITY_MISSING_CHANGE_CHARS),
    changedSide: candidate.changedSide,
  };
}

function sumUsage(reports: readonly AgentRunReport<ModelParityOutput>[]): Record<string, ModelTokenUsage> {
  const total: Record<string, ModelTokenUsage> = {};
  for (const report of reports) {
    for (const [model, usage] of Object.entries(report.modelUsage)) {
      const current = total[model];
      total[model] =
        current === undefined
          ? { ...usage }
          : {
              inputTokens: current.inputTokens + usage.inputTokens,
              outputTokens: current.outputTokens + usage.outputTokens,
              cacheReadInputTokens: current.cacheReadInputTokens + usage.cacheReadInputTokens,
              cacheCreationInputTokens: current.cacheCreationInputTokens + usage.cacheCreationInputTokens,
              costUSD: current.costUSD + usage.costUSD,
            };
    }
  }
  return total;
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function mergeReports(
  reports: readonly AgentRunReport<ModelParityOutput>[],
  verdicts: PairVerdict[],
): AgentRunReport<MirrorParityOutput> {
  const failed = reports.find((report) => report.outcome !== 'success');
  const first = reports[0];
  return {
    agent: MIRROR_PARITY_AGENT_NAME,
    outcome: failed?.outcome ?? 'success',
    resultSubtype: (failed ?? first).resultSubtype,
    output: MirrorParityOutputSchema.parse({ pairs: verdicts }),
    costUsdEstimate: sum(reports.map((report) => report.costUsdEstimate)),
    numTurns: sum(reports.map((report) => report.numTurns)),
    modelUsage: sumUsage(reports),
    permissionDenials: sum(reports.map((report) => report.permissionDenials)),
    toolUseNames: [...new Set(reports.flatMap((report) => report.toolUseNames))],
    apiKeySource: first.apiKeySource,
    claudeCodeVersion: first.claudeCodeVersion,
    resolvedModel: first.resolvedModel,
    rateLimit: (failed ?? first).rateLimit,
    managedSettingsKeys: [...new Set(reports.flatMap((report) => report.managedSettingsKeys))],
    durationMs: sum(reports.map((report) => report.durationMs)),
    errors: reports.flatMap((report) => report.errors),
  };
}

export async function checkMirrorParity(request: ParityRequest, runner: ParityRunner = runAgent): Promise<ParityResult> {
  const sha = resolveSha(request.targetRoot, request.sha);
  const base = resolveBase(request.targetRoot, sha, request.base);
  // Against the empty tree every pair file looks added on both sides, so every pair would be skipped without a word.
  if (base === EMPTY_TREE && !isRootCommit(request.targetRoot, sha)) {
    throw new Error(`parent of ${sha} is not available (shallow clone?)`);
  }
  assertPairFilesTracked(request.targetRoot, sha);
  const { candidates, bothSidesChanged } = scanPairs(request.targetRoot, base, sha);
  if (candidates.length === 0) return { kind: 'empty', sha, base, bothSidesChanged };

  // Every rule is read before the first run, so a missing heading means no model call at all.
  const prompts = candidates.map((candidate) => ({
    candidate,
    systemPrompt: buildSystemPrompt(candidate.pair, loadPairRuleText(request.ruleRoot, candidate.pair.rule)),
  }));

  const reports: AgentRunReport<ModelParityOutput>[] = [];
  const verdicts: PairVerdict[] = [];
  const runs: PairRunLog[] = [];
  let stopped = false;
  for (const { candidate, systemPrompt } of prompts) {
    if (stopped) {
      verdicts.push(unclearVerdict(candidate, NOT_RUN_EXPLANATION));
      continue;
    }
    const pairTools = createPairTools({ repoRoot: request.targetRoot, sha, base, candidate });
    const spec: AgentSpec<ModelParityOutput> = {
      name: MIRROR_PARITY_AGENT_NAME,
      systemPrompt,
      tools: pairTools.tools,
      outputSchema: ModelParityOutputSchema,
      model: MIRROR_PARITY_MODEL,
      maxTurns: request.maxTurns ?? MIRROR_PARITY_MAX_TURNS,
      maxBudgetUsd: request.maxBudgetUsd ?? MIRROR_PARITY_MAX_BUDGET_USD,
    };
    const report = await runner(spec, buildUserPrompt(candidate.pair, sha, candidate.changedSide), {
      authMode: request.authMode,
    });
    const verdict = settleVerdict(candidate, report, pairTools.served());
    reports.push(report);
    verdicts.push(verdict);
    runs.push({
      pair: candidate.pair.id,
      outcome: report.outcome,
      resultSubtype: report.resultSubtype,
      status: verdict.status,
      costUsdEstimate: report.costUsdEstimate,
      numTurns: report.numTurns,
      durationMs: report.durationMs,
    });
    // A rate limit or auth failure will not clear between runs, so the remaining pairs are not attempted.
    if (report.outcome !== 'success') stopped = true;
  }
  return { kind: 'checked', sha, base, bothSidesChanged, report: mergeReports(reports, verdicts), runs };
}

export function buildRunLog(result: CompletedParity): ParityRunLogFile {
  const { report } = result;
  const verdicts = report.output?.pairs ?? [];
  const statusCounts = Object.fromEntries(
    PARITY_STATUSES.map((status) => [status, verdicts.filter((verdict) => verdict.status === status).length]),
  ) as Record<ParityStatus, number>;
  return {
    sha: result.sha,
    base: result.base,
    outcome: report.outcome,
    resultSubtype: report.resultSubtype,
    candidates: verdicts.map((verdict) => verdict.pair),
    bothSidesChanged: result.bothSidesChanged,
    statusCounts,
    costUsdEstimate: report.costUsdEstimate,
    numTurns: report.numTurns,
    permissionDenials: report.permissionDenials,
    claudeCodeVersion: report.claudeCodeVersion,
    resolvedModel: report.resolvedModel,
    durationMs: report.durationMs,
    runs: result.runs,
    errors: report.errors,
  };
}

export async function writeParityOutputs(outDir: string, result: CompletedParity): Promise<void> {
  if (hasLeak(JSON.stringify(result.report.output))) throw new Error('leak detected in the parity report; nothing written');
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, REPORT_FILE), JSON.stringify(result.report, null, 2));
  await writeFile(join(outDir, RUN_LOG_FILE), JSON.stringify(buildRunLog(result), null, 2));
}

export async function runCli(
  argv: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  runner: ParityRunner = runAgent,
): Promise<number> {
  let sha: string | undefined;
  let base: string | undefined;
  let outDir: string;
  let maxTurns: number | undefined;
  let maxBudgetUsd: number | undefined;
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: {
        sha: { type: 'string' },
        base: { type: 'string' },
        out: { type: 'string' },
        'max-turns': { type: 'string' },
        'max-budget-usd': { type: 'string' },
      },
    });
    sha = values.sha;
    base = values.base;
    outDir = values.out ?? DEFAULT_OUT_DIR;
    maxTurns = parseCapOverride(values['max-turns'], '--max-turns', MIRROR_PARITY_MAX_TURNS, true);
    maxBudgetUsd = parseCapOverride(values['max-budget-usd'], '--max-budget-usd', MIRROR_PARITY_MAX_BUDGET_USD, false);
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : 'invalid arguments'}\n${USAGE}`);
    return 1;
  }
  if (sha === undefined) {
    console.error(USAGE);
    return 1;
  }

  try {
    const ruleRoot = fileURLToPath(new URL('../../../', import.meta.url));
    assertWorkflowPathsMatch(ruleRoot);
    const result = await checkMirrorParity(
      { targetRoot: repoToplevel(cwd), ruleRoot, sha, base, authMode: parseAuthMode(env.AGENT_AUTH_MODE), maxTurns, maxBudgetUsd },
      runner,
    );
    if (result.kind === 'empty') {
      console.log(`nothing to check: no pair has exactly one changed side in ${result.sha}`);
      return 0;
    }
    await writeParityOutputs(outDir, result);
    const { report } = result;
    const counts = buildRunLog(result).statusCounts;
    console.log(
      `outcome=${report.outcome} pairs=${report.output?.pairs.length ?? 0} ` +
        PARITY_STATUSES.map((status) => `${status}=${counts[status]}`).join(' ') +
        ` cost=$${report.costUsdEstimate.toFixed(4)} turns=${report.numTurns}`,
    );
    for (const error of report.errors) console.error(error);
    return report.outcome === 'success' ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'mirror parity check failed');
    return 1;
  }
}

if (isEntryPoint(import.meta.url, process.argv[1])) {
  process.exitCode = await runCli(process.argv.slice(2), process.cwd(), process.env);
}
