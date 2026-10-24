import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { AGENT_DELIVERY_REGISTRY, prepareDelivery, runDelivery } from '../harness/deliver.ts';
import type { FetchLike } from '../harness/deliver.ts';
import {
  CONVENTION_REVIEWER_MAX_BUDGET_USD,
  CONVENTION_REVIEWER_MAX_TURNS,
  MAX_DIFF_CHARS,
  MAX_EVIDENCE_CHARS,
  MAX_FINDINGS,
  MAX_PATH_CHARS,
  MAX_SUGGESTION_CHARS,
  MAX_SUMMARY_CHARS,
  MAX_TOOL_TEXT_CHARS,
} from '../harness/limits.ts';
import type { SlackBlock, SlackMessage } from '../harness/slack.ts';
import { listTrackedFiles } from '../harness/tracked-files.ts';
import type { AgentRunReport, AgentSpec } from '../harness/types.ts';
import {
  ALL_RULES_KEY,
  CRITICAL_RULES,
  EVAL_RUNS_DIR,
  P1_GATE,
  buildCaseRepo,
  compareRuns,
  computeMetrics,
  evaluateGate,
  formatEvalReport,
  formatGate,
  isCaseCorrect,
  loadGolden,
  mcnemar,
  offAllowlistTools,
  readGoldenDiff,
  runEvalCli,
  scoreCase,
  scoreCritical,
  scoreModelOnly,
  scoreSources,
  summarizeCritical,
  wilson,
} from './eval.ts';
import type { CaseRepo, CaseScore, CriticalSummary, EvalRun, ExpectedFinding } from './eval.ts';
import {
  capFinding,
  mergeFindings,
  parseCapOverride,
  renderReviewMarkdown,
  reviewCommit,
  runCli,
  validateFindings,
  writeReviewOutputs,
} from './main.ts';
import type { AgentRunner, CompletedReview, ReviewResult } from './main.ts';
import { PRECHECK_IDS, parseDiff, runPrechecks, toFinding } from './prechecks.ts';
import { RULE_SOURCES, buildSystemPrompt, extractSection, loadRuleText } from './prompt.ts';
import { inert, renderConventionMarkdown, renderConventionSlack } from './render.ts';
import { CONVENTION_RULES, ConventionFindingSchema, ConventionReviewOutputSchema } from './schema.ts';
import type { ConventionFinding, ConventionReviewOutput, ConventionRule, ConventionSeverity } from './schema.ts';
import {
  DIFF_TRUNCATION_NOTICE,
  REVIEW_PATH_PREFIXES,
  createReviewTools,
  fenceUntrusted,
  getScopedDiff,
  renderDiff,
  resolveBase,
  resolveSha,
} from './tools.ts';
import type { ReviewToolContext } from './tools.ts';

const CONVENTION_DIR = fileURLToPath(new URL('./', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAIN_PATH = join(CONVENTION_DIR, 'main.ts');
const NODE_FLAGS = ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];
const PLANTED_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlLXZhbHVl';
const ZERO_WIDTH_SPACE = '\u200b';
const JUDGEMENT_RULES: readonly ConventionRule[] = [
  'inline-locator',
  'hierarchical-selector',
  'non-semantic-locator',
  'soft-vs-hard-assertion',
  'unnamed-data-interface',
  'comment-smell',
];
const CREDENTIAL_VARS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'AGENT_AUTH_MODE'];

const goldenManifest = loadGolden();
const tempDirs: string[] = [];

after(async () => {
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
});

afterEach(() => mock.restoreAll());

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function gitIn(dir: string, args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

async function makeRepoWithCommit(files: Record<string, string>): Promise<{ dir: string; sha: string }> {
  const dir = await tempDir('cr-repo-');
  gitIn(dir, ['init', '--quiet']);
  await writeFile(join(dir, 'README.md'), 'fixture\n');
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '--quiet', '--no-verify', '-m', 'initial']);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '--quiet', '--no-verify', '-m', 'change']);
  return { dir, sha: gitIn(dir, ['rev-parse', 'HEAD']).trim() };
}

function caseRepoFor(id: string): CaseRepo {
  const goldenCase = goldenManifest.cases.find((entry) => entry.id === id);
  assert.ok(goldenCase, `golden case ${id} exists`);
  return buildCaseRepo(readGoldenDiff(goldenCase, CONVENTION_DIR));
}

function finding(overrides: Partial<ConventionFinding> = {}): ConventionFinding {
  return {
    rule: 'inline-locator',
    severity: 'warning',
    file: 'tests/ecommerce/home-banner.spec.ts',
    line: 5,
    evidence: "await page.locator('.x').click();",
    suggestion: 'Hoist the locator to a private readonly field.',
    ...overrides,
  };
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of CREDENTIAL_VARS) delete env[name];
  return env;
}

function fakeReport(
  overrides: Partial<AgentRunReport<ConventionReviewOutput>> = {},
): AgentRunReport<ConventionReviewOutput> {
  return {
    agent: 'review',
    outcome: 'success',
    resultSubtype: 'success',
    output: { summary: 'Looks fine.', findings: [] },
    costUsdEstimate: 0.1,
    numTurns: 3,
    modelUsage: {},
    permissionDenials: 0,
    toolUseNames: [],
    apiKeySource: 'none',
    claudeCodeVersion: '0.0.0-test',
    resolvedModel: 'test-model',
    managedSettingsKeys: [],
    durationMs: 10,
    errors: [],
    ...overrides,
  };
}

interface RunnerCall {
  specName: string;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  toolNames: string[];
  systemPrompt: string;
  prompt: string;
}

function fakeRunner(report: AgentRunReport<ConventionReviewOutput>, calls: RunnerCall[]): AgentRunner {
  const runner = async (
    spec: AgentSpec<ConventionReviewOutput>,
    prompt: string,
  ): Promise<AgentRunReport<ConventionReviewOutput>> => {
    calls.push({
      specName: spec.name,
      model: spec.model,
      maxTurns: spec.maxTurns,
      maxBudgetUsd: spec.maxBudgetUsd,
      toolNames: spec.tools.map((t) => t.name),
      systemPrompt: spec.systemPrompt,
      prompt,
    });
    return report;
  };
  return runner as unknown as AgentRunner;
}

function runReview(dir: string, sha: string, runner: AgentRunner): Promise<ReviewResult> {
  return reviewCommit({ targetRoot: dir, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' }, runner);
}

function unfence(text: string, label: string): string {
  const lines = text.split('\n');
  assert.match(lines[0], new RegExp(`^<<<UNTRUSTED-DATA id=[0-9a-f]{16} label=${label}>>>$`));
  assert.match(lines[lines.length - 1], /^<<<END-UNTRUSTED-DATA id=[0-9a-f]{16}>>>$/);
  return lines.slice(1, -1).join('\n');
}

function key(entry: { check?: string; rule: string; file: string; line?: number }): string {
  return `${entry.check ?? entry.rule}|${entry.file}|${entry.line}`;
}

describe('golden fixtures', () => {
  it('keeps golden.json and golden/ in one-to-one correspondence', () => {
    const onDisk = readdirSync(join(CONVENTION_DIR, 'golden')).sort();
    const listed = goldenManifest.cases.map((entry) => entry.diff.replace('golden/', '')).sort();
    assert.deepEqual(onDisk, listed);
    assert.equal(new Set(goldenManifest.cases.map((entry) => entry.id)).size, goldenManifest.cases.length);
    assert.ok(onDisk.every((name) => name.endsWith('.diff')), 'golden fixtures are .diff text, never .ts');
  });

  it('has enough defect and clean cases and covers every rule', () => {
    const defects = goldenManifest.cases.filter((entry) => entry.kind === 'defect');
    const clean = goldenManifest.cases.filter((entry) => entry.kind === 'clean');
    assert.ok(defects.length >= 15, `defect cases: ${defects.length}`);
    assert.ok(clean.length >= 10, `clean cases: ${clean.length}`);
    assert.ok(defects.every((entry) => entry.expected.length > 0));
    assert.ok(clean.every((entry) => entry.expected.length === 0));

    const expected = goldenManifest.cases.flatMap((entry) => entry.expected);
    const checks = new Set(expected.map((entry) => entry.check).filter((check) => check !== undefined));
    for (const id of PRECHECK_IDS) assert.ok(checks.has(id), `precheck ${id} has a defect case`);
    const judged = new Set(expected.filter((entry) => entry.check === undefined).map((entry) => entry.rule));
    for (const rule of JUDGEMENT_RULES) assert.ok(judged.has(rule), `judgement rule ${rule} has a defect case`);
  });

  it('has at least three defect cases for every critical rule the gate scores', () => {
    const expected = goldenManifest.cases.flatMap((entry) => entry.expected);
    for (const rule of CRITICAL_RULES) {
      const count = expected.filter((entry) => entry.rule === rule).length;
      assert.ok(count >= 3, `critical rule ${rule} has ${count} golden case(s)`);
    }
  });
});

describe('pre-checks through the real git path', () => {
  for (const goldenCase of goldenManifest.cases) {
    it(`${goldenCase.kind}: ${goldenCase.id}`, () => {
      const repo = buildCaseRepo(readGoldenDiff(goldenCase, CONVENTION_DIR));
      try {
        const sha = resolveSha(repo.dir, repo.sha);
        const diff = getScopedDiff(repo.dir, resolveBase(repo.dir, sha, undefined), sha);
        const hits = runPrechecks(parseDiff(diff).addedLines);
        const expectedDeterministic = goldenCase.expected.filter((entry) => entry.check !== undefined);
        assert.deepEqual(hits.map(key).sort(), expectedDeterministic.map(key).sort());
        for (const want of expectedDeterministic) {
          const hit = hits.find((candidate) => key(candidate) === key(want));
          assert.equal(hit?.rule, want.rule);
        }
      } finally {
        repo.cleanup();
      }
    });
  }
});

describe('diff parser', () => {
  const diff = [
    'diff --git a/tests/a.spec.ts b/tests/a.spec.ts',
    'index 1111111..2222222 100644',
    '--- a/tests/a.spec.ts',
    '+++ b/tests/a.spec.ts',
    '@@ -1,4 +1,5 @@',
    ' import x',
    '-const old: any = 1;',
    '+const added: any = 1;',
    ' const keep = 2;',
    '+await page.waitForTimeout(1);',
    ' end',
    '@@ -20,3 +21,3 @@',
    ' context',
    "-console.log('removed');",
    '+const y = 1;',
    ' context2',
    '@@ -40,2 +41,3 @@',
    ' a',
    '+b',
    ' c',
    '\\ No newline at end of file',
    'diff --git a/tests/gone.spec.ts b/tests/gone.spec.ts',
    'deleted file mode 100644',
    '--- a/tests/gone.spec.ts',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    "-console.log('gone');",
    '-const z: any = 1;',
    '',
  ].join('\n');

  it('tracks new-side line numbers across hunks and ignores removed and context lines', () => {
    const parsed = parseDiff(diff);
    assert.deepEqual(
      parsed.addedLines.map((line) => [line.line, line.text]),
      [
        [2, 'const added: any = 1;'],
        [4, 'await page.waitForTimeout(1);'],
        [22, 'const y = 1;'],
        [42, 'b'],
      ],
    );
    assert.deepEqual([...parsed.files], ['tests/a.spec.ts']);
  });

  it('only fires pre-checks on added lines', () => {
    const hits = runPrechecks(parseDiff(diff).addedLines);
    assert.deepEqual(hits.map((hit) => `${hit.check}@${hit.line}`), ['explicit-any@2', 'fixed-sleep@4']);
  });
});

describe('post-validation and merging', () => {
  it('keeps valid findings and drops hallucinated files and lines', () => {
    const repo = caseRepoFor('defect-fixed-sleep');
    try {
      const file = 'tests/ecommerce/home-banner.spec.ts';
      const lastLine = readFileSync(join(repo.dir, file), 'utf8').split('\n').length - 1;
      const ctx = { targetRoot: repo.dir, sha: repo.sha, diffFiles: new Set([file]) };
      const valid = finding({ file, line: 11 });
      const lastReal = finding({ file, line: lastLine });
      const phantomLine = finding({ file, line: lastLine + 1 });
      const farLine = finding({ file, line: 9999 });
      const outsideDiff = finding({ file: 'README.md', line: 1 });
      const invented = finding({ file: 'src/pages/does-not-exist.ts', line: 1 });
      const traversal = finding({ file: '../../etc/passwd', line: 1 });

      const result = validateFindings([valid, lastReal, phantomLine, farLine, outsideDiff, invented, traversal], ctx);
      assert.deepEqual(result.kept, [valid, lastReal]);
      assert.deepEqual(result.dropped, [phantomLine, farLine, outsideDiff, invented, traversal]);
    } finally {
      repo.cleanup();
    }
  });

  it('de-duplicates with pre-checks winning and caps the merged list', () => {
    const pre = finding({ rule: 'fixed-sleep', line: 3, suggestion: 'from precheck' });
    const dup = finding({ rule: 'fixed-sleep', line: 3, suggestion: 'from model' });
    const many = Array.from({ length: 30 }, (_, index) => finding({ line: 100 + index }));
    const merged = mergeFindings([pre], [dup, ...many]);
    assert.equal(merged.findings.length, MAX_FINDINGS);
    assert.equal(merged.findings[0].suggestion, 'from precheck');
    assert.equal(merged.findings.filter((entry) => entry.line === 3).length, 1);
    assert.equal(merged.droppedByCap, 31 - MAX_FINDINGS);
  });

  it('keeps mention-neutralised evidence inside the schema caps', () => {
    const heavy = capFinding(finding({ evidence: '@a '.repeat(190), suggestion: '@b '.repeat(290) }));
    assert.ok(heavy.evidence.includes(ZERO_WIDTH_SPACE), 'mention neutralisation ran');
    assert.ok(heavy.evidence.length <= MAX_EVIDENCE_CHARS);
    assert.ok(heavy.suggestion.length <= MAX_SUGGESTION_CHARS);
    assert.equal(ConventionFindingSchema.safeParse(heavy).success, true);
    const output = ConventionReviewOutputSchema.safeParse({ summary: 'x', findings: [heavy] });
    assert.equal(output.success, true);
  });
});

describe('reviewCommit with a stubbed agent runner', () => {
  const FILE = 'tests/ecommerce/home-banner.spec.ts';

  it('wires the spec, merges model findings with pre-checks and drops hallucinations', async () => {
    const repo = caseRepoFor('defect-fixed-sleep');
    try {
      const calls: RunnerCall[] = [];
      const modelFindings: ConventionFinding[] = [
        finding({ file: FILE, line: 5, evidence: 'const x: Array<string> = [];' }),
        finding({ file: FILE, line: 4000 }),
        finding({ file: 'src/pages/ghost.ts', line: 1 }),
        finding({ rule: 'fixed-sleep', file: FILE, line: 10 }),
      ];
      const report = fakeReport({ output: { summary: 'Two issues.', findings: modelFindings } });
      const result = await runReview(repo.dir, repo.sha, fakeRunner(report, calls));

      assert.equal(result.kind, 'reviewed');
      if (result.kind !== 'reviewed') return;
      assert.equal(calls.length, 1);
      assert.equal(calls[0].specName, 'review');
      assert.equal(calls[0].model, 'sonnet');
      assert.equal(calls[0].maxTurns, CONVENTION_REVIEWER_MAX_TURNS);
      assert.equal(calls[0].maxBudgetUsd, CONVENTION_REVIEWER_MAX_BUDGET_USD);
      assert.deepEqual(calls[0].toolNames, ['get_diff', 'read_file', 'get_precheck_findings']);
      assert.ok(calls[0].systemPrompt.includes('untrusted'));
      assert.deepEqual(result.findings.map((entry) => `${entry.rule}@${entry.line}`), ['fixed-sleep@10', 'inline-locator@5']);
      assert.deepEqual(result.stats, { precheck: 1, model: 4, droppedByValidation: 2, kept: 2, droppedByCap: 0 });
      assert.deepEqual(
        result.modelFindings.map((entry) => `${entry.rule}@${entry.line}`),
        ['inline-locator@5', 'fixed-sleep@10'],
      );
      assert.equal(ConventionReviewOutputSchema.safeParse(result.report.output).success, true);

      const markdown = renderReviewMarkdown(result);
      assert.ok(markdown.includes('`const x: Array<string> = [];`'), 'code span is not Slack-escaped');
      assert.ok(!markdown.includes('&lt;'));
    } finally {
      repo.cleanup();
    }
  });

  it('returns only pre-checks and no output when the run did not succeed', async () => {
    const repo = caseRepoFor('defect-fixed-sleep');
    try {
      const report = fakeReport({ outcome: 'usage-exhausted', output: undefined, errors: ['rate limited'] });
      const result = await runReview(repo.dir, repo.sha, fakeRunner(report, []));
      assert.equal(result.kind, 'reviewed');
      if (result.kind !== 'reviewed') return;
      assert.equal(result.report.output, undefined);
      assert.deepEqual(result.modelFindings, []);
      assert.deepEqual(result.findings.map((entry) => entry.rule), ['fixed-sleep']);
      assert.ok(renderReviewMarkdown(result).includes('did not complete'));
    } finally {
      repo.cleanup();
    }
  });

  it('passes lowered caps from the request to the agent spec', async () => {
    const repo = caseRepoFor('defect-fixed-sleep');
    try {
      const calls: RunnerCall[] = [];
      const request = { targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha: repo.sha, authMode: 'subscription-oauth' as const };
      await reviewCommit({ ...request, maxTurns: 1, maxBudgetUsd: 0.01 }, fakeRunner(fakeReport(), calls));
      assert.equal(calls[0].maxTurns, 1);
      assert.equal(calls[0].maxBudgetUsd, 0.01);
    } finally {
      repo.cleanup();
    }
  });

  it('reports an empty review without calling the runner', async () => {
    const { dir, sha } = await makeRepoWithCommit({ 'docs/notes.md': 'docs only\n' });
    const calls: RunnerCall[] = [];
    const result = await runReview(dir, sha, fakeRunner(fakeReport(), calls));
    assert.equal(result.kind, 'empty');
    assert.equal(calls.length, 0);
  });

  it('refuses to write anything when the rendered review leaks a secret', async () => {
    const repo = caseRepoFor('defect-fixed-sleep');
    try {
      const result = await runReview(repo.dir, repo.sha, fakeRunner(fakeReport(), []));
      assert.equal(result.kind, 'reviewed');
      if (result.kind !== 'reviewed') return;
      const leaking: CompletedReview = {
        ...result,
        report: { ...result.report, output: { summary: PLANTED_JWT, findings: result.findings } },
      };
      const out = join(await tempDir('cr-out-'), 'nested');
      await assert.rejects(writeReviewOutputs(out, leaking), /leak detected/);
      assert.equal(existsSync(out), false);

      const escapedAway: CompletedReview = {
        ...result,
        report: { ...result.report, output: { summary: `token ghp_${'a1B2'.repeat(9)}`, findings: result.findings } },
      };
      const outTwo = join(await tempDir('cr-out-'), 'nested');
      await assert.rejects(writeReviewOutputs(outTwo, escapedAway), /leak detected/);
      assert.equal(existsSync(outTwo), false);
    } finally {
      repo.cleanup();
    }
  });

  it('writes the report, markdown and run log', async () => {
    const repo = caseRepoFor('defect-fixed-sleep');
    try {
      const result = await runReview(repo.dir, repo.sha, fakeRunner(fakeReport(), []));
      assert.equal(result.kind, 'reviewed');
      if (result.kind !== 'reviewed') return;
      const out = join(await tempDir('cr-out-'), 'nested');
      await writeReviewOutputs(out, result);
      assert.deepEqual(readdirSync(out).sort(), ['convention-review.json', 'convention-review.md', 'run-log.json']);
      const log = JSON.parse(readFileSync(join(out, 'run-log.json'), 'utf8')) as Record<string, unknown>;
      for (const field of ['costUsdEstimate', 'numTurns', 'modelUsage', 'apiKeySource', 'claudeCodeVersion', 'resolvedModel']) {
        assert.ok(field in log, `run-log has ${field}`);
      }
    } finally {
      repo.cleanup();
    }
  });
});

describe('markdown rendering', () => {
  const output: ConventionReviewOutput = {
    summary: 'One issue.',
    findings: [finding({ evidence: 'a &lt;b&gt; &amp; c <d> & e' })],
  };

  it('renders evidence literally for every target, without decoding entities', () => {
    assert.ok(renderConventionMarkdown(output).body.includes('`a &lt;b&gt; &amp; c <d> & e`'));
    // Slack decodes entities once, so the escaped form displays the evidence exactly as the model wrote it.
    const slackSections = renderConventionSlack(output, {}).attachments.flatMap((attachment) => attachment.blocks);
    assert.ok(JSON.stringify(slackSections).includes('```a &amp;lt;b&amp;gt; &amp;amp; c &lt;d&gt; &amp; e```'));
  });
});

describe('markdown inertness', () => {
  const hostile = '[x](https://evil.example) ![](https://t.example/a) ### critical <img src=x>';

  it('renders summary and suggestion with no live markdown', () => {
    const output: ConventionReviewOutput = {
      summary: hostile,
      findings: [finding({ suggestion: `${hostile}\n# heading\n- item` })],
    };
    const { body } = renderConventionMarkdown(output);
    assert.ok(!body.includes(']('), 'no link syntax');
    assert.ok(!/(?<!\\)!\[/.test(body), 'no unescaped image syntax');
    assert.ok(!/(?<!\\)<img/.test(body), 'no raw html tag');
    const unexpectedBlockStart = body
      .split('\n')
      .filter((line) => /^\s*(#|-\s|>)/.test(line))
      .filter((line) => !line.startsWith('### ') && !line.startsWith('- `') && !line.startsWith('  - evidence: `'));
    assert.deepEqual(unexpectedBlockStart, []);
    assert.ok(!body.startsWith('#'));
  });

  it('flattens whitespace and escapes every markdown-active character', () => {
    assert.equal(inert('a\n# b'), 'a \\# b');
    assert.equal(inert('\\`*_[]()<>!#|~'), '\\\\\\`\\*\\_\\[\\]\\(\\)\\<\\>\\!\\#\\|\\~');
  });
});

describe('tools', () => {
  async function toolsFor(overrides: Partial<ReviewToolContext> = {}): Promise<{
    call: (name: string, args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }>;
    cleanup: () => void;
  }> {
    const repo = caseRepoFor('defect-fixed-sleep');
    const sha = resolveSha(repo.dir, repo.sha);
    const diff = getScopedDiff(repo.dir, resolveBase(repo.dir, sha, undefined), sha);
    const parsed = parseDiff(diff);
    const tools = createReviewTools({
      repoRoot: repo.dir,
      sha,
      diff,
      diffFiles: parsed.files,
      trackedFiles: listTrackedFiles(repo.dir, REVIEW_PATH_PREFIXES),
      prechecks: runPrechecks(parsed.addedLines).map(toFinding),
      ...overrides,
    });
    type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<{
      content: { text: string }[];
      isError?: boolean;
    }>;
    return {
      call: async (name, args) => {
        const found = tools.find((entry) => entry.name === name);
        assert.ok(found, `tool ${name} exists`);
        const result = await (found.handler as unknown as Handler)(args, {});
        return { text: result.content[0].text, isError: result.isError === true };
      },
      cleanup: repo.cleanup,
    };
  }

  it('get_diff fences the diff as untrusted data', async () => {
    const { call, cleanup } = await toolsFor();
    try {
      const { text, isError } = await call('get_diff', {});
      assert.equal(isError, false);
      assert.match(text, /^<<<UNTRUSTED-DATA id=[0-9a-f]{16} label=diff>>>/);
      assert.match(text, /<<<END-UNTRUSTED-DATA id=[0-9a-f]{16}>>>$/);
      assert.ok(text.includes('+  10 |     await page.waitForTimeout(3000);'));
    } finally {
      cleanup();
    }
  });

  it('get_diff redacts secrets and caps the size', async () => {
    const big = `+${PLANTED_JWT}\n${'+x'.repeat(MAX_DIFF_CHARS)}`;
    const { call, cleanup } = await toolsFor({ diff: big });
    try {
      const { text } = await call('get_diff', {});
      assert.ok(!text.includes(PLANTED_JWT));
      assert.ok(text.includes('[diff truncated'));
      assert.ok(text.length < MAX_DIFF_CHARS + 500);
    } finally {
      cleanup();
    }
  });

  it('truncates the rendered diff at a line boundary, within the cap plus the notice', () => {
    const line = '+x'.repeat(40);
    const lines = Array.from({ length: 2000 }, () => line);
    const diff = ['+++ b/src/data/x.ts', '@@ -0,0 +1,2000 @@', ...lines].join('\n');

    const rendered = renderDiff(diff);
    assert.ok(rendered.endsWith(DIFF_TRUNCATION_NOTICE));
    assert.ok(rendered.length <= MAX_DIFF_CHARS + DIFF_TRUNCATION_NOTICE.length);
    const keptText = rendered.slice(0, -DIFF_TRUNCATION_NOTICE.length);
    const kept = keptText.split('\n');
    for (const keptLine of kept.slice(2)) assert.match(keptLine, /^\+ *\d+ \| x(\+x){39}$/);
    assert.ok(MAX_DIFF_CHARS - keptText.length <= kept[2].length, 'drops at most the one partial line');
  });

  it('leaves a diff at exactly the cap untruncated', () => {
    const header = ['+++ b/src/data/x.ts', '@@ -0,0 +1 @@'].join('\n');
    const prefix = `${renderDiff(header)}\n+   1 | `;
    const diff = `${header}\n+${'a'.repeat(MAX_DIFF_CHARS - prefix.length)}`;
    const rendered = renderDiff(diff);
    assert.equal(rendered.length, MAX_DIFF_CHARS);
    assert.ok(!rendered.includes(DIFF_TRUNCATION_NOTICE));
  });

  it('keeps a whole last line that ends exactly at the cap', () => {
    const header = ['+++ b/src/data/x.ts', '@@ -0,0 +1,2 @@'].join('\n');
    const prefix = `${renderDiff(header)}\n+   1 | `;
    const firstLine = 'a'.repeat(MAX_DIFF_CHARS - prefix.length);
    assert.equal(renderDiff(`${header}\n+${firstLine}\n+a`), `${prefix}${firstLine}${DIFF_TRUNCATION_NOTICE}`);
  });

  it('reduces a diff with no line break before the cap to the notice alone', () => {
    assert.equal(renderDiff('a'.repeat(MAX_DIFF_CHARS + 1)), DIFF_TRUNCATION_NOTICE);
  });

  it('numbers each hunk line with the new-file line the pre-checks use, CRLF included', () => {
    const diff = [
      'diff --git a/tests/x.spec.ts b/tests/x.spec.ts',
      '--- a/tests/x.spec.ts',
      '+++ b/tests/x.spec.ts',
      '@@ -1,3 +1,3 @@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      ' const c = 4;',
      '@@ -20,2 +20,3 @@',
      ' const t = 20;',
      '+const u = 21;',
      ' const v = 22;',
    ].join('\r\n');
    assert.deepEqual(renderDiff(diff).split('\n').slice(4), [
      '    1 | const a = 1;',
      '-     | const b = 2;',
      '+   2 | const b = 3;',
      '    3 | const c = 4;',
      '@@ -20,2 +20,3 @@',
      '   20 | const t = 20;',
      '+  21 | const u = 21;',
      '   22 | const v = 22;',
    ]);
    assert.deepEqual(
      parseDiff(diff).addedLines.map((added) => added.line),
      [2, 21],
    );
  });

  it('keeps the + marker when redaction rewrites the start of an added line', () => {
    const diff = ['+++ b/src/data/x.ts', '@@ -0,0 +1 @@', '+someone@example.com'].join('\n');
    assert.ok(renderDiff(diff).includes('+   1 | [REDACTED-EMAIL]'));
  });

  it('uses a different fence id per call so content cannot close it', () => {
    assert.notEqual(fenceUntrusted('diff', 'x'), fenceUntrusted('diff', 'x'));
  });

  it('read_file returns numbered lines for allowed files and refuses everything else', async () => {
    const { call, cleanup } = await toolsFor();
    try {
      const ok = await call('read_file', { path: 'tests/ecommerce/home-banner.spec.ts', startLine: 4, endLine: 5 });
      assert.equal(ok.isError, false);
      assert.ok(ok.text.includes('4: test.describe('));
      for (const path of ['.env', 'tests/.env.local', '../.env', '/etc/passwd', 'C:\\x', 'tests\\a.ts', 'README.md', 'tests/missing.ts']) {
        const denied = await call('read_file', { path });
        assert.equal(denied.isError, true, `${path} must be refused`);
      }
    } finally {
      cleanup();
    }
  });

  it('get_precheck_findings returns the deterministic findings as JSON', async () => {
    const { call, cleanup } = await toolsFor();
    try {
      const { text } = await call('get_precheck_findings', {});
      const parsed = JSON.parse(unfence(text, 'precheck-findings')) as ConventionFinding[];
      assert.deepEqual(parsed.map((entry) => entry.rule), ['fixed-sleep']);
    } finally {
      cleanup();
    }
  });

  it('get_precheck_findings truncates by whole findings so the fenced JSON stays parseable', async () => {
    const many = Array.from({ length: 400 }, (_, index) =>
      finding({ line: index + 1, evidence: 'x'.repeat(MAX_EVIDENCE_CHARS - 10), suggestion: 'y'.repeat(MAX_SUGGESTION_CHARS - 10) }),
    );
    assert.ok(JSON.stringify(many).length > MAX_TOOL_TEXT_CHARS);
    const { call, cleanup } = await toolsFor({ prechecks: many });
    try {
      const { text } = await call('get_precheck_findings', {});
      const body = unfence(text, 'precheck-findings');
      assert.ok(body.length <= MAX_TOOL_TEXT_CHARS);
      const parsed = JSON.parse(body) as ConventionFinding[];
      assert.ok(parsed.length > 0 && parsed.length < many.length);
      assert.deepEqual(parsed, many.slice(0, parsed.length));
    } finally {
      cleanup();
    }
  });

  it('get_precheck_findings sanitises evidence taken from added lines', async () => {
    const diff = [
      'diff --git a/tests/a.spec.ts b/tests/a.spec.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/tests/a.spec.ts',
      '@@ -0,0 +1,1 @@',
      "+console.log('mail jane.doe@example.com');",
      '',
    ].join('\n');
    const parsed = parseDiff(diff);
    const { call, cleanup } = await toolsFor({
      diff,
      diffFiles: parsed.files,
      prechecks: runPrechecks(parsed.addedLines).map(toFinding),
    });
    try {
      const { text } = await call('get_precheck_findings', {});
      const findings = JSON.parse(unfence(text, 'precheck-findings')) as ConventionFinding[];
      assert.equal(findings.length, 1);
      assert.ok(findings[0].evidence.includes('console.log'));
      assert.ok(!text.includes('jane.doe@example.com'));
    } finally {
      cleanup();
    }
  });
});

describe('never-send paths and pinned diff options', () => {
  const ENV_MARKER = 'ENV_FILE_CONTENT_MARKER';
  const AUTH_MARKER = 'AUTH_STATE_CONTENT_MARKER';
  const NEVER_SEND_FILES: Record<string, string> = {
    'tests/x/.env.example': `${ENV_MARKER}=1\n`,
    'tests/x/.env.local.ts': `console.log('${ENV_MARKER}');\n`,
    'tests/.auth/state.json': `{"token":"${AUTH_MARKER}"}\n`,
    'tests/.auth/state.ts': `console.log('${AUTH_MARKER}');\n`,
    'tests/ecommerce/ok.spec.ts': "await page.waitForTimeout(5);\nconsole.log('visible');\n",
  };
  const MARKERS = [ENV_MARKER, AUTH_MARKER, '.auth', '.env'];

  it('keeps .env and .auth files out of the diff, the file set and the pre-check findings', async () => {
    const { dir, sha } = await makeRepoWithCommit(NEVER_SEND_FILES);
    const committed = gitIn(dir, ['ls-files']).split('\n');
    assert.ok(committed.includes('tests/x/.env.example') && committed.includes('tests/.auth/state.json'));
    const base = resolveBase(dir, sha, undefined);
    const diff = getScopedDiff(dir, base, sha);
    assert.ok(diff.includes('tests/ecommerce/ok.spec.ts'));
    const parsed = parseDiff(diff);
    assert.deepEqual([...parsed.files], ['tests/ecommerce/ok.spec.ts']);
    const prechecks = runPrechecks(parsed.addedLines).map(toFinding);
    assert.deepEqual(prechecks.map((entry) => entry.file), ['tests/ecommerce/ok.spec.ts', 'tests/ecommerce/ok.spec.ts']);
    for (const marker of MARKERS) {
      assert.ok(!diff.includes(marker), `diff must not mention ${marker}`);
      assert.ok(!JSON.stringify(prechecks).includes(marker), `pre-checks must not mention ${marker}`);
    }

    const result = await runReview(dir, sha, fakeRunner(fakeReport(), []));
    assert.equal(result.kind, 'reviewed');
    if (result.kind !== 'reviewed') return;
    for (const marker of MARKERS) assert.ok(!JSON.stringify(result.findings).includes(marker));

    const tracked = listTrackedFiles(dir, REVIEW_PATH_PREFIXES);
    assert.ok(tracked.has('tests/ecommerce/ok.spec.ts'));
    assert.deepEqual([...tracked].filter((path) => path.includes('.auth') || path.includes('.env')), []);
  });

  it('pins the diff prefixes so a user git config cannot hide every file', async () => {
    const { dir, sha } = await makeRepoWithCommit({ 'tests/ecommerce/ok.spec.ts': 'await page.waitForTimeout(5);\n' });
    const base = resolveBase(dir, sha, undefined);
    const hostileConfig = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'diff.noprefix', GIT_CONFIG_VALUE_0: 'true' };
    const parsed = parseDiff(getScopedDiff(dir, base, sha, hostileConfig));
    assert.deepEqual([...parsed.files], ['tests/ecommerce/ok.spec.ts']);
    assert.equal(runPrechecks(parsed.addedLines).length, 1);
    assert.equal(process.env.GIT_CONFIG_COUNT, undefined);
  });
});

describe('prompt rule extraction', () => {
  const markdown = [
    '## Top',
    '### 2. Alpha',
    'alpha body',
    '```',
    '### 3. fake heading in a fence',
    '```',
    '#### nested',
    'nested body',
    '### 20. Not the same',
    'other body',
    '### 3. Next',
    'next body',
  ].join('\n');

  it('keeps nested headings, skips fenced headings and matches the token with its dot', () => {
    const section = extractSection(markdown, '### 2.');
    assert.ok(section.includes('alpha body'));
    assert.ok(section.includes('### 3. fake heading in a fence'));
    assert.ok(section.includes('nested body'));
    assert.ok(!section.includes('other body'));
  });

  it('handles CRLF input and fails closed on a missing heading', () => {
    assert.ok(extractSection(markdown.replace(/\n/g, '\r\n'), '### 2.').includes('alpha body'));
    assert.throws(() => extractSection(markdown, '### 9.'), /rule heading not found/);
    assert.throws(() => extractSection('## A\n## B\ntext', '## A'), /empty/);
  });

  it('extracts every section from the real rule files', () => {
    const ruleText = loadRuleText(REPO_ROOT);
    for (const heading of ['### 2.', '### 4.', '### 5.', '### 7.', '### 16.', '## Soft Assertions', '## Adding a New Page Object']) {
      assert.ok(ruleText.includes(heading), `${heading} present`);
    }
    assert.ok(ruleText.includes('### When to use soft assertions'));
    assert.ok(!ruleText.includes('### Graph Tools'));
    assert.ok(!ruleText.includes('## Test Structure'));
    assert.ok(buildSystemPrompt(ruleText).includes(ruleText));
  });

  it('throws when a heading is missing from a temp copy of the rule files', async () => {
    for (const source of RULE_SOURCES) {
      const root = await tempDir('cr-rules-');
      for (const copy of RULE_SOURCES) {
        await mkdir(join(root, copy.file, '..'), { recursive: true });
        await cp(join(REPO_ROOT, copy.file), join(root, copy.file));
      }
      const path = join(root, source.file);
      const heading = source.headings[source.headings.length - 1];
      const original = readFileSync(path, 'utf8');
      const broken = original.split('\n').filter((line) => !line.startsWith(heading)).join('\n');
      assert.notEqual(broken, original);
      await writeFile(path, broken);
      assert.throws(() => loadRuleText(root), /rule heading not found/);
    }
  });
});

describe('schema', () => {
  const valid = { summary: 'ok', findings: [finding()] };

  it('accepts a valid output and rejects over-cap or malformed ones', () => {
    assert.equal(ConventionReviewOutputSchema.safeParse(valid).success, true);
    const bad: Record<string, unknown>[] = [
      { ...valid, summary: 'x'.repeat(MAX_SUMMARY_CHARS + 1) },
      { ...valid, findings: Array.from({ length: MAX_FINDINGS + 1 }, () => finding()) },
      { ...valid, findings: [finding({ evidence: 'x'.repeat(MAX_EVIDENCE_CHARS + 1) })] },
      { ...valid, findings: [finding({ suggestion: 'x'.repeat(MAX_SUGGESTION_CHARS + 1) })] },
      { ...valid, findings: [{ ...finding(), rule: 'made-up-rule' }] },
      { ...valid, findings: [finding({ line: 0 })] },
      { ...valid, findings: [finding({ line: 1.5 })] },
    ];
    for (const candidate of bad) assert.equal(ConventionReviewOutputSchema.safeParse(candidate).success, false);
  });

  it('lists every rule from the research report', () => {
    assert.equal(CONVENTION_RULES.length, 10);
  });
});

describe('eval scoring', () => {
  it('flags every tool call outside the review server and StructuredOutput (V1.3)', () => {
    assert.deepEqual(
      offAllowlistTools(['mcp__review__read_file', 'StructuredOutput', 'Bash', 'mcp__other__x', 'mcp__reviewer__x']),
      ['Bash', 'mcp__other__x', 'mcp__reviewer__x'],
    );
  });

  const expected: ExpectedFinding[] = [
    { rule: 'fixed-sleep', file: 'a.ts', line: 3 },
    { rule: 'inline-locator', file: 'b.ts' },
  ];

  it('computes true positives, false positives and false negatives per rule', () => {
    const score = scoreCase(expected, [
      finding({ rule: 'fixed-sleep', file: 'a.ts', line: 3 }),
      finding({ rule: 'fixed-sleep', file: 'a.ts', line: 9 }),
      finding({ rule: 'comment-smell', file: 'c.ts', line: 1 }),
    ]);
    assert.deepEqual(score, {
      'fixed-sleep': { tp: 1, fp: 1, fn: 0 },
      'inline-locator': { tp: 0, fp: 0, fn: 1 },
      'comment-smell': { tp: 0, fp: 1, fn: 0 },
    });
    assert.equal(isCaseCorrect(score), false);
    assert.equal(isCaseCorrect(scoreCase([], [])), true);
    const allMatched = scoreCase(expected, [
      finding({ rule: 'fixed-sleep', file: 'a.ts', line: 3 }),
      finding({ rule: 'inline-locator', file: 'b.ts', line: 77 }),
    ]);
    assert.equal(isCaseCorrect(allMatched), true);
  });

  it('aggregates precision and recall with Wilson intervals sized by distinct cases', () => {
    const scores = [
      { 'fixed-sleep': { tp: 8, fp: 2, fn: 0 } },
      { 'fixed-sleep': { tp: 8, fp: 2, fn: 4 } },
    ];
    const metrics = computeMetrics(scores, 2);
    const row = metrics.find((entry) => entry.rule === 'fixed-sleep');
    assert.ok(row);
    assert.equal(row.precision, 0.8);
    assert.equal(row.recall, 16 / 20);
    const [low, high] = wilson(0.8, 10);
    assert.deepEqual(row.precisionCi, [low, high]);
    assert.equal(metrics[metrics.length - 1].rule, ALL_RULES_KEY);
    assert.equal(computeMetrics([{}], 2)[0].precision, undefined);
  });

  it('matches known Wilson and McNemar values', () => {
    const [low, high] = wilson(0.5, 10);
    assert.ok(Math.abs(low - 0.2366) < 0.001, `low ${low}`);
    assert.ok(Math.abs(high - 0.7634) < 0.001, `high ${high}`);
    assert.deepEqual(wilson(0.5, 0), [0, 0]);
    assert.equal(mcnemar(0, 5), 0.0625);
    assert.equal(mcnemar(3, 3), 1);
    assert.equal(mcnemar(0, 0), 1);
  });

  it('compares two saved runs on the cases that flipped', () => {
    const scoreFor = (passed: boolean): CaseScore => (passed ? {} : { 'fixed-sleep': { tp: 0, fp: 1, fn: 0 } });
    const run = (id: string, passes: Record<string, boolean>): EvalRun => ({
      id,
      createdAt: '',
      repeats: 1,
      metrics: [],
      modelMetrics: [],
      critical: summarizeCritical([], 1),
      totalCostUsd: 0,
      harnessFailures: 0,
      leakHits: 0,
      permissionDenials: 0,
      offAllowlistRuns: 0,
      cases: Object.entries(passes).map(([caseId, passed]) => ({
        caseId,
        kind: 'defect',
        repeat: 1,
        outcome: 'success',
        findings: [],
        modelFindings: [],
        modelScore: {},
        critical: { tp: 0, fp: 0, fn: 0 },
        modelCritical: { tp: 0, fp: 0, fn: 0 },
        score: scoreFor(passed),
        costUsd: 0,
        modelUsage: {},
        permissionDenials: 0,
        toolUseNames: [],
        errors: [],
        leak: false,
      })),
    });
    const result = compareRuns(run('a', { c1: true, c2: true, c3: false }), run('b', { c1: false, c2: true, c3: true, c4: true }));
    assert.deepEqual(result, { comparedCases: 3, onlyAPasses: 1, onlyBPasses: 1, pValue: 1 });
  });
});

describe('eval source separation', () => {
  const expected: ExpectedFinding[] = [
    { rule: 'fixed-sleep', file: 'a.ts', line: 3, check: 'fixed-sleep' },
    { rule: 'magic-timeout', file: 'e.ts', line: 1, check: 'numeric-timeout' },
    { rule: 'inline-locator', file: 'b.ts' },
    { rule: 'comment-smell', file: 'c.ts' },
  ];
  const merged = [
    finding({ rule: 'fixed-sleep', severity: 'warning', file: 'a.ts', line: 3 }),
    finding({ rule: 'magic-timeout', severity: 'critical', file: 'e.ts', line: 1 }),
    finding({ rule: 'inline-locator', severity: 'critical', file: 'b.ts', line: 7 }),
    finding({ rule: 'wrong-test-import', severity: 'critical', file: 'd.ts', line: 2 }),
  ];
  const modelOnly = [
    finding({ rule: 'fixed-sleep', severity: 'warning', file: 'a.ts', line: 3 }),
    finding({ rule: 'inline-locator', severity: 'critical', file: 'b.ts', line: 7 }),
    finding({ rule: 'wrong-test-import', severity: 'critical', file: 'd.ts', line: 2 }),
  ];

  it('scores model-only findings against judgement rules and ignores pre-check duplicates', () => {
    assert.deepEqual(scoreModelOnly(expected, modelOnly), {
      'inline-locator': { tp: 1, fp: 0, fn: 0 },
      'comment-smell': { tp: 0, fp: 0, fn: 1 },
      'wrong-test-import': { tp: 0, fp: 1, fn: 0 },
    });
    assert.deepEqual(scoreCase(expected, merged)['fixed-sleep'], { tp: 1, fp: 0, fn: 0 });
  });

  it('scores critical rules from the golden answers, ignoring the severity the model emits', () => {
    // magic-timeout is marked critical by the model but is not a critical rule, so it is excluded.
    assert.deepEqual(scoreCritical(scoreCase(expected, merged)), { tp: 1, fp: 1, fn: 0 });
    const downgraded = [finding({ rule: 'inline-locator', severity: 'suggestion', file: 'b.ts', line: 7 })];
    assert.deepEqual(scoreCritical(scoreCase(expected, downgraded)), { tp: 1, fp: 0, fn: 0 });
    assert.deepEqual(scoreCritical(scoreCase(expected, [])), { tp: 0, fp: 0, fn: 1 });

    const sources = scoreSources(expected, merged, modelOnly);
    assert.deepEqual(sources.critical, { tp: 1, fp: 1, fn: 0 });
    assert.deepEqual(sources.modelCritical, { tp: 1, fp: 1, fn: 0 });
    const summary = summarizeCritical([{ ...sources, kind: 'defect' }], 1);
    assert.equal(summary.merged.precision, 1 / 2);
    assert.equal(summary.merged.recall, 1);
    assert.ok(summary.merged.precisionCi);
    assert.equal(summary.model.precision, 1 / 2);
    assert.equal(summarizeCritical([], 1).model.precision, undefined);
  });

  it('counts critical findings on clean diffs separately from defect-case false positives', () => {
    const fp = (n: number) => ({ score: {}, modelScore: {}, critical: { tp: 0, fp: n, fn: 0 }, modelCritical: { tp: 0, fp: 0, fn: 0 } });
    const summary = summarizeCritical([{ ...fp(2), kind: 'clean' }, { ...fp(3), kind: 'defect' }, { ...fp(1), kind: 'clean' }], 1);
    assert.equal(summary.cleanFalsePositives, 3);
    assert.equal(summary.merged.fp, 6);
  });

  it('prints merged, model-only and critical sections separately', () => {
    const sources = scoreSources(expected, merged, modelOnly);
    const report = formatEvalReport({
      metrics: computeMetrics([sources.score], 1),
      modelMetrics: computeMetrics([sources.modelScore], 1),
      critical: summarizeCritical([{ ...sources, kind: 'defect' }], 1),
    });
    assert.match(report, /merged findings/);
    assert.match(report, /model-only findings/);
    assert.match(report, /critical rules \(wrong-test-import, inline-locator, hierarchical-selector\)/);
    assert.match(report, /critical \(model-only\)\s+tp=1 fp=1 fn=0/);
    assert.match(report, /critical \(merged\)\s+tp=1 fp=1 fn=0/);
    assert.match(report, /clean-diff critical\s+0 finding\(s\)/);
  });
});

describe('P1 to P2 gate', () => {
  const critical = (counts: { tp: number; fp: number; fn: number }, cleanFalsePositives = 0): CriticalSummary => {
    const sources = { score: {}, modelScore: {}, critical: counts, modelCritical: counts, kind: 'defect' as const };
    return { ...summarizeCritical([sources], 2), cleanFalsePositives };
  };
  const run = (summary: CriticalSummary, harnessFailures = 0, leakHits = 0, repeats = 2) => ({
    critical: summary,
    harnessFailures,
    leakHits,
    repeats,
  });

  it('uses the thresholds decided for Q9', () => {
    assert.deepEqual(P1_GATE, { minPrecision: 0.8, minRecall: 0.7, maxCleanFalsePositives: 1, minRepeats: 2 });
  });

  it('fails when merged recall passes only because of guaranteed pre-check hits', () => {
    const merged = critical({ tp: 7, fp: 0, fn: 3 });
    const modelOnly = critical({ tp: 3, fp: 0, fn: 3 });
    const result = evaluateGate(run({ ...merged, model: modelOnly.model }));
    assert.deepEqual(result.reasons, ['model-only critical recall 50% is below 70%']);
  });

  it('never passes a run with fewer repeats than the gate needs', () => {
    const result = evaluateGate(run(critical({ tp: 10, fp: 0, fn: 0 }), 0, 0, 1));
    assert.deepEqual(result, { pass: false, reasons: ['1 repeat(s); a gate run needs 2'] });
  });

  it('passes at the thresholds and allows one clean-diff false positive', () => {
    const result = evaluateGate(run(critical({ tp: 8, fp: 2, fn: 3 }, 1)));
    assert.deepEqual(result, { pass: true, reasons: [] });
    assert.equal(formatGate(result), 'P1 to P2 gate: PASS');
  });

  it('fails with one reason per unmet condition', () => {
    const result = evaluateGate(run(critical({ tp: 7, fp: 3, fn: 4 }, 2), 1, 1, 1));
    assert.equal(result.pass, false);
    assert.deepEqual(result.reasons, [
      'critical precision 70% is below 80%',
      'critical recall 64% is below 70%',
      'model-only critical recall 64% is below 70%',
      '2 critical finding(s) on clean diffs, max 1',
      '1 run(s) did not succeed',
      '1 leak hit(s)',
      '1 repeat(s); a gate run needs 2',
    ]);
    assert.match(formatGate(result), /^P1 to P2 gate: FAIL \(critical precision 70%/);
  });

  it('fails when there are no critical findings to measure', () => {
    const result = evaluateGate(run(critical({ tp: 0, fp: 0, fn: 0 })));
    assert.deepEqual(result.reasons, [
      'critical precision n/a is below 80%',
      'critical recall n/a is below 70%',
      'model-only critical recall n/a is below 70%',
    ]);
  });
});

describe('eval CLI', () => {
  it('fails fast without a credential and makes no model call', async () => {
    const errors = mock.method(console, 'error', () => undefined);
    const code = await runEvalCli([], await tempDir('cr-eval-'), {});
    assert.equal(code, 1);
    assert.match(String(errors.mock.calls[0].arguments[0]), /CLAUDE_CODE_OAUTH_TOKEN is required/);
  });

  it('rejects bad arguments', async () => {
    mock.method(console, 'error', () => undefined);
    const root = await tempDir('cr-eval-');
    assert.equal(await runEvalCli(['--repeats', '0'], root, {}), 1);
    assert.equal(await runEvalCli(['--compare', 'only-one'], root, {}), 1);
    assert.equal(await runEvalCli(['--compare', '../a', 'b'], root, {}), 1);
  });

  it('compares saved runs offline without a credential', async () => {
    const root = await tempDir('cr-eval-');
    const dir = join(root, EVAL_RUNS_DIR);
    await mkdir(dir, { recursive: true });
    const run = { id: 'x', createdAt: '', repeats: 1, cases: [], metrics: [], totalCostUsd: 0, harnessFailures: 0, leakHits: 0 };
    await writeFile(join(dir, 'a.json'), JSON.stringify(run));
    await writeFile(join(dir, 'b.json'), JSON.stringify(run));
    const log = mock.method(console, 'log', () => undefined);
    assert.equal(await runEvalCli(['--compare', 'a', 'b'], root, {}), 0);
    assert.match(String(log.mock.calls[0].arguments[0]), /McNemar over 0 case/);
  });
});

describe('main CLI', () => {
  function runMain(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, [...NODE_FLAGS, MAIN_PATH, ...args], {
      cwd,
      env: cleanEnv(),
      encoding: 'utf8',
      timeout: 60_000,
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it('prints "nothing to review" and exits 0 with no credential when no in-scope path changed', async () => {
    const { dir, sha } = await makeRepoWithCommit({ 'docs/notes.md': 'docs only\n' });
    const out = join(await tempDir('cr-out-'), 'reports');
    const result = runMain(['--sha', sha, '--out', out], dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /nothing to review/);
    assert.equal(existsSync(out), false);
  });

  it('fails closed with a credential error and writes a non-success report when there is work to do', async () => {
    const { dir, sha } = await makeRepoWithCommit({
      'tests/ecommerce/sleepy.spec.ts': "import { test } from '@config/base-test';\nawait page.waitForTimeout(500);\n",
    });
    const out = join(await tempDir('cr-out-'), 'reports');
    const result = runMain(['--sha', sha, '--out', out], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CLAUDE_CODE_OAUTH_TOKEN is required/);
    const report = JSON.parse(readFileSync(join(out, 'convention-review.json'), 'utf8')) as { outcome: string };
    assert.equal(report.outcome, 'agent-error');
    assert.ok(readFileSync(join(out, 'convention-review.md'), 'utf8').includes('fixed-sleep'));
  });

  it('rejects a malformed --sha before any git or model work', async () => {
    const { dir } = await makeRepoWithCommit({ 'docs/notes.md': 'x\n' });
    const out = join(await tempDir('cr-out-'), 'reports');
    for (const args of [['--sha=-abc'], ['--sha', 'HEAD'], ['--sha=../x'], ['--sha', '-abc'], []]) {
      const result = runMain([...args, '--out', out], dir);
      assert.equal(result.status, 1, `${args.join(' ')} must fail`);
      assert.equal(result.stdout.includes('nothing to review'), false);
    }
    const hex = runMain(['--sha=-abc', '--out', out], dir);
    assert.match(hex.stderr, /hex commit id/);
    assert.equal(existsSync(out), false);
  });

  it('rejects a malformed --base', async () => {
    const { dir, sha } = await makeRepoWithCommit({ 'docs/notes.md': 'x\n' });
    const result = runMain(['--sha', sha, '--base=--upload-pack=x', '--out', join(dir, 'o')], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--base must be a hex commit id/);
  });

  it('rejects a symbolic --base that git would otherwise resolve', async () => {
    const { dir, sha } = await makeRepoWithCommit({ 'docs/notes.md': 'x\n' });
    const result = runMain(['--sha', sha, '--base', 'HEAD', '--out', join(dir, 'o')], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--base must be a hex commit id/);
    assert.equal(result.stdout.includes('nothing to review'), false);
    assert.throws(() => resolveBase(dir, sha, 'HEAD'), /--base must be a hex commit id/);
  });

  it('treats an empty or all-zero --base as the parent commit', async () => {
    const { dir, sha } = await makeRepoWithCommit({ 'docs/notes.md': 'x\n' });
    const parent = gitIn(dir, ['rev-parse', `${sha}^`]).trim();
    assert.equal(resolveBase(dir, sha, ''), parent);
    assert.equal(resolveBase(dir, sha, '0'.repeat(40)), parent);
    assert.equal(resolveBase(dir, sha, undefined), parent);
    assert.equal(resolveBase(dir, parent, undefined), '4b825dc642cb6eb9a060e54bf8d69288fbee4904');
  });

  it('reports usage errors in-process', async () => {
    mock.method(console, 'error', () => undefined);
    assert.equal(await runCli([], process.cwd(), {}), 1);
  });

  it('accepts cap overrides only at or below the defaults (V1.7)', async () => {
    assert.equal(parseCapOverride(undefined, '--max-turns', CONVENTION_REVIEWER_MAX_TURNS, true), undefined);
    assert.equal(parseCapOverride('1', '--max-turns', CONVENTION_REVIEWER_MAX_TURNS, true), 1);
    assert.equal(parseCapOverride('0.01', '--max-budget-usd', CONVENTION_REVIEWER_MAX_BUDGET_USD, false), 0.01);

    const errors = mock.method(console, 'error', () => undefined);
    const rejected = [
      ['--max-turns', String(CONVENTION_REVIEWER_MAX_TURNS + 1)],
      ['--max-turns', '0'],
      ['--max-turns', '1.5'],
      ['--max-budget-usd', String(CONVENTION_REVIEWER_MAX_BUDGET_USD + 0.01)],
      ['--max-budget-usd', '0'],
      ['--max-budget-usd=-1'],
      ['--max-budget-usd', 'Infinity'],
      ['--max-budget-usd', 'abc'],
    ];
    for (const args of rejected) {
      assert.equal(await runCli(['--sha', 'abc1234', ...args], process.cwd(), {}), 1, `${args.join(' ')} must fail`);
    }
    assert.equal(errors.mock.calls.length, rejected.length);
    for (const call of errors.mock.calls) {
      assert.match(String(call.arguments[0]), /must be (an integer|a number) above 0 and at most/);
    }
  });
});

describe('review report delivery to Slack', () => {
  const slackEnv = { SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/x' };

  async function reportFile(report: AgentRunReport<unknown>): Promise<string> {
    const path = join(await tempDir('review-deliver-'), 'report.json');
    await writeFile(path, JSON.stringify(report));
    return path;
  }

  function args(path: string, agent = 'review'): string[] {
    return ['--report', path, '--agent', agent, '--target', 'slack'];
  }

  function makeFetch(): { fetchImpl: FetchLike; calls: () => number; request: () => { url: string; body: string } } {
    let last = { url: '', body: '' };
    const spy = mock.fn<FetchLike>(async (url, init) => {
      last = { url, body: String(init.body) };
      return { ok: true, status: 200 };
    });
    return { fetchImpl: spy, calls: () => spy.mock.callCount(), request: () => last };
  }

  const withFinding = (): AgentRunReport<ConventionReviewOutput> =>
    fakeReport({ output: { summary: 'One issue.', findings: [finding()] } });

  const runEnv = {
    ...slackEnv,
    SHA: 'abcdef1234567890abcdef1234567890abcdef12',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_RUN_ID: '12345',
    GITHUB_REF_NAME: 'main',
    COMMIT_SUBJECT: '`feat: add E2E-CART-010 promo code field test and hasPromoCodeField method`',
  };
  const repoUrl = 'https://github.com/owner/repo';
  const blobUrl = `${repoUrl}/blob/${runEnv.SHA}`;

  function allBlocks(message: SlackMessage): SlackBlock[] {
    return [...message.blocks, ...message.attachments.flatMap((attachment) => attachment.blocks)];
  }

  function mrkdwnTexts(message: SlackMessage): string[] {
    return [
      message.text,
      ...allBlocks(message).flatMap((block) => {
        if (block.type === 'section') return 'fields' in block ? block.fields.map((field) => field.text) : [block.text.text];
        return block.type === 'context' ? block.elements.map((element) => element.text) : [];
      }),
    ];
  }

  function sectionTexts(blocks: readonly SlackBlock[]): string[] {
    return blocks.flatMap((block) => (block.type === 'section' && 'text' in block ? [block.text.text] : []));
  }

  async function post(output: ConventionReviewOutput, env: Record<string, string> = runEnv): Promise<SlackMessage> {
    const http = makeFetch();
    assert.equal(await runDelivery(args(await reportFile(fakeReport({ output }))), env, AGENT_DELIVERY_REGISTRY, http.fetchImpl), 0);
    assert.equal(http.calls(), 1);
    assert.equal(http.request().url, slackEnv.SLACK_WEBHOOK_URL);
    return JSON.parse(http.request().body) as SlackMessage;
  }

  it('registers the reviewer under the agent name its report carries', () => {
    const prepared = prepareDelivery(AGENT_DELIVERY_REGISTRY, 'review', 'slack', withFinding());
    assert.ok(prepared.ok);
    assert.equal(prepared.skipReason, undefined);
    assert.ok(prepared.message.target === 'slack');
    assert.equal(prepared.message.slack.text, 'Convention review: 1 finding');
  });

  it('posts Block Kit with commit fields, buttons and a coloured attachment per severity', async () => {
    const file = finding().file;
    const commitUrl = `${repoUrl}/commit/${runEnv.SHA}`;
    assert.deepEqual(await post(withFinding().output as ConventionReviewOutput), {
      text: 'Convention review: 1 finding',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Convention review: 1 finding' } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Commit*\n<${commitUrl}|abcdef1> 'feat: add E2E-CART-010 promo code field test and hasPromoCodeField method'` },
            { type: 'mrkdwn', text: '*Branch*\nmain' },
            { type: 'mrkdwn', text: '*Findings*\n1 warning' },
            { type: 'mrkdwn', text: '*Files*\n1' },
          ],
        },
        { type: 'section', text: { type: 'mrkdwn', text: 'One issue.' } },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'View workflow run' }, url: `${repoUrl}/actions/runs/12345` },
            { type: 'button', text: { type: 'plain_text', text: 'View commit' }, url: commitUrl },
          ],
        },
      ],
      attachments: [
        {
          color: '#ECB22E',
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: '*Warning · 1 finding in 1 file*' } },
            { type: 'section', text: { type: 'mrkdwn', text: `*<${blobUrl}/${file}|${file}>*` } },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `<${blobUrl}/${file}#L5|line 5>  \`inline-locator\`\nHoist the locator to a private readonly field.\n\`\`\`await page.locator('.x').click();\`\`\``,
              },
            },
            { type: 'context', elements: [{ type: 'mrkdwn', text: 'Line links open the file at the reviewed commit.' }] },
          ],
        },
      ],
      unfurl_links: false,
      unfurl_media: false,
    });
  });

  it('groups by severity then file, sorts lines, and hides the uninformative "other" rule', async () => {
    const page = 'src/pages/ecommerce/checkout-page.ts';
    const spec = 'tests/ecommerce/cart.spec.ts';
    const message = await post({
      summary: 'Several issues.',
      findings: [
        finding({ severity: 'suggestion', file: spec, line: 3, rule: 'comment-smell' }),
        finding({ severity: 'critical', file: page, line: 30 }),
        finding({ severity: 'warning', file: spec, line: 9, rule: 'other' }),
        finding({ severity: 'critical', file: spec, line: 1, rule: 'wrong-test-import' }),
        finding({ severity: 'critical', file: page, line: 12 }),
      ],
    });
    assert.deepEqual(message.attachments.map((attachment) => attachment.color), ['#E01E5A', '#ECB22E', '#1D9BD1']);
    const critical = sectionTexts(message.attachments[0].blocks);
    assert.equal(critical[0], '*Critical · 3 findings in 2 files*');
    assert.deepEqual(
      critical.slice(1).map((text) => text.split('\n')[0]),
      [
        `*<${blobUrl}/${page}|${page}>*`,
        `<${blobUrl}/${page}#L12|line 12>  \`inline-locator\``,
        `<${blobUrl}/${page}#L30|line 30>  \`inline-locator\``,
        `*<${blobUrl}/${spec}|${spec}>*`,
        `<${blobUrl}/${spec}#L1|line 1>  \`wrong-test-import\``,
      ],
    );
    assert.equal(sectionTexts(message.attachments[1].blocks)[2].split('\n')[0], `<${blobUrl}/${spec}#L9|line 9>`);
    assert.ok(mrkdwnTexts(message).includes('*Findings*\n3 critical, 1 warning, 1 suggestion'));
    assert.ok(mrkdwnTexts(message).includes('*Files*\n2'));
  });

  it('escapes mention and link syntax in every model- and commit-written field', async () => {
    const hostile = '<!channel> <@U123> <!here> <!subteam^S1> <https://evil.example|click> `tick`';
    const message = await post(
      { summary: hostile, findings: [finding({ suggestion: hostile, evidence: hostile, file: 'tests/<!subteam^S1>.ts' })] },
      { ...runEnv, COMMIT_SUBJECT: `${hostile} @here` },
    );
    const repoLink = /<https:\/\/github\.com\/owner\/repo\/[^<>|\s]+\|[^<>]*>/g;
    for (const text of mrkdwnTexts(message)) {
      assert.ok(!/[<>]/.test(text.replace(repoLink, '')), `live markup left in: ${text}`);
      assert.ok(!text.includes('`tick`'), 'model backticks cannot open code spans');
    }
    assert.ok(mrkdwnTexts(message).some((text) => text.includes(`&lt;!channel&gt; &lt;@${ZERO_WIDTH_SPACE}U123&gt;`)));
    assert.ok(mrkdwnTexts(message)[0] === 'Convention review: 1 finding');
    assert.ok(!JSON.stringify(message).includes('@here'), 'plain mentions are neutralised too');
  });

  it('builds links only from valid env values, drops just the part that needs a bad one, and never echoes it', async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ SHA: 'zz--x' }, '/commit/'],
      [{ SHA: `${runEnv.SHA}\n` }, '/blob/'],
      [{ GITHUB_RUN_ID: '12a' }, '/actions/runs/'],
      [{ GITHUB_RUN_ID: '12345\n' }, '/actions/runs/'],
      [{ GITHUB_RUN_ID: '12345|x' }, '/actions/runs/'],
      [{ GITHUB_SERVER_URL: 'http://github.com' }, 'https://'],
      [{ GITHUB_SERVER_URL: 'https://github.com|x' }, 'https://'],
      [{ GITHUB_SERVER_URL: 'https://github.com>' }, 'https://'],
      [{ GITHUB_SERVER_URL: 'https://github.com\n' }, 'https://'],
      [{ GITHUB_REPOSITORY: 'a b' }, 'https://'],
      [{ GITHUB_REPOSITORY: 'owner/repo|<!channel>' }, 'https://'],
      [{ GITHUB_REPOSITORY: 'owner/repo\n' }, 'https://'],
      [{ GITHUB_REF_NAME: 'main\n' }, '*Branch*'],
      [{ GITHUB_REF_NAME: 'a|b' }, '*Branch*'],
    ];
    for (const [bad, gone] of cases) {
      const message = await post(withFinding().output as ConventionReviewOutput, { ...runEnv, ...bad });
      const posted = JSON.stringify(message);
      assert.ok(!posted.includes(gone), `${JSON.stringify(bad)} should drop ${gone}`);
      assert.ok(!posted.includes(JSON.stringify(Object.values(bad)[0]).slice(1, -1)), `${JSON.stringify(bad)} echoed`);
      assert.ok(posted.includes('Convention review: 1 finding'));
    }
    const noRepo = await post(withFinding().output as ConventionReviewOutput, { ...runEnv, GITHUB_REPOSITORY: 'a b' });
    assert.ok(mrkdwnTexts(noRepo).some((text) => text.startsWith("*Commit*\n`abcdef1` 'feat")));
    assert.ok(!allBlocks(noRepo).some((block) => block.type === 'actions' || block.type === 'context'));
  });

  it('refuses a file path that would resolve outside the commit, by leaving it unlinked', async () => {
    const message = await post({ summary: 'x', findings: [finding({ file: 'tests/../../other/repo.ts' })] });
    assert.ok(!JSON.stringify(message).includes('/blob/'));
    assert.ok(mrkdwnTexts(message).includes('*tests/../../other/repo.ts*'));
  });

  it('keeps every block inside Slack limits at the findings cap, even when every character needs an entity', async () => {
    const severities: readonly ConventionSeverity[] = ['critical', 'warning', 'suggestion'];
    const dense = '&<>'.repeat(400);
    const findings = Array.from({ length: MAX_FINDINGS }, (_, index) =>
      finding({
        severity: severities[index % severities.length],
        file: `tests/${'&'.repeat(MAX_PATH_CHARS - 20)}${index}.ts`,
        line: 100_000 + index,
        suggestion: dense.slice(0, MAX_SUGGESTION_CHARS),
        evidence: dense.slice(0, MAX_EVIDENCE_CHARS),
      }),
    );
    const message = await post({ summary: dense.slice(0, MAX_SUMMARY_CHARS), findings });
    assert.ok(allBlocks(message).length <= 50, `${allBlocks(message).length} blocks`);
    for (const text of mrkdwnTexts(message)) {
      assert.ok(text.length <= 3000, `${text.length} characters`);
      assert.ok(text.trim() !== '');
    }
  });

  it('leaves out blocks that would be empty', async () => {
    const message = await post({ summary: '   ', findings: [finding({ evidence: '', suggestion: '' })] });
    for (const text of mrkdwnTexts(message)) assert.ok(text.trim() !== '');
    assert.ok(!JSON.stringify(message).includes('```'));
  });

  it('skips a review with zero findings: exit 0, nothing posted, credentials not read', async () => {
    const http = makeFetch();
    const log = mock.method(console, 'log', () => undefined);
    const path = await reportFile(fakeReport());
    const prepared = prepareDelivery(AGENT_DELIVERY_REGISTRY, 'review', 'slack', fakeReport());
    assert.ok(prepared.ok);
    assert.equal(prepared.skipReason, 'nothing to report');
    const noCredentialReads = new Proxy<Record<string, string | undefined>>({}, {
      get: (_target, key) => {
        if (key === 'SLACK_WEBHOOK_URL') throw new Error('credential read on the skip path');
        return undefined;
      },
    });
    assert.equal(await runDelivery(args(path), noCredentialReads, AGENT_DELIVERY_REGISTRY, http.fetchImpl), 0);
    assert.equal(http.calls(), 0);
    assert.deepEqual(log.mock.calls.map((call) => call.arguments[0]), ['not delivered: nothing to report']);
  });

  it('refuses a run that did not succeed even when findings are present', async () => {
    mock.method(console, 'error', () => undefined);
    const http = makeFetch();
    const path = await reportFile({ ...withFinding(), outcome: 'usage-exhausted' });
    assert.equal(await runDelivery(args(path), slackEnv, AGENT_DELIVERY_REGISTRY, http.fetchImpl), 1);
    assert.equal(http.calls(), 0);
  });

  it('sanitises a secret out of the posted text and refuses a mismatched agent', async () => {
    mock.method(console, 'error', () => undefined);
    const http = makeFetch();
    const leaky = fakeReport({
      output: { summary: 'One issue.', findings: [finding({ evidence: `token ${PLANTED_JWT}` })] },
    });
    assert.equal(await runDelivery(args(await reportFile(leaky)), slackEnv, AGENT_DELIVERY_REGISTRY, http.fetchImpl), 0);
    assert.equal(http.calls(), 1);
    assert.ok(!http.request().body.includes(PLANTED_JWT));

    const mismatch = fakeReport({ agent: 'other', output: withFinding().output });
    assert.equal(await runDelivery(args(await reportFile(mismatch)), slackEnv, AGENT_DELIVERY_REGISTRY, http.fetchImpl), 1);
    assert.equal(http.calls(), 1);
  });
});
