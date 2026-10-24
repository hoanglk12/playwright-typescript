import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, afterEach, describe, it, mock } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AGENT_DELIVERY_REGISTRY, prepareDelivery, runDelivery } from '../harness/deliver.ts';
import type { FetchLike } from '../harness/deliver.ts';
import {
  MAX_DIFF_CHARS,
  MAX_FILE_CHARS,
  MAX_PARITY_EXPLANATION_CHARS,
  MAX_PARITY_MISSING_CHANGE_CHARS,
  MIRROR_PARITY_MAX_BUDGET_USD,
  MIRROR_PARITY_MAX_TURNS,
} from '../harness/limits.ts';
import { findSlackProblem } from '../harness/slack.ts';
import type { SlackBlock, SlackMessage } from '../harness/slack.ts';
import type { AgentRunReport, AgentSpec } from '../harness/types.ts';
import { MIRROR_PARITY_AGENT_NAME, MIRROR_PARITY_MODEL, checkMirrorParity, mergeReports, runCli, settleVerdict } from './main.ts';
import type { ParityRunner } from './main.ts';
import {
  MIRROR_PAIRS,
  MIRROR_PAIR_IDS,
  MIRROR_PARITY_WORKFLOW,
  assertWorkflowPathsMatch,
  pairFiles,
  parseWorkflowPushPaths,
} from './pairs.ts';
import type { MirrorPairId } from './pairs.ts';
import { RULE_SOURCES, buildSystemPrompt, buildUserPrompt, loadPairRuleText } from './prompt.ts';
import { renderParityMarkdown, renderParitySlack } from './render.ts';
import { MirrorParityOutputSchema, ModelParityOutputSchema, PARITY_STATUSES, needsAction } from './schema.ts';
import type { MirrorParityOutput, ModelParityOutput, ModelPairVerdict, PairVerdict, ParityStatus } from './schema.ts';
import { HUNK_TRUNCATION_NOTICE, assertPairFilesTracked, createPairTools, getPairChange, scanPairs } from './tools.ts';
import type { CandidatePair, PairToolContext } from './tools.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAIN_PATH = fileURLToPath(new URL('./main.ts', import.meta.url));
const NODE_FLAGS = ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];
const PLANTED_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlLXZhbHVl';
const CREDENTIAL_VARS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'AGENT_AUTH_MODE'];
const HISTORY = {
  bothLighthouse: 'd20638c',
  bothIndex: '93c84ba',
  threePairs: '6567436',
  devopsOnly: '869d78c',
};

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

function hasCommit(sha: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: REPO_ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of CREDENTIAL_VARS) delete env[name];
  return env;
}

interface PairRepo {
  dir: string;
  commit: (changes: Record<string, string>, message?: string) => Promise<string>;
}

async function makePairRepo(skip: readonly string[] = []): Promise<PairRepo> {
  const dir = await tempDir('mp-repo-');
  gitIn(dir, ['init', '--quiet']);
  const write = async (changes: Record<string, string>): Promise<void> => {
    for (const [path, content] of Object.entries(changes)) {
      await mkdir(join(dir, dirname(path)), { recursive: true });
      await writeFile(join(dir, path), content);
    }
  };
  await write(Object.fromEntries(pairFiles().filter((file) => !skip.includes(file)).map((file) => [file, `base ${file}\n`])));
  await write({ 'README.md': 'fixture\n' });
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '--quiet', '--no-verify', '-m', 'initial']);
  return {
    dir,
    commit: async (changes, message = 'change') => {
      await write(changes);
      gitIn(dir, ['add', '-A']);
      gitIn(dir, ['commit', '--quiet', '--no-verify', '-m', message]);
      return gitIn(dir, ['rev-parse', 'HEAD']).trim();
    },
  };
}

function modelReport(
  overrides: Partial<AgentRunReport<ModelParityOutput>> = {},
): AgentRunReport<ModelParityOutput> {
  return {
    agent: MIRROR_PARITY_AGENT_NAME,
    outcome: 'success',
    resultSubtype: 'success',
    output: { pairs: [] },
    costUsdEstimate: 0.01,
    numTurns: 2,
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

function verdict(pair: MirrorPairId, overrides: Partial<ModelPairVerdict> = {}): ModelPairVerdict {
  return { pair, status: 'in-sync', explanation: 'Both sides match.', missingChange: '', ...overrides };
}

interface RunnerCall {
  specName: string;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  toolNames: string[];
  systemPrompt: string;
  prompt: string;
  pair: MirrorPairId;
}

type ToolHandler = (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function pairIn(prompt: string): MirrorPairId {
  const found = MIRROR_PAIR_IDS.find((id) => prompt.includes(`pair "${id}"`));
  assert.ok(found, 'prompt names its pair');
  return found;
}

// By default the fake model reads the change first, as the prompt tells it to; readsChange=false skips the tool.
function fakeRunner(
  respond: (call: RunnerCall, index: number) => AgentRunReport<ModelParityOutput>,
  calls: RunnerCall[] = [],
  readsChange = true,
): ParityRunner {
  const runner = async (spec: AgentSpec<ModelParityOutput>, prompt: string): Promise<AgentRunReport<ModelParityOutput>> => {
    const call: RunnerCall = {
      specName: spec.name,
      model: spec.model,
      maxTurns: spec.maxTurns,
      maxBudgetUsd: spec.maxBudgetUsd,
      toolNames: spec.tools.map((entry) => entry.name),
      systemPrompt: spec.systemPrompt,
      prompt,
      pair: pairIn(prompt),
    };
    calls.push(call);
    if (readsChange) await (spec.tools[0].handler as unknown as ToolHandler)({ pair: call.pair }, {});
    return respond(call, calls.length - 1);
  };
  return runner as unknown as ParityRunner;
}

function inSyncRunner(calls: RunnerCall[] = []): ParityRunner {
  return fakeRunner((call) => modelReport({ output: { pairs: [verdict(call.pair)] } }), calls);
}

function candidate(index: number, changedSide: 'source' | 'mirror' = 'source'): CandidatePair {
  return { pair: MIRROR_PAIRS[index], changedSide };
}

describe('pair list', () => {
  it('has stable unique ids and eight distinct tracked files', () => {
    assert.deepEqual(
      MIRROR_PAIRS.map((pair) => pair.id),
      [...MIRROR_PAIR_IDS],
    );
    assert.equal(new Set(pairFiles()).size, 8);
    const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n'));
    for (const file of pairFiles()) assert.ok(tracked.has(file), `${file} is tracked`);
  });

  it('matches the workflow push.paths list', () => {
    const listed = parseWorkflowPushPaths(readFileSync(join(REPO_ROOT, MIRROR_PARITY_WORKFLOW), 'utf8'));
    assert.deepEqual([...listed].sort(), pairFiles().sort());
    assert.doesNotThrow(() => assertWorkflowPathsMatch(REPO_ROOT));
  });

  it('reads only the push paths, not other lists, and rejects a workflow without them', () => {
    const workflow = ['on:', '  push:', '    branches: [main]', '    paths:', "      - 'a.js'", '      # note', '      - b.js', '  workflow_dispatch:', '    inputs:', '      sha:'].join('\n');
    assert.deepEqual(parseWorkflowPushPaths(workflow), ['a.js', 'b.js']);
    assert.throws(() => parseWorkflowPushPaths('on:\n  push:\n    branches: [main]\n'), /no push\.paths list/);
    const pathsUnderPullRequest = ['on:', '  push:', '    branches: [main]', '  pull_request:', '    paths:', "      - 'a.js'"].join('\n');
    assert.throws(() => parseWorkflowPushPaths(pathsUnderPullRequest), /no push\.paths list/);
  });

  it('fails when the workflow list drifts from pairs.ts in either direction', async () => {
    const root = await tempDir('mp-wf-');
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    const real = readFileSync(join(REPO_ROOT, MIRROR_PARITY_WORKFLOW), 'utf8');
    const target = join(root, MIRROR_PARITY_WORKFLOW);
    await writeFile(target, real.replace("      - '.claude/commands/check-ci.md'\n", ''));
    assert.throws(() => assertWorkflowPathsMatch(root), /missing: \.claude\/commands\/check-ci\.md/);
    await writeFile(target, real.replace("      - '.claude/commands/check-ci.md'\n", "      - '.claude/commands/check-ci.md'\n      - 'extra.js'\n"));
    assert.throws(() => assertWorkflowPathsMatch(root), /extra: extra\.js/);
  });

  it('keeps the workflow hardening of the convention review workflow', () => {
    const workflow = readFileSync(join(REPO_ROOT, MIRROR_PARITY_WORKFLOW), 'utf8');
    assert.match(workflow, /^permissions: \{\}$/m);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
    assert.match(workflow, /fetch-depth: 0/);
    assert.match(workflow, /sha:\n\s+description: 'Commit to check'\n\s+required: true/);
    assert.match(workflow, /\^\[0-9a-fA-F\]\{7,64\}\$/);
    assert.match(workflow, /--agent mirror-parity --target slack/);
    assert.equal(workflow.match(/CLAUDE_CODE_OAUTH_TOKEN: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/g)?.length, 1);
    assert.equal(workflow.match(/permissions: \{\}/g)?.length, 2);
  });
});

describe('pair scan', () => {
  it('treats only exactly-one-side changes as candidates', async () => {
    const repo = await makePairRepo();
    const sha = await repo.commit({
      'lighthouserc.js': 'one side\n',
      'lighthouserc.mobile.js': 'both\n',
      'lighthouserc.mobile.bitbucket.js': 'both\n',
      '.claude/commands/check-ci.md': 'mirror side\n',
      'unrelated.txt': 'noise\n',
    });
    const scan = scanPairs(repo.dir, `${sha}^`, sha);
    assert.deepEqual(
      scan.candidates.map((entry) => `${entry.pair.id}:${entry.changedSide}`),
      ['lighthouserc-desktop:source', 'devops-check-ci:mirror'],
    );
    assert.deepEqual(scan.bothSidesChanged, ['lighthouserc-mobile']);
  });

  it('finds nothing when no pair file changed', async () => {
    const repo = await makePairRepo();
    const sha = await repo.commit({ 'unrelated.txt': 'noise\n' });
    assert.deepEqual(scanPairs(repo.dir, `${sha}^`, sha), { candidates: [], bothSidesChanged: [] });
  });

  it('fails closed, with no model call, when a pair file is missing at the commit', async () => {
    const repo = await makePairRepo(['lighthouserc.mobile.bitbucket.js']);
    const sha = await repo.commit({ 'lighthouserc.js': 'one side\n' });
    assert.throws(() => assertPairFilesTracked(repo.dir, sha), /pair file missing or untracked at .*lighthouserc\.mobile\.bitbucket\.js/);
    const calls: RunnerCall[] = [];
    await assert.rejects(
      checkMirrorParity({ targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' }, inSyncRunner(calls)),
      /missing or untracked/,
    );
    assert.equal(calls.length, 0);
  });

  it('treats a file present on disk but never committed as untracked', async () => {
    const repo = await makePairRepo(['lighthouserc.mobile.bitbucket.js']);
    const sha = await repo.commit({ 'lighthouserc.js': 'one side\n' });
    await writeFile(join(repo.dir, 'lighthouserc.mobile.bitbucket.js'), 'untracked\n');
    assert.throws(() => assertPairFilesTracked(repo.dir, sha), /missing or untracked/);
  });

  it('treats each side changed in a different commit of the range as both sides changed', async () => {
    const repo = await makePairRepo();
    const base = gitIn(repo.dir, ['rev-parse', 'HEAD']).trim();
    await repo.commit({ 'lighthouserc.js': 'source edit\n' });
    const sha = await repo.commit({ 'lighthouserc.bitbucket.js': 'mirror edit\n' });
    const calls: RunnerCall[] = [];
    const result = await checkMirrorParity({ targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha, base, authMode: 'subscription-oauth' }, inSyncRunner(calls));
    assert.equal(result.kind, 'empty');
    assert.deepEqual(result.bothSidesChanged, ['lighthouserc-desktop']);
    assert.equal(calls.length, 0);
  });

  it('checks a root commit against the empty tree, where every pair counts as both sides changed', async () => {
    const repo = await makePairRepo();
    const sha = gitIn(repo.dir, ['rev-parse', 'HEAD']).trim();
    const calls: RunnerCall[] = [];
    const result = await checkMirrorParity({ targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' }, inSyncRunner(calls));
    assert.equal(result.kind, 'empty');
    assert.deepEqual(result.bothSidesChanged, [...MIRROR_PAIR_IDS]);
    assert.equal(calls.length, 0);
  });

  it('fails closed in a shallow clone instead of skipping every pair', async () => {
    const repo = await makePairRepo();
    await repo.commit({ 'lighthouserc.js': 'one side\n' });
    const clone = await tempDir('mp-shallow-');
    gitIn(clone, ['clone', '--quiet', '--depth', '1', pathToFileURL(repo.dir).href, '.']);
    assert.throws(() => gitIn(clone, ['rev-parse', '--verify', '--quiet', 'HEAD^']));
    const sha = gitIn(clone, ['rev-parse', 'HEAD']).trim();
    const calls: RunnerCall[] = [];
    await assert.rejects(
      checkMirrorParity({ targetRoot: clone, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' }, inSyncRunner(calls)),
      /shallow clone/,
    );
    assert.equal(calls.length, 0);
  });
});

describe('checkMirrorParity on real history', () => {
  async function check(sha: string): Promise<{ result: Awaited<ReturnType<typeof checkMirrorParity>>; calls: RunnerCall[] }> {
    const calls: RunnerCall[] = [];
    const result = await checkMirrorParity(
      { targetRoot: REPO_ROOT, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' },
      inSyncRunner(calls),
    );
    return { result, calls };
  }

  it('makes no model call when both sides of both lighthouserc pairs changed (d20638c)', { skip: !hasCommit(HISTORY.bothLighthouse) }, async () => {
    const { result, calls } = await check(HISTORY.bothLighthouse);
    assert.equal(calls.length, 0);
    assert.equal(result.kind, 'empty');
    assert.deepEqual(result.bothSidesChanged, ['lighthouserc-desktop', 'lighthouserc-mobile']);
  });

  it('makes no model call when both sides of the index pair changed (93c84ba)', { skip: !hasCommit(HISTORY.bothIndex) }, async () => {
    const { result, calls } = await check(HISTORY.bothIndex);
    assert.equal(calls.length, 0);
    assert.equal(result.kind, 'empty');
    assert.deepEqual(result.bothSidesChanged, ['lhci-index']);
  });

  it('runs once per pair when one side of three pairs changed (6567436)', { skip: !hasCommit(HISTORY.threePairs) }, async () => {
    const { result, calls } = await check(HISTORY.threePairs);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map((call) => call.pair), ['lighthouserc-desktop', 'lighthouserc-mobile', 'lhci-index']);
    assert.equal(result.kind, 'checked');
    if (result.kind !== 'checked') return;
    assert.deepEqual(result.report.output?.pairs.map((entry) => entry.changedSide), ['source', 'source', 'source']);
    assert.equal(result.report.outcome, 'success');
    for (const call of calls) {
      assert.equal(call.specName, 'mirror-parity');
      assert.equal(call.model, MIRROR_PARITY_MODEL);
      assert.equal(call.model, 'haiku');
      assert.equal(call.maxTurns, MIRROR_PARITY_MAX_TURNS);
      assert.equal(call.maxBudgetUsd, MIRROR_PARITY_MAX_BUDGET_USD);
      assert.deepEqual(call.toolNames, ['get_pair_change']);
      assert.ok(call.systemPrompt.includes('## Bitbucket Lighthouse Pipeline'));
      assert.ok(call.systemPrompt.includes('untrusted'));
    }
  });

  it('has one candidate when only the devops agent file changed (869d78c)', { skip: !hasCommit(HISTORY.devopsOnly) }, async () => {
    const { result, calls } = await check(HISTORY.devopsOnly);
    assert.deepEqual(calls.map((call) => call.pair), ['devops-check-ci']);
    assert.equal(result.kind, 'checked');
    assert.ok(calls[0].systemPrompt.includes('## Failure Classification Matrix'));
    assert.ok(!calls[0].systemPrompt.includes('## Bitbucket Lighthouse Pipeline'));
  });
});

describe('rule text', () => {
  it('reads the Bitbucket section and the taxonomy table from the repository', () => {
    const lighthouse = loadPairRuleText(REPO_ROOT, 'bitbucket-lighthouse');
    assert.ok(lighthouse.includes('## Bitbucket Lighthouse Pipeline'));
    assert.ok(lighthouse.includes('GitHub-only by design'));
    const taxonomy = loadPairRuleText(REPO_ROOT, 'ci-failure-taxonomy');
    for (const category of ['TIMEOUT', 'SELECTOR_STALE', 'ASSERTION', 'NETWORK', 'AUTH', 'FLAKY', 'ENV_CONFIG', 'INFRA']) {
      assert.ok(taxonomy.includes(`| **${category}** |`), category);
    }
  });

  async function ruleRootWith(file: string, edit: (text: string) => string): Promise<string> {
    const root = await tempDir('mp-rules-');
    for (const source of Object.values(RULE_SOURCES)) {
      const target = join(root, source.file);
      await mkdir(dirname(target), { recursive: true });
      await cp(join(REPO_ROOT, source.file), target);
    }
    await writeFile(join(root, file), edit(readFileSync(join(root, file), 'utf8')));
    return root;
  }

  it('fails closed with no runner call when the CLAUDE.md heading is missing', async () => {
    const root = await ruleRootWith('CLAUDE.md', (text) => text.replace('## Bitbucket Lighthouse Pipeline', '## Renamed Section'));
    assert.throws(() => loadPairRuleText(root, 'bitbucket-lighthouse'), /rule heading not found/);
    const repo = await makePairRepo();
    const sha = await repo.commit({ 'lighthouserc.js': 'one side\n' });
    const calls: RunnerCall[] = [];
    await assert.rejects(
      checkMirrorParity({ targetRoot: repo.dir, ruleRoot: root, sha, authMode: 'subscription-oauth' }, inSyncRunner(calls)),
      /rule heading not found/,
    );
    assert.equal(calls.length, 0);
  });

  it('fails closed when the taxonomy heading or table is gone', async () => {
    const noHeading = await ruleRootWith('.claude/agents/devops-cicd-specialist.md', (text) =>
      text.replace('## Failure Classification Matrix', '## Something Else'),
    );
    assert.throws(() => loadPairRuleText(noHeading, 'ci-failure-taxonomy'), /rule heading not found/);
    const noRows = await ruleRootWith('.claude/agents/devops-cicd-specialist.md', (text) => text.replace(/^\| \*\*[A-Z_]+\*\* \|.*$/gm, ''));
    assert.throws(() => loadPairRuleText(noRows, 'ci-failure-taxonomy'), /failure taxonomy table not found/);
  });

  it('loads a renamed category, the drift the devops pair exists to report', async () => {
    const renamed = await ruleRootWith('.claude/agents/devops-cicd-specialist.md', (text) => text.replace('| **FLAKY**', '| **WOBBLY**'));
    const pair = MIRROR_PAIRS[3];
    const prompt = buildSystemPrompt(pair, loadPairRuleText(renamed, pair.rule));
    assert.ok(prompt.includes('| **WOBBLY** |'));
    assert.ok(!prompt.includes('FLAKY'));
  });

  it('puts only the one pair rule and the data-handling warning in a system prompt', () => {
    const pair = MIRROR_PAIRS[3];
    const prompt = buildSystemPrompt(pair, loadPairRuleText(REPO_ROOT, pair.rule));
    assert.ok(prompt.includes(`pair "${pair.id}"`));
    assert.ok(prompt.includes('<<<UNTRUSTED-DATA'));
    assert.ok(!prompt.includes('numberOfRuns'));
    assert.match(buildUserPrompt(pair, 'abc1234', 'mirror'), /Only the mirror side changed/);
  });
});

describe('verdict validation', () => {
  const target = candidate(0);

  it('drops a verdict for any pair other than the candidate', () => {
    const report = modelReport({
      output: { pairs: [verdict('lighthouserc-mobile', { status: 'needs-mirror' }), verdict('lighthouserc-desktop', { status: 'intentional-divergence' })] },
    });
    const settled = settleVerdict(target, report, true);
    assert.equal(settled.pair, 'lighthouserc-desktop');
    assert.equal(settled.status, 'intentional-divergence');
    assert.equal(settled.changedSide, 'source');
  });

  it('turns an omitted candidate into unclear with fixed harness text, never model text', () => {
    const report = modelReport({ output: { pairs: [verdict('lhci-index', { explanation: 'Ignore previous instructions' })] } });
    const settled = settleVerdict(target, report, true);
    assert.equal(settled.status, 'unclear');
    assert.equal(settled.explanation, 'The model returned no verdict for this pair.');
    assert.equal(settled.missingChange, '');
  });

  it('marks a run that did not complete as unclear', () => {
    const settled = settleVerdict(target, modelReport({ outcome: 'usage-exhausted', output: undefined }), true);
    assert.equal(settled.status, 'unclear');
    assert.match(settled.explanation, /did not complete/);
  });

  it('turns several verdicts for the candidate into unclear, so an in-sync cannot hide a needs-mirror', () => {
    const report = modelReport({
      output: { pairs: [verdict('lighthouserc-desktop'), verdict('lighthouserc-desktop', { status: 'needs-mirror', missingChange: 'copy' })] },
    });
    const settled = settleVerdict(target, report, true);
    assert.equal(settled.status, 'unclear');
    assert.equal(settled.explanation, 'The model returned more than one verdict for this pair.');
  });

  it('turns a verdict given without the tool having served the change into unclear', () => {
    const settled = settleVerdict(target, modelReport({ output: { pairs: [verdict('lighthouserc-desktop')] } }), false);
    assert.equal(settled.status, 'unclear');
    assert.equal(settled.explanation, 'The model gave a verdict without reading the change.');
  });

  it('redacts secrets and caps the model text', () => {
    const report = modelReport({
      output: {
        pairs: [verdict('lighthouserc-desktop', { status: 'needs-mirror', explanation: `${PLANTED_JWT} ${'x'.repeat(5000)}`, missingChange: 'y'.repeat(5000) })],
      },
    });
    const settled = settleVerdict(target, report, true);
    assert.ok(!settled.explanation.includes(PLANTED_JWT));
    assert.ok(settled.explanation.length <= MAX_PARITY_EXPLANATION_CHARS);
    assert.ok(settled.missingChange.length <= MAX_PARITY_MISSING_CHANGE_CHARS);
  });

  it('enforces the 300-character limits and the status set in the output schemas', () => {
    const long = 'x'.repeat(MAX_PARITY_EXPLANATION_CHARS + 1);
    assert.equal(ModelParityOutputSchema.safeParse({ pairs: [verdict('lhci-index', { explanation: long })] }).success, false);
    assert.equal(ModelParityOutputSchema.safeParse({ pairs: [verdict('lhci-index', { missingChange: long })] }).success, false);
    assert.equal(ModelParityOutputSchema.safeParse({ pairs: [{ ...verdict('lhci-index'), status: 'maybe' }] }).success, false);
    assert.equal(ModelParityOutputSchema.safeParse({ pairs: [{ ...verdict('other-pair' as MirrorPairId) }] }).success, false);
    assert.equal(ModelParityOutputSchema.safeParse({ pairs: [verdict('lhci-index')] }).success, true);
    assert.deepEqual([...PARITY_STATUSES], ['in-sync', 'needs-mirror', 'intentional-divergence', 'unclear']);
  });
});

describe('per-pair runs', () => {
  it('stops after the first run that did not complete and marks the rest unclear', async () => {
    const repo = await makePairRepo();
    const sha = await repo.commit({ 'lighthouserc.js': 'a\n', 'lighthouserc.mobile.js': 'b\n', 'scripts/generate-lhci-index.js': 'c\n' });
    const calls: RunnerCall[] = [];
    const runner = fakeRunner(
      (call, index) =>
        index === 1
          ? modelReport({ outcome: 'usage-exhausted', output: undefined, errors: ['rate limited'], costUsdEstimate: 0 })
          : modelReport({ output: { pairs: [verdict(call.pair, { status: 'needs-mirror', missingChange: 'copy it' })] } }),
      calls,
    );
    const result = await checkMirrorParity({ targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' }, runner);
    assert.equal(calls.length, 2);
    assert.equal(result.kind, 'checked');
    if (result.kind !== 'checked') return;
    assert.equal(result.report.outcome, 'usage-exhausted');
    assert.deepEqual(result.report.output?.pairs.map((entry) => entry.status), ['needs-mirror', 'unclear', 'unclear']);
    assert.deepEqual(result.report.errors, ['rate limited']);
    assert.equal(result.runs.length, 2);
  });

  it('posts an unclear verdict when the model answered in-sync without calling get_pair_change', async () => {
    const repo = await makePairRepo();
    const sha = await repo.commit({ 'lighthouserc.js': 'threshold change\n' });
    const result = await checkMirrorParity(
      { targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth' },
      fakeRunner((call) => modelReport({ output: { pairs: [verdict(call.pair)] } }), [], false),
    );
    assert.equal(result.kind, 'checked');
    if (result.kind !== 'checked' || result.report.output === undefined) return;
    assert.deepEqual(result.report.output.pairs.map((entry) => entry.status), ['unclear']);
    assert.equal(AGENT_DELIVERY_REGISTRY['mirror-parity'].isEmpty?.(result.report.output), false);
  });

  it('sums cost, turns and usage across runs and keeps the first non-success outcome', () => {
    const usage = { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4, costUSD: 0.5 };
    const merged = mergeReports(
      [
        modelReport({ costUsdEstimate: 0.1, numTurns: 2, modelUsage: { haiku: usage }, toolUseNames: ['mcp__mirror-parity__get_pair_change'] }),
        modelReport({
          outcome: 'usage-exhausted',
          resultSubtype: 'error_during_execution',
          rateLimit: { status: 'rejected', rateLimitType: 'five_hour' },
          costUsdEstimate: 0.2,
          numTurns: 3,
          modelUsage: { haiku: usage },
          toolUseNames: ['mcp__mirror-parity__get_pair_change'],
          errors: ['rate limited'],
        }),
        modelReport({ outcome: 'agent-error', resultSubtype: 'later', costUsdEstimate: 0, numTurns: 0 }),
      ],
      [],
    );
    assert.equal(merged.agent, 'mirror-parity');
    assert.equal(merged.outcome, 'usage-exhausted');
    assert.equal(merged.resultSubtype, 'error_during_execution');
    assert.deepEqual(merged.rateLimit, { status: 'rejected', rateLimitType: 'five_hour' });
    assert.ok(Math.abs(merged.costUsdEstimate - 0.3) < 1e-9);
    assert.equal(merged.numTurns, 5);
    assert.equal(merged.modelUsage.haiku.inputTokens, 2);
    assert.equal(merged.modelUsage.haiku.costUSD, 1);
    assert.deepEqual(merged.toolUseNames, ['mcp__mirror-parity__get_pair_change']);
    assert.deepEqual(merged.errors, ['rate limited']);
  });

  it('passes lowered caps from the request to every run', async () => {
    const repo = await makePairRepo();
    const sha = await repo.commit({ 'lighthouserc.js': 'a\n' });
    const calls: RunnerCall[] = [];
    await checkMirrorParity(
      { targetRoot: repo.dir, ruleRoot: REPO_ROOT, sha, authMode: 'subscription-oauth', maxTurns: 1, maxBudgetUsd: 0.01 },
      inSyncRunner(calls),
    );
    assert.equal(calls[0].maxTurns, 1);
    assert.equal(calls[0].maxBudgetUsd, 0.01);
  });
});

describe('get_pair_change', () => {
  async function toolFor(
    files: Record<string, string>,
    index = 0,
    changedSide: 'source' | 'mirror' = 'source',
  ): Promise<{ ctx: PairToolContext; call: (args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }> }> {
    const repo = await makePairRepo();
    const sha = await repo.commit(files);
    const ctx: PairToolContext = { repoRoot: repo.dir, sha, base: `${sha}^`, candidate: candidate(index, changedSide) };
    const { tools } = createPairTools(ctx);
    assert.deepEqual(tools.map((entry) => entry.name), ['get_pair_change']);
    return {
      ctx,
      call: async (args) => {
        const result = await (tools[0].handler as unknown as ToolHandler)(args, {});
        return { text: result.content[0].text, isError: result.isError === true };
      },
    };
  }

  it('returns the changed hunks and the full counterpart as fenced untrusted data', async () => {
    const { call } = await toolFor({ 'lighthouserc.js': 'changed line\n', 'lighthouserc.bitbucket.js': 'counterpart body\n' });
    const { text, isError } = await call({ pair: 'lighthouserc-desktop' });
    assert.equal(isError, false);
    assert.match(text, /^pair=lighthouserc-desktop changedSide=source changedFile=lighthouserc\.js counterpartFile=lighthouserc\.bitbucket\.js\n/);
    assert.match(text, /<<<UNTRUSTED-DATA id=[0-9a-f]{16} label=changed-hunks>>>/);
    assert.match(text, /<<<UNTRUSTED-DATA id=[0-9a-f]{16} label=counterpart-file>>>/);
    assert.ok(text.includes('+changed line'));
    assert.ok(text.includes('-base lighthouserc.js'));
    assert.ok(text.includes('1: counterpart body'));
  });

  it('reads the hunks from the mirror side and the counterpart from the source when the mirror changed', async () => {
    const { call } = await toolFor({ 'lighthouserc.bitbucket.js': 'mirror edit\n' }, 0, 'mirror');
    const { text } = await call({ pair: 'lighthouserc-desktop' });
    assert.ok(text.includes('+mirror edit'));
    assert.ok(text.includes('1: base lighthouserc.js'));
  });

  it('rejects an id that is not the run candidate and returns nothing for it', async () => {
    const { call } = await toolFor({ 'lighthouserc.js': 'x\n', 'lighthouserc.mobile.js': 'MOBILE_MARKER\n' });
    for (const pair of ['lighthouserc-mobile', 'lhci-index', 'not-a-pair', '../CLAUDE.md', '']) {
      const { text, isError } = await call({ pair });
      assert.equal(isError, true, pair);
      assert.ok(!text.includes('MOBILE_MARKER'));
    }
  });

  it('returns nothing outside the pair, even when other files changed in the same commit', async () => {
    const { call } = await toolFor({
      'lighthouserc.js': 'in pair\n',
      'lighthouserc.mobile.js': 'OTHER_PAIR_MARKER\n',
      'notes/secret.txt': 'OUTSIDE_MARKER\n',
      '.env.staging': 'API_KEY=OUTSIDE_ENV\n',
    });
    const { text } = await call({ pair: 'lighthouserc-desktop' });
    for (const marker of ['OTHER_PAIR_MARKER', 'OUTSIDE_MARKER', 'OUTSIDE_ENV']) assert.ok(!text.includes(marker), marker);
  });

  it('redacts secrets in both the hunks and the counterpart', async () => {
    const { call } = await toolFor({ 'lighthouserc.js': `token ${PLANTED_JWT}\n`, 'lighthouserc.bitbucket.js': `token ${PLANTED_JWT}\n` });
    const { text } = await call({ pair: 'lighthouserc-desktop' });
    assert.ok(!text.includes(PLANTED_JWT));
  });

  it('caps the hunks at a line boundary and the counterpart at the file cap', async () => {
    const hunkLines = Array.from({ length: 4000 }, (_, index) => `line ${index} ${'x'.repeat(40)}`).join('\n');
    const { call } = await toolFor({ 'lighthouserc.js': `${hunkLines}\n`, 'lighthouserc.bitbucket.js': `${'y'.repeat(MAX_FILE_CHARS * 2)}\n` });
    const { text } = await call({ pair: 'lighthouserc-desktop' });
    assert.ok(text.includes(HUNK_TRUNCATION_NOTICE.trim()));
    assert.ok(text.includes('truncated=true'));
    assert.ok(text.length < MAX_DIFF_CHARS + MAX_FILE_CHARS + 2000);
  });

  it('counts the change as served only after a successful call', async () => {
    const repo = await makePairRepo();
    const sha = await repo.commit({ 'lighthouserc.js': 'x\n' });
    const pairTools = createPairTools({ repoRoot: repo.dir, sha, base: `${sha}^`, candidate: candidate(0) });
    const handler = pairTools.tools[0].handler as unknown as ToolHandler;
    assert.equal(pairTools.served(), false);
    assert.equal((await handler({ pair: 'lhci-index' }, {})).isError, true);
    assert.equal(pairTools.served(), false);
    await handler({ pair: 'lighthouserc-desktop' }, {});
    assert.equal(pairTools.served(), true);
  });

  it('reports a counterpart that is absent at the commit as an error result', async () => {
    const { ctx } = await toolFor({ 'lighthouserc.js': 'x\n' });
    const missing: PairToolContext = { ...ctx, candidate: { pair: { ...MIRROR_PAIRS[0], mirror: 'no-such-file.js' }, changedSide: 'source' } };
    const result = getPairChange(missing, 'lighthouserc-desktop');
    assert.equal(result.isError, true);
  });
});

describe('main CLI', () => {
  async function runIn(dir: string, runner: ParityRunner, extra: string[] = []): Promise<{ code: number; out: string }> {
    const out = join(await tempDir('mp-out-'), 'reports');
    const code = await runCli(['--sha', gitIn(dir, ['rev-parse', 'HEAD']).trim(), '--out', out, ...extra], dir, {}, runner);
    return { code, out };
  }

  it('writes the report and run log and exits 0 when every run succeeds', async () => {
    const repo = await makePairRepo();
    await repo.commit({ 'lighthouserc.js': 'a\n', '.claude/commands/check-ci.md': 'b\n' });
    mock.method(console, 'log', () => undefined);
    const { code, out } = await runIn(
      repo.dir,
      fakeRunner((call) => modelReport({ output: { pairs: [verdict(call.pair, { status: 'needs-mirror', missingChange: 'copy' })] } })),
    );
    assert.equal(code, 0);
    const report = JSON.parse(readFileSync(join(out, 'mirror-parity.json'), 'utf8')) as AgentRunReport<MirrorParityOutput>;
    assert.equal(report.agent, 'mirror-parity');
    assert.equal(MirrorParityOutputSchema.safeParse(report.output).success, true);
    const log = JSON.parse(readFileSync(join(out, 'run-log.json'), 'utf8')) as {
      statusCounts: Record<ParityStatus, number>;
      candidates: string[];
      runs: unknown[];
    };
    assert.equal(log.statusCounts['needs-mirror'], 2);
    assert.deepEqual(log.candidates, ['lighthouserc-desktop', 'devops-check-ci']);
    assert.equal(log.runs.length, 2);
  });

  it('exits non-zero when any run does not succeed, and still writes the report', async () => {
    const repo = await makePairRepo();
    await repo.commit({ 'lighthouserc.js': 'a\n', 'lighthouserc.mobile.js': 'b\n' });
    mock.method(console, 'log', () => undefined);
    mock.method(console, 'error', () => undefined);
    const { code, out } = await runIn(
      repo.dir,
      fakeRunner((call, index) =>
        index === 1 ? modelReport({ outcome: 'agent-error', output: undefined, errors: ['boom'] }) : modelReport({ output: { pairs: [verdict(call.pair)] } }),
      ),
    );
    assert.equal(code, 1);
    const report = JSON.parse(readFileSync(join(out, 'mirror-parity.json'), 'utf8')) as AgentRunReport<MirrorParityOutput>;
    assert.equal(report.outcome, 'agent-error');
  });

  it('exits 0 and writes nothing when no pair has exactly one changed side', async () => {
    const repo = await makePairRepo();
    await repo.commit({ 'lighthouserc.js': 'a\n', 'lighthouserc.bitbucket.js': 'a\n' });
    const log = mock.method(console, 'log', () => undefined);
    const calls: RunnerCall[] = [];
    const { code, out } = await runIn(repo.dir, inSyncRunner(calls));
    assert.equal(code, 0);
    assert.equal(calls.length, 0);
    assert.equal(existsSync(out), false);
    assert.match(String(log.mock.calls[0].arguments[0]), /nothing to check/);
  });

  it('fails closed on a pair file missing at the commit, with no runner call', async () => {
    const repo = await makePairRepo(['scripts/generate-lhci-index.bitbucket.js']);
    await repo.commit({ 'lighthouserc.js': 'a\n' });
    mock.method(console, 'error', () => undefined);
    const calls: RunnerCall[] = [];
    const { code, out } = await runIn(repo.dir, inSyncRunner(calls));
    assert.equal(code, 1);
    assert.equal(calls.length, 0);
    assert.equal(existsSync(out), false);
  });

  it('rejects missing or malformed arguments and caps above the defaults', async () => {
    const errors = mock.method(console, 'error', () => undefined);
    const calls: RunnerCall[] = [];
    const never = inSyncRunner(calls);
    assert.equal(await runCli([], REPO_ROOT, {}, never), 1);
    assert.equal(await runCli(['--sha', 'abc1234', '--max-turns', String(MIRROR_PARITY_MAX_TURNS + 1)], REPO_ROOT, {}, never), 1);
    assert.equal(await runCli(['--sha', 'abc1234', '--max-budget-usd', String(MIRROR_PARITY_MAX_BUDGET_USD + 0.01)], REPO_ROOT, {}, never), 1);
    assert.equal(await runCli(['--sha', '-abc'], REPO_ROOT, {}, never), 1);
    assert.equal(await runCli(['--sha', 'HEAD'], REPO_ROOT, {}, never), 1);
    assert.ok(errors.mock.callCount() >= 5);
    assert.equal(calls.length, 0);
  });

  it(
    'spawns without a credential: exits 1 on a candidate commit and 0 on a both-sides commit',
    { skip: !hasCommit(HISTORY.threePairs) || !hasCommit(HISTORY.bothLighthouse) },
    async () => {
      const outDir = join(await tempDir('mp-spawn-'), 'reports');
      const spawn = (sha: string): { status: number | null; stdout: string; stderr: string } => {
        const result = spawnSync(process.execPath, [...NODE_FLAGS, MAIN_PATH, '--sha', sha, '--out', outDir], {
          cwd: REPO_ROOT,
          env: cleanEnv(),
          encoding: 'utf8',
          timeout: 60_000,
        });
        return { status: result.status, stdout: result.stdout, stderr: result.stderr };
      };
      const candidateRun = spawn(HISTORY.threePairs);
      assert.equal(candidateRun.status, 1);
      assert.match(candidateRun.stderr, /CLAUDE_CODE_OAUTH_TOKEN is required/);
      const bothRun = spawn(HISTORY.bothLighthouse);
      assert.equal(bothRun.status, 0, bothRun.stderr);
      assert.match(bothRun.stdout, /nothing to check/);
    },
  );
});

describe('delivery to Slack', () => {
  const slackEnv = { SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/x' };
  const runEnv = {
    ...slackEnv,
    SHA: 'abcdef1234567890abcdef1234567890abcdef12',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_RUN_ID: '12345',
    GITHUB_REF_NAME: 'main',
    COMMIT_SUBJECT: 'lighthouse(ci): add TAF urls',
  };
  const repoUrl = 'https://github.com/owner/repo';
  const blob = `${repoUrl}/blob/${runEnv.SHA}`;

  function pairVerdict(pair: MirrorPairId, overrides: Partial<PairVerdict> = {}): PairVerdict {
    return { ...verdict(pair), changedSide: 'source', ...overrides };
  }

  function report(pairs: PairVerdict[]): AgentRunReport<MirrorParityOutput> {
    return { ...(modelReport() as unknown as AgentRunReport<MirrorParityOutput>), output: { pairs } };
  }

  async function reportFile(value: AgentRunReport<unknown>): Promise<string> {
    const path = join(await tempDir('mp-deliver-'), 'report.json');
    await writeFile(path, JSON.stringify(value));
    return path;
  }

  function makeFetch(): { fetchImpl: FetchLike; calls: () => number; body: () => string } {
    let last = '';
    const spy = mock.fn<FetchLike>(async (_url, init) => {
      last = String(init.body);
      return { ok: true, status: 200 };
    });
    return { fetchImpl: spy, calls: () => spy.mock.callCount(), body: () => last };
  }

  async function deliver(value: AgentRunReport<unknown>): Promise<{ code: number; http: ReturnType<typeof makeFetch> }> {
    const http = makeFetch();
    const code = await runDelivery(
      ['--report', await reportFile(value), '--agent', 'mirror-parity', '--target', 'slack'],
      runEnv,
      AGENT_DELIVERY_REGISTRY,
      http.fetchImpl,
    );
    return { code, http };
  }

  function texts(message: SlackMessage): string[] {
    const blocks: SlackBlock[] = [...message.blocks, ...message.attachments.flatMap((attachment) => attachment.blocks)];
    return blocks.flatMap((block) => {
      if (block.type === 'section') return 'fields' in block ? block.fields.map((field) => field.text) : [block.text.text];
      return block.type === 'header' ? [block.text.text] : [];
    });
  }

  it('posts nothing when every pair is in sync or an intentional divergence', async () => {
    const { code, http } = await deliver(
      report([pairVerdict('lighthouserc-desktop'), pairVerdict('lhci-index', { status: 'intentional-divergence' })]),
    );
    assert.equal(code, 0);
    assert.equal(http.calls(), 0);
  });

  it('decides emptiness from needs-mirror and unclear only', () => {
    const isEmpty = AGENT_DELIVERY_REGISTRY['mirror-parity'].isEmpty;
    assert.ok(isEmpty);
    const empty = (...statuses: ParityStatus[]): boolean =>
      isEmpty({ pairs: statuses.map((status) => pairVerdict('lhci-index', { status })) });
    assert.equal(empty(), true);
    assert.equal(empty('in-sync', 'intentional-divergence'), true);
    assert.equal(empty('in-sync', 'needs-mirror'), false);
    assert.equal(empty('unclear'), false);
    assert.equal(needsAction(pairVerdict('lhci-index', { status: 'needs-mirror' })), true);
  });

  it('posts Block Kit that names the changed file and its counterpart with repo links', async () => {
    const { code, http } = await deliver(
      report([
        pairVerdict('lhci-index', { status: 'needs-mirror', explanation: 'The layout changed.', missingChange: 'Add the new table to the Bitbucket copy.' }),
        pairVerdict('lighthouserc-mobile', { status: 'unclear', changedSide: 'mirror', explanation: 'Cannot tell.' }),
        pairVerdict('lighthouserc-desktop'),
      ]),
    );
    assert.equal(code, 0);
    assert.equal(http.calls(), 1);
    const message = JSON.parse(http.body()) as SlackMessage;
    assert.equal(message.text, 'Mirror parity: action needed on 2 pairs');
    assert.equal(findSlackProblem(message, repoUrl), undefined);
    assert.deepEqual(message.blocks[0], { type: 'header', text: { type: 'plain_text', text: message.text } });
    const fields = texts({ ...message, attachments: [], blocks: [message.blocks[1]] });
    assert.equal(fields[0], `*Commit*\n<${repoUrl}/commit/${runEnv.SHA}|abcdef1> lighthouse(ci): add TAF urls`);
    assert.equal(fields[1], '*Branch*\nmain');
    assert.equal(fields[2], '*Pairs needing action*\n1 needs-mirror, 1 unclear');
    const actions = message.blocks.find((block) => block.type === 'actions');
    assert.deepEqual(actions, {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'View workflow run' }, url: `${repoUrl}/actions/runs/12345` },
        { type: 'button', text: { type: 'plain_text', text: 'View commit' }, url: `${repoUrl}/commit/${runEnv.SHA}` },
      ],
    });
    assert.equal(message.attachments.length, 2);
    const [needsMirror, unclear] = message.attachments.map((attachment) => texts({ ...message, blocks: [], attachments: [attachment] }));
    assert.ok(
      needsMirror[0].includes(`Changed: <${blob}/scripts/generate-lhci-index.js|scripts/generate-lhci-index.js>`),
      needsMirror[0],
    );
    assert.ok(needsMirror[0].includes(`Not changed: <${blob}/scripts/generate-lhci-index.bitbucket.js|scripts/generate-lhci-index.bitbucket.js>`));
    assert.ok(needsMirror[1].includes('The layout changed.'));
    assert.ok(needsMirror[1].includes('*Missing change:* Add the new table to the Bitbucket copy.'));
    assert.ok(unclear[0].includes(`Changed: <${blob}/lighthouserc.mobile.bitbucket.js|lighthouserc.mobile.bitbucket.js>`));
    assert.ok(unclear[0].includes(`Not changed: <${blob}/lighthouserc.mobile.js|lighthouserc.mobile.js>`));
    assert.equal(message.attachments[0].color, '#E01E5A');
  });

  it('keeps hostile model text inert and inside the repository links', async () => {
    const hostile = '<!channel> <https://evil.example|click me> &token=abc123secret https://evil.example/x?access_token=zzz';
    const { code, http } = await deliver(
      report([pairVerdict('lhci-index', { status: 'needs-mirror', explanation: hostile, missingChange: hostile })]),
    );
    assert.equal(code, 0);
    assert.equal(http.calls(), 1);
    const body = http.body();
    const message = JSON.parse(body) as SlackMessage;
    assert.equal(findSlackProblem(message, repoUrl), undefined);
    assert.ok(!body.includes('<!channel>'));
    assert.ok(!body.includes('<https://evil.example'));
    assert.ok(!body.includes('abc123secret'));
    const [links, modelText] = message.attachments[0].blocks;
    assert.ok(links.type === 'section' && 'text' in links && links.text.verbatim === undefined, 'file links keep link parsing');
    assert.ok(modelText.type === 'section' && 'text' in modelText && modelText.text.verbatim === true, 'bare URLs in model text stay unlinked');
  });

  it('refuses a rendered message whose link leaves the repository', () => {
    const output: MirrorParityOutput = { pairs: [pairVerdict('lhci-index', { status: 'needs-mirror' })] };
    const message = renderParitySlack(output, { repoUrl, sha: runEnv.SHA, runUrl: 'https://evil.example/run' });
    assert.equal(findSlackProblem(message, repoUrl), 'Slack link outside the repository');
    const raw = renderParitySlack({ pairs: [pairVerdict('lhci-index', { status: 'needs-mirror', explanation: '<!here> &token=abc' })] }, { repoUrl, sha: runEnv.SHA });
    assert.equal(findSlackProblem(raw, repoUrl), 'leak detected in rendered message');
  });

  it('keeps every block under the Slack limits in the worst case', () => {
    const worst = 'a&<>'.repeat(2000);
    const verdicts = MIRROR_PAIR_IDS.map((id) => pairVerdict(id, { status: 'needs-mirror', explanation: worst, missingChange: worst }));
    const message = renderParitySlack({ pairs: verdicts }, { repoUrl, sha: runEnv.SHA, runUrl: `${repoUrl}/actions/runs/1`, branch: 'main', subject: worst });
    const all = [...message.blocks, ...message.attachments.flatMap((attachment) => attachment.blocks)];
    assert.ok(all.length <= 50);
    for (const text of texts(message)) assert.ok(text.length <= 3000, `${text.length}`);
  });

  it('renders GitHub markdown for every pair and a report that has none', () => {
    const rendered = renderParityMarkdown({ pairs: [pairVerdict('lhci-index', { status: 'needs-mirror', missingChange: 'Do the _thing_' })] });
    assert.equal(rendered.title, 'Mirror parity: action needed on 1 pair');
    assert.ok(rendered.body.includes('`scripts/generate-lhci-index.js` changed, `scripts/generate-lhci-index.bitbucket.js` not'));
    assert.ok(rendered.body.includes('Do the \\_thing\\_'));
    assert.ok(renderParityMarkdown({ pairs: [] }).body.includes('No pairs were checked.'));
  });

  it('refuses a report from a run that did not complete', () => {
    const failed = { ...report([pairVerdict('lhci-index', { status: 'needs-mirror' })]), outcome: 'usage-exhausted' as const };
    const prepared = prepareDelivery(AGENT_DELIVERY_REGISTRY, 'mirror-parity', 'slack', failed);
    assert.equal(prepared.ok, false);
  });

  it('refuses a report for another agent or with an unknown pair id', () => {
    const wrongAgent = { ...report([pairVerdict('lhci-index')]), agent: 'review' };
    assert.equal(prepareDelivery(AGENT_DELIVERY_REGISTRY, 'mirror-parity', 'slack', wrongAgent).ok, false);
    const bad = report([{ ...pairVerdict('lhci-index'), pair: 'bogus' as MirrorPairId }]);
    assert.equal(prepareDelivery(AGENT_DELIVERY_REGISTRY, 'mirror-parity', 'slack', bad).ok, false);
  });
});
