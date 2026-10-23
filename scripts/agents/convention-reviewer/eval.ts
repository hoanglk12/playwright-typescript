import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isEntryPoint } from '../harness/entry-point.ts';
import { credentialVarFor, parseAuthMode } from '../harness/env.ts';
import { CONVENTION_EVAL_DEFAULT_REPEATS } from '../harness/limits.ts';
import { hasLeak } from '../harness/sanitize.ts';
import type { AuthMode, ModelTokenUsage } from '../harness/types.ts';
import { reviewCommit } from './main.ts';
import type { PrecheckId } from './prechecks.ts';
import type { ConventionFinding, ConventionRule } from './schema.ts';

export const EVAL_RUNS_DIR = '.claude/.state/agent-eval-runs';
export const ALL_RULES_KEY = 'ALL';
const WILSON_Z = 1.96;
const CONVENTION_DIR = fileURLToPath(new URL('./', import.meta.url));
const GOLDEN_MANIFEST = 'golden.json';
const RUN_REF_PATTERN = /^[\w.-]+$/;
const LABEL_WIDTH = 24;

export interface GateThresholds {
  minPrecision: number;
  minRecall: number;
  maxCleanFalsePositives: number;
  minRepeats: number;
}

// Q9, decided 2026-10-23: the hard rules in CLAUDE.md. They are scored from the golden answers rather than
// the severity the model emits, so a model cannot improve its own score by downgrading a finding.
export const CRITICAL_RULES: readonly ConventionRule[] = ['wrong-test-import', 'inline-locator', 'hierarchical-selector'];
export const P1_GATE: GateThresholds = { minPrecision: 0.8, minRecall: 0.7, maxCleanFalsePositives: 1, minRepeats: 2 };
const GIT_IDENTITY: readonly string[] = [
  '-c',
  'core.autocrlf=false',
  '-c',
  'user.name=golden',
  '-c',
  'user.email=golden@example.test',
  '-c',
  'commit.gpgsign=false',
];

export interface ExpectedFinding {
  rule: ConventionRule;
  file: string;
  line?: number;
  check?: PrecheckId;
}

export interface GoldenCase {
  id: string;
  kind: 'defect' | 'clean';
  diff: string;
  expected: ExpectedFinding[];
}

export interface GoldenManifest {
  cases: GoldenCase[];
}

export interface RuleCounts {
  tp: number;
  fp: number;
  fn: number;
}

export type CaseScore = Record<string, RuleCounts>;

export interface RuleMetrics extends RuleCounts {
  rule: string;
  precision?: number;
  recall?: number;
  precisionCi?: [number, number];
  recallCi?: [number, number];
}

export interface SourceScores {
  score: CaseScore;
  modelScore: CaseScore;
  critical: RuleCounts;
  modelCritical: RuleCounts;
}

export interface KindedScores extends SourceScores {
  kind: GoldenCase['kind'];
}

export interface EvalCaseRun extends KindedScores {
  caseId: string;
  repeat: number;
  outcome: string;
  findings: ConventionFinding[];
  modelFindings: ConventionFinding[];
  costUsd: number;
  modelUsage: Record<string, ModelTokenUsage>;
  leak: boolean;
}

export interface CriticalSummary {
  merged: RuleMetrics;
  model: RuleMetrics;
  cleanFalsePositives: number;
}

export interface GateResult {
  pass: boolean;
  reasons: string[];
}

export interface EvalRun {
  id: string;
  createdAt: string;
  repeats: number;
  cases: EvalCaseRun[];
  metrics: RuleMetrics[];
  modelMetrics: RuleMetrics[];
  critical: CriticalSummary;
  totalCostUsd: number;
  harnessFailures: number;
  leakHits: number;
}

export interface McNemarResult {
  comparedCases: number;
  onlyAPasses: number;
  onlyBPasses: number;
  pValue: number;
}

export interface CaseRepo {
  dir: string;
  sha: string;
  cleanup: () => void;
}

export function wilson(p: number, n: number, z: number = WILSON_Z): [number, number] {
  if (n === 0) return [0, 0];
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function mcnemar(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  let tail = 0;
  let coefficient = 1;
  for (let i = 0; i <= Math.min(b, c); i += 1) {
    tail += coefficient;
    coefficient = (coefficient * (n - i)) / (i + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

function emptyCounts(): RuleCounts {
  return { tp: 0, fp: 0, fn: 0 };
}

function bump(score: CaseScore, rule: string, field: keyof RuleCounts): void {
  score[rule] ??= emptyCounts();
  score[rule][field] += 1;
}

interface MatchedFindings {
  pairs: { want: ExpectedFinding; got?: ConventionFinding }[];
  unmatched: ConventionFinding[];
}

function matchesExpected(want: ExpectedFinding, got: ConventionFinding): boolean {
  return got.rule === want.rule && got.file === want.file && (want.line === undefined || got.line === want.line);
}

function matchFindings(expected: readonly ExpectedFinding[], actual: readonly ConventionFinding[]): MatchedFindings {
  const unmatched = [...actual];
  const pairs: MatchedFindings['pairs'] = [];
  for (const want of expected) {
    const index = unmatched.findIndex((got) => matchesExpected(want, got));
    pairs.push({ want, got: index === -1 ? undefined : unmatched.splice(index, 1)[0] });
  }
  return { pairs, unmatched };
}

export function scoreCase(expected: readonly ExpectedFinding[], actual: readonly ConventionFinding[]): CaseScore {
  const score: CaseScore = {};
  const { pairs, unmatched } = matchFindings(expected, actual);
  for (const { want, got } of pairs) bump(score, want.rule, got === undefined ? 'fn' : 'tp');
  for (const extra of unmatched) bump(score, extra.rule, 'fp');
  return score;
}

export function modelOnlyView(
  expected: readonly ExpectedFinding[],
  modelFindings: readonly ConventionFinding[],
): { expected: ExpectedFinding[]; actual: ConventionFinding[] } {
  const deterministic = expected.filter((want) => want.check !== undefined);
  return {
    expected: expected.filter((want) => want.check === undefined),
    actual: modelFindings.filter((got) => !deterministic.some((want) => matchesExpected(want, got))),
  };
}

export function scoreModelOnly(expected: readonly ExpectedFinding[], modelFindings: readonly ConventionFinding[]): CaseScore {
  const view = modelOnlyView(expected, modelFindings);
  return scoreCase(view.expected, view.actual);
}

function sumCounts(list: readonly RuleCounts[]): RuleCounts {
  return list.reduce((total, c) => ({ tp: total.tp + c.tp, fp: total.fp + c.fp, fn: total.fn + c.fn }), emptyCounts());
}

export function scoreCritical(score: CaseScore): RuleCounts {
  return sumCounts(CRITICAL_RULES.map((rule) => score[rule] ?? emptyCounts()));
}

export function scoreSources(
  expected: readonly ExpectedFinding[],
  findings: readonly ConventionFinding[],
  modelFindings: readonly ConventionFinding[],
): SourceScores {
  const view = modelOnlyView(expected, modelFindings);
  const score = scoreCase(expected, findings);
  const modelScore = scoreCase(view.expected, view.actual);
  return { score, modelScore, critical: scoreCritical(score), modelCritical: scoreCritical(modelScore) };
}

export function summarizeCritical(cases: readonly KindedScores[], repeats: number): CriticalSummary {
  return {
    merged: toMetrics('critical (merged)', sumCounts(cases.map((entry) => entry.critical)), repeats),
    model: toMetrics('critical (model-only)', sumCounts(cases.map((entry) => entry.modelCritical)), repeats),
    cleanFalsePositives: cases.filter((entry) => entry.kind === 'clean').reduce((sum, entry) => sum + entry.critical.fp, 0),
  };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function belowFloor(label: string, value: number | undefined, floor: number): string | undefined {
  if (value !== undefined && value >= floor) return undefined;
  return `${label} ${value === undefined ? 'n/a' : percent(value)} is below ${percent(floor)}`;
}

// Precision and clean-diff hits are gated on merged findings because that is what gets posted. Recall must
// also clear the floor model-only: every wrong-test-import case is a guaranteed pre-check hit, which would
// otherwise let merged recall pass while the model misses most of the rules only it can catch.
export function evaluateGate(
  run: Pick<EvalRun, 'critical' | 'harnessFailures' | 'leakHits' | 'repeats'>,
  gate: GateThresholds = P1_GATE,
): GateResult {
  const { merged, model, cleanFalsePositives } = run.critical;
  const reasons = [
    belowFloor('critical precision', merged.precision, gate.minPrecision),
    belowFloor('critical recall', merged.recall, gate.minRecall),
    belowFloor('model-only critical recall', model.recall, gate.minRecall),
  ].filter((reason) => reason !== undefined);
  if (cleanFalsePositives > gate.maxCleanFalsePositives) {
    reasons.push(`${cleanFalsePositives} critical finding(s) on clean diffs, max ${gate.maxCleanFalsePositives}`);
  }
  if (run.harnessFailures > 0) reasons.push(`${run.harnessFailures} run(s) did not succeed`);
  if (run.leakHits > 0) reasons.push(`${run.leakHits} leak hit(s)`);
  if (run.repeats < gate.minRepeats) reasons.push(`${run.repeats} repeat(s); a gate run needs ${gate.minRepeats}`);
  return { pass: reasons.length === 0, reasons };
}

export function isCaseCorrect(score: CaseScore): boolean {
  return Object.values(score).every((counts) => counts.fp === 0 && counts.fn === 0);
}

export function sumScores(scores: readonly CaseScore[]): Record<string, RuleCounts> {
  const total: Record<string, RuleCounts> = { [ALL_RULES_KEY]: emptyCounts() };
  for (const score of scores) {
    for (const [rule, counts] of Object.entries(score)) {
      total[rule] ??= emptyCounts();
      for (const field of ['tp', 'fp', 'fn'] as const) {
        total[rule][field] += counts[field];
        total[ALL_RULES_KEY][field] += counts[field];
      }
    }
  }
  return total;
}

function rate(hits: number, total: number, repeats: number): { value?: number; ci?: [number, number] } {
  if (total === 0) return {};
  // Repeats of one case are correlated, so the interval is sized by distinct observations.
  const distinct = Math.max(1, Math.ceil(total / repeats));
  return { value: hits / total, ci: wilson(hits / total, distinct) };
}

function compareRuleKeys(a: string, b: string): number {
  if (a === ALL_RULES_KEY) return 1;
  if (b === ALL_RULES_KEY) return -1;
  return a.localeCompare(b);
}

function toMetrics(rule: string, counts: RuleCounts, repeats: number): RuleMetrics {
  const precision = rate(counts.tp, counts.tp + counts.fp, repeats);
  const recall = rate(counts.tp, counts.tp + counts.fn, repeats);
  return {
    rule,
    ...counts,
    precision: precision.value,
    recall: recall.value,
    precisionCi: precision.ci,
    recallCi: recall.ci,
  };
}

export function computeMetrics(scores: readonly CaseScore[], repeats: number): RuleMetrics[] {
  return Object.entries(sumScores(scores))
    .sort(([a], [b]) => compareRuleKeys(a, b))
    .map(([rule, counts]) => toMetrics(rule, counts, repeats));
}

function passingCases(run: EvalRun): Map<string, boolean> {
  const verdicts = new Map<string, boolean>();
  for (const entry of run.cases) {
    verdicts.set(entry.caseId, (verdicts.get(entry.caseId) ?? true) && isCaseCorrect(entry.score));
  }
  return verdicts;
}

export function compareRuns(a: EvalRun, b: EvalRun): McNemarResult {
  const passA = passingCases(a);
  const passB = passingCases(b);
  let onlyAPasses = 0;
  let onlyBPasses = 0;
  let comparedCases = 0;
  for (const [caseId, aPasses] of passA) {
    const bPasses = passB.get(caseId);
    if (bPasses === undefined) continue;
    comparedCases += 1;
    if (aPasses && !bPasses) onlyAPasses += 1;
    if (!aPasses && bPasses) onlyBPasses += 1;
  }
  return { comparedCases, onlyAPasses, onlyBPasses, pValue: mcnemar(onlyAPasses, onlyBPasses) };
}

export function loadGolden(conventionDir: string = CONVENTION_DIR): GoldenManifest {
  return JSON.parse(readFileSync(join(conventionDir, GOLDEN_MANIFEST), 'utf8')) as GoldenManifest;
}

export function readGoldenDiff(goldenCase: GoldenCase, conventionDir: string = CONVENTION_DIR): string {
  return readFileSync(join(conventionDir, goldenCase.diff), 'utf8').replace(/\r\n/g, '\n');
}

function gitIn(dir: string, args: readonly string[], input?: string): string {
  return execFileSync('git', [...GIT_IDENTITY, ...args], {
    cwd: dir,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function buildCaseRepo(diffText: string): CaseRepo {
  const dir = mkdtempSync(join(tmpdir(), 'golden-repo-'));
  const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
  try {
    gitIn(dir, ['init', '--quiet']);
    writeFileSync(join(dir, 'README.md'), 'golden fixture repo\n');
    gitIn(dir, ['add', '-A']);
    gitIn(dir, ['commit', '--quiet', '--no-verify', '-m', 'initial']);
    gitIn(dir, ['apply', '--index', '-'], diffText.replace(/\r\n/g, '\n'));
    gitIn(dir, ['commit', '--quiet', '--no-verify', '-m', 'golden change']);
    return { dir, sha: gitIn(dir, ['rev-parse', 'HEAD']).trim(), cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export interface LiveEvalOptions {
  repeats: number;
  authMode: AuthMode;
  ruleRoot: string;
  conventionDir?: string;
}

export async function runLiveEval(options: LiveEvalOptions): Promise<EvalRun> {
  const manifest = loadGolden(options.conventionDir);
  const cases: EvalCaseRun[] = [];
  for (const goldenCase of manifest.cases) {
    const diffText = readGoldenDiff(goldenCase, options.conventionDir);
    for (let repeat = 1; repeat <= options.repeats; repeat += 1) {
      const repo = buildCaseRepo(diffText);
      try {
        const result = await reviewCommit({
          targetRoot: repo.dir,
          ruleRoot: options.ruleRoot,
          sha: repo.sha,
          authMode: options.authMode,
        });
        const reviewed = result.kind === 'reviewed' ? result : undefined;
        const findings = reviewed?.findings ?? [];
        const modelFindings = reviewed?.modelFindings ?? [];
        const outcome = reviewed?.report.outcome ?? 'empty-diff';
        cases.push({
          caseId: goldenCase.id,
          kind: goldenCase.kind,
          repeat,
          outcome,
          findings,
          modelFindings,
          ...scoreSources(goldenCase.expected, findings, modelFindings),
          costUsd: reviewed?.report.costUsdEstimate ?? 0,
          modelUsage: reviewed?.report.modelUsage ?? {},
          leak: hasLeak(JSON.stringify([findings, modelFindings])),
        });
        console.log(`${goldenCase.id} #${repeat}: ${outcome}, ${findings.length} finding(s)`);
      } finally {
        repo.cleanup();
      }
    }
  }
  const createdAt = new Date().toISOString();
  return {
    id: createdAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'),
    createdAt,
    repeats: options.repeats,
    cases,
    metrics: computeMetrics(cases.map((entry) => entry.score), options.repeats),
    modelMetrics: computeMetrics(cases.map((entry) => entry.modelScore), options.repeats),
    critical: summarizeCritical(cases, options.repeats),
    totalCostUsd: cases.reduce((sum, entry) => sum + entry.costUsd, 0),
    harnessFailures: cases.filter((entry) => entry.outcome !== 'success').length,
    leakHits: cases.filter((entry) => entry.leak).length,
  };
}

export function formatMetrics(metrics: readonly RuleMetrics[]): string {
  const withCi = (value?: number, ci?: [number, number]): string =>
    value === undefined || ci === undefined ? 'n/a' : `${percent(value)} [${percent(ci[0])}-${percent(ci[1])}]`;
  const rows = metrics.map(
    (m) =>
      `${m.rule.padEnd(LABEL_WIDTH)} tp=${m.tp} fp=${m.fp} fn=${m.fn}  precision ${withCi(m.precision, m.precisionCi)}  recall ${withCi(m.recall, m.recallCi)}`,
  );
  return rows.join('\n');
}

export function formatCritical(critical: CriticalSummary): string {
  return [
    formatMetrics([critical.merged, critical.model]),
    `${'clean-diff critical'.padEnd(LABEL_WIDTH)} ${critical.cleanFalsePositives} finding(s)`,
  ].join('\n');
}

export function formatGate(result: GateResult): string {
  return result.pass ? 'P1 to P2 gate: PASS' : `P1 to P2 gate: FAIL (${result.reasons.join('; ')})`;
}

export function formatEvalReport(run: Pick<EvalRun, 'metrics' | 'modelMetrics' | 'critical'>): string {
  return [
    'merged findings (pre-checks + model)',
    formatMetrics(run.metrics),
    '',
    'model-only findings (judgement rules; pre-check duplicates excluded)',
    formatMetrics(run.modelMetrics),
    '',
    `critical rules (${CRITICAL_RULES.join(', ')})`,
    formatCritical(run.critical),
  ].join('\n');
}

export function resolveRunPath(ref: string, root: string): string {
  if (isAbsolute(ref) || ref.includes('/') || ref.includes('\\')) return resolve(ref);
  if (!RUN_REF_PATTERN.test(ref)) throw new Error(`invalid run reference: ${ref}`);
  return join(root, EVAL_RUNS_DIR, ref.endsWith('.json') ? ref : `${ref}.json`);
}

export function saveRun(run: EvalRun, root: string): string {
  const dir = join(root, EVAL_RUNS_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${run.id}.json`);
  writeFileSync(path, JSON.stringify(run, null, 2));
  return path;
}

function loadRun(ref: string, root: string): EvalRun {
  return JSON.parse(readFileSync(resolveRunPath(ref, root), 'utf8')) as EvalRun;
}

export async function runEvalCli(argv: readonly string[], root: string, env: NodeJS.ProcessEnv): Promise<number> {
  let repeats = CONVENTION_EVAL_DEFAULT_REPEATS;
  let compare = false;
  let refs: string[] = [];
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { repeats: { type: 'string' }, compare: { type: 'boolean' } },
    });
    compare = values.compare === true;
    refs = positionals;
    if (values.repeats !== undefined) repeats = Number(values.repeats);
    if (!Number.isInteger(repeats) || repeats < 1) throw new Error('--repeats must be a positive integer');
    if (compare && refs.length !== 2) throw new Error('--compare takes exactly two runs: <runA> <runB>');
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : 'invalid arguments'}\nusage: [--repeats N] | --compare <runA> <runB>`);
    return 1;
  }

  try {
    if (compare) {
      const result = compareRuns(loadRun(refs[0], root), loadRun(refs[1], root));
      console.log(
        `McNemar over ${result.comparedCases} case(s): only A passes ${result.onlyAPasses}, ` +
          `only B passes ${result.onlyBPasses}, p=${result.pValue.toFixed(4)}`,
      );
      return 0;
    }

    const authMode = parseAuthMode(env.AGENT_AUTH_MODE);
    const credentialVar = credentialVarFor(authMode);
    if (env[credentialVar] === undefined || env[credentialVar] === '') {
      console.error(`${credentialVar} is required for the live eval (auth mode '${authMode}') but is not set. No model call was made.`);
      return 1;
    }
    const run = await runLiveEval({ repeats, authMode, ruleRoot: root });
    const path = saveRun(run, root);
    console.log(formatEvalReport(run));
    console.log(`cost $${run.totalCostUsd.toFixed(4)}, harness failures ${run.harnessFailures}, leak hits ${run.leakHits}`);
    const gate = evaluateGate(run);
    console.log(formatGate(gate));
    console.log(`saved ${path}`);
    return gate.pass ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'eval failed');
    return 1;
  }
}

if (isEntryPoint(import.meta.url, process.argv[1])) {
  process.exitCode = await runEvalCli(process.argv.slice(2), fileURLToPath(new URL('../../../', import.meta.url)), process.env);
}
