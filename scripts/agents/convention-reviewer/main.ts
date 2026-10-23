import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isEntryPoint } from '../harness/entry-point.ts';
import { parseAuthMode } from '../harness/env.ts';
import {
  CONVENTION_REVIEWER_MAX_BUDGET_USD,
  CONVENTION_REVIEWER_MAX_TURNS,
  MAX_EVIDENCE_CHARS,
  MAX_FINDINGS,
  MAX_SUGGESTION_CHARS,
  MAX_SUMMARY_CHARS,
} from '../harness/limits.ts';
import { runAgent } from '../harness/run-agent.ts';
import { hasLeak, sanitizeText } from '../harness/sanitize.ts';
import { listTrackedFiles, readTrackedFile } from '../harness/tracked-files.ts';
import type { AgentRunReport, AgentSpec, AuthMode, ModelTokenUsage } from '../harness/types.ts';
import { parseDiff, runPrechecks, toFinding } from './prechecks.ts';
import { buildSystemPrompt, buildUserPrompt, loadRuleText } from './prompt.ts';
import { renderConventionMarkdown } from './render.ts';
import { ConventionReviewOutputSchema } from './schema.ts';
import type { ConventionFinding, ConventionReviewOutput } from './schema.ts';
import {
  REVIEW_PATH_PREFIXES,
  createReviewTools,
  getScopedDiff,
  resolveBase,
  resolveSha,
} from './tools.ts';

export const REVIEW_AGENT_NAME = 'review';
export const REVIEW_MODEL = 'sonnet';
const DEFAULT_OUT_DIR = 'agent-reports';
const REPORT_FILE = 'convention-review.json';
const MARKDOWN_FILE = 'convention-review.md';
const RUN_LOG_FILE = 'run-log.json';
const USAGE = 'usage: --sha <commit> [--base <commit>] [--out <dir>]';

export interface ReviewRequest {
  targetRoot: string;
  ruleRoot: string;
  sha: string;
  base?: string;
  authMode: AuthMode;
}

export interface FindingStats {
  precheck: number;
  model: number;
  droppedByValidation: number;
  kept: number;
  droppedByCap: number;
}

export interface ValidationContext {
  targetRoot: string;
  sha: string;
  diffFiles: ReadonlySet<string>;
}

export interface ValidationResult {
  kept: ConventionFinding[];
  dropped: ConventionFinding[];
}

export interface EmptyReview {
  kind: 'empty';
  sha: string;
  base: string;
}

export interface CompletedReview {
  kind: 'reviewed';
  sha: string;
  base: string;
  report: AgentRunReport<ConventionReviewOutput>;
  findings: ConventionFinding[];
  modelFindings: ConventionFinding[];
  stats: FindingStats;
}

export type ReviewResult = EmptyReview | CompletedReview;
export type AgentRunner = typeof runAgent;

export interface RunLog {
  sha: string;
  base: string;
  outcome: string;
  resultSubtype?: string;
  costUsdEstimate: number;
  numTurns: number;
  modelUsage: Record<string, ModelTokenUsage>;
  permissionDenials: number;
  apiKeySource?: string;
  claudeCodeVersion?: string;
  resolvedModel?: string;
  durationMs: number;
  findings: FindingStats;
  errors: string[];
}

export function repoToplevel(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
}

export function validateFindings(findings: readonly ConventionFinding[], ctx: ValidationContext): ValidationResult {
  const kept: ConventionFinding[] = [];
  const dropped: ConventionFinding[] = [];
  for (const finding of findings) {
    if (!ctx.diffFiles.has(finding.file)) {
      dropped.push(finding);
      continue;
    }
    // readTrackedFile counts the empty element after a trailing newline as a line, so that phantom
    // last line comes back as a bare "<n>: " and has to be rejected here.
    const read = readTrackedFile(ctx.targetRoot, ctx.diffFiles, ctx.sha, finding.file, {
      startLine: finding.line,
      endLine: finding.line,
    });
    const phantom = read.ok && read.content === `${finding.line}: ` && finding.line === read.totalLines;
    if (!read.ok || read.content === '' || phantom) dropped.push(finding);
    else kept.push(finding);
  }
  return { kept, dropped };
}

export function capFinding(finding: ConventionFinding): ConventionFinding {
  return {
    ...finding,
    evidence: sanitizeText(finding.evidence, MAX_EVIDENCE_CHARS),
    suggestion: sanitizeText(finding.suggestion, MAX_SUGGESTION_CHARS),
  };
}

export function mergeFindings(
  prechecks: readonly ConventionFinding[],
  modelFindings: readonly ConventionFinding[],
): { findings: ConventionFinding[]; droppedByCap: number } {
  const seen = new Set<string>();
  const unique: ConventionFinding[] = [];
  for (const finding of [...prechecks, ...modelFindings].map(capFinding)) {
    const key = `${finding.rule}|${finding.file}|${finding.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return { findings: unique.slice(0, MAX_FINDINGS), droppedByCap: Math.max(0, unique.length - MAX_FINDINGS) };
}

export async function reviewCommit(request: ReviewRequest, runner: AgentRunner = runAgent): Promise<ReviewResult> {
  const sha = resolveSha(request.targetRoot, request.sha);
  const base = resolveBase(request.targetRoot, sha, request.base);
  const diff = getScopedDiff(request.targetRoot, base, sha);
  if (diff.trim() === '') return { kind: 'empty', sha, base };

  const parsed = parseDiff(diff);
  const prechecks = runPrechecks(parsed.addedLines).map(toFinding);
  const systemPrompt = buildSystemPrompt(loadRuleText(request.ruleRoot));
  const trackedFiles = listTrackedFiles(request.targetRoot, REVIEW_PATH_PREFIXES);

  const spec: AgentSpec<ConventionReviewOutput> = {
    name: REVIEW_AGENT_NAME,
    systemPrompt,
    tools: createReviewTools({
      repoRoot: request.targetRoot,
      sha,
      diff,
      diffFiles: parsed.files,
      trackedFiles,
      prechecks,
    }),
    outputSchema: ConventionReviewOutputSchema,
    model: REVIEW_MODEL,
    maxTurns: CONVENTION_REVIEWER_MAX_TURNS,
    maxBudgetUsd: CONVENTION_REVIEWER_MAX_BUDGET_USD,
  };
  const report = await runner(spec, buildUserPrompt(sha), { authMode: request.authMode });

  const rawModelFindings = report.output?.findings ?? [];
  const validation = validateFindings(rawModelFindings, {
    targetRoot: request.targetRoot,
    sha,
    diffFiles: parsed.files,
  });
  const merged = mergeFindings(prechecks, validation.kept);
  const stats: FindingStats = {
    precheck: prechecks.length,
    model: rawModelFindings.length,
    droppedByValidation: validation.dropped.length,
    kept: merged.findings.length,
    droppedByCap: merged.droppedByCap,
  };
  const review: CompletedReview = {
    kind: 'reviewed',
    sha,
    base,
    report,
    findings: merged.findings,
    modelFindings: validation.kept.map(capFinding),
    stats,
  };

  if (report.outcome !== 'success' || report.output === undefined) return review;
  const output = ConventionReviewOutputSchema.parse({
    summary: sanitizeText(report.output.summary, MAX_SUMMARY_CHARS),
    findings: merged.findings,
  });
  return { ...review, report: { ...report, output }, findings: output.findings };
}

export function buildRunLog(result: CompletedReview): RunLog {
  const { report } = result;
  return {
    sha: result.sha,
    base: result.base,
    outcome: report.outcome,
    resultSubtype: report.resultSubtype,
    costUsdEstimate: report.costUsdEstimate,
    numTurns: report.numTurns,
    modelUsage: report.modelUsage,
    permissionDenials: report.permissionDenials,
    apiKeySource: report.apiKeySource,
    claudeCodeVersion: report.claudeCodeVersion,
    resolvedModel: report.resolvedModel,
    durationMs: report.durationMs,
    findings: result.stats,
    errors: report.errors,
  };
}

export function renderReviewMarkdown(result: CompletedReview): string {
  const output: ConventionReviewOutput = result.report.output ?? {
    summary: `The model review did not complete (outcome: ${result.report.outcome}); only deterministic pre-check findings are listed.`,
    findings: result.findings,
  };
  const { title, body } = renderConventionMarkdown(output, 'github-commit-comment');
  return `**${title}**\n\n${body}\n`;
}

export async function writeReviewOutputs(outDir: string, result: CompletedReview): Promise<void> {
  const markdown = renderReviewMarkdown(result);
  // inert() escapes characters such as "_" in the markdown, which can split a token so no leak pattern matches it.
  const unescaped = JSON.stringify(result.report.output ?? result.findings);
  if (hasLeak(markdown) || hasLeak(unescaped)) throw new Error('leak detected in the rendered review; nothing written');
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, REPORT_FILE), JSON.stringify(result.report, null, 2));
  await writeFile(join(outDir, MARKDOWN_FILE), markdown);
  await writeFile(join(outDir, RUN_LOG_FILE), JSON.stringify(buildRunLog(result), null, 2));
}

export async function runCli(argv: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<number> {
  let sha: string | undefined;
  let base: string | undefined;
  let outDir: string;
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: { sha: { type: 'string' }, base: { type: 'string' }, out: { type: 'string' } },
    });
    sha = values.sha;
    base = values.base;
    outDir = values.out ?? DEFAULT_OUT_DIR;
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : 'invalid arguments'}\n${USAGE}`);
    return 1;
  }
  if (sha === undefined) {
    console.error(USAGE);
    return 1;
  }

  try {
    const result = await reviewCommit({
      targetRoot: repoToplevel(cwd),
      ruleRoot: fileURLToPath(new URL('../../../', import.meta.url)),
      sha,
      base,
      authMode: parseAuthMode(env.AGENT_AUTH_MODE),
    });
    if (result.kind === 'empty') {
      console.log(`nothing to review: no in-scope changes in ${result.sha}`);
      return 0;
    }
    await writeReviewOutputs(outDir, result);
    const { report, stats } = result;
    console.log(
      `outcome=${report.outcome} findings=${stats.kept} (precheck ${stats.precheck}, model ${stats.model}, ` +
        `dropped ${stats.droppedByValidation}) cost=$${report.costUsdEstimate.toFixed(4)} turns=${report.numTurns}`,
    );
    for (const error of report.errors) console.error(error);
    return report.outcome === 'success' ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'convention review failed');
    return 1;
  }
}

if (isEntryPoint(import.meta.url, process.argv[1])) {
  process.exitCode = await runCli(process.argv.slice(2), process.cwd(), process.env);
}
