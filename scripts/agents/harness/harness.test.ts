import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, symlinkSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it, mock } from 'node:test';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  AGENT_DELIVERY_REGISTRY,
  codeSpan,
  prepareDelivery,
  runDelivery,
} from './deliver.ts';
import type { DeliveryRegistry, FetchLike } from './deliver.ts';
import { isEntryPoint } from './entry-point.ts';
import { buildAgentEnv, parseAuthMode } from './env.ts';
import { checkInitMessage } from './invariants.ts';
import type { InitExpectation, InitMessageView } from './invariants.ts';
import {
  BUILTIN_AGENT_ALLOWLIST,
  EXTRA_ALLOWED_TOOLS,
  MAX_FILE_CHARS,
  MAX_STDERR_TAIL_CHARS,
  TEMP_DIR_RM_MAX_RETRIES,
} from './limits.ts';
import {
  appendStderr,
  buildQueryOptions,
  buildReport,
  consumeStream,
  createStreamState,
  deriveOutcome,
  findManagedSettingsViolations,
  processMessage,
  readManagedSettingsKeys,
  UNREADABLE_SETTINGS_KEY,
} from './run-agent.ts';
import type { ConsumeResult, ProcessContext } from './run-agent.ts';
import { hasLeak, sanitizeDeep, sanitizeText, scrubSecrets } from './sanitize.ts';
import { listTrackedFiles, readTrackedFile } from './tracked-files.ts';
import type { AgentRunReport, AgentSpec } from './types.ts';

const ZERO_WIDTH_SPACE = '\u200b';
const PLANTED_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlLXZhbHVl';
const PLANTED_EMAIL = 'jane.doe@example.com';
const PLANTED_CARD = '4111 1111 1111 1111';
const PLANTED_TOKEN_URL = 'https://staging.example.test/cb?token=abc123secret&ok=1';
const OPAQUE_CREDENTIAL = 'opaque-credential-value-9f3a';
const SETTINGS_FILE = 'remote-settings.json';

const ctx: ProcessContext = {
  serverName: 'review',
  authMode: 'subscription-oauth',
  extraAllowedTools: [],
  allowedAgents: BUILTIN_AGENT_ALLOWLIST,
};
const expectation: InitExpectation = ctx;

function asMessage(value: Record<string, unknown>): SDKMessage {
  return value as unknown as SDKMessage;
}

function validInit(overrides: Partial<InitMessageView> = {}): InitMessageView {
  return {
    tools: ['mcp__review__get_diff'],
    mcp_servers: [{ name: 'review', status: 'connected' }],
    plugins: [],
    skills: [],
    agents: [],
    permissionMode: 'dontAsk',
    apiKeySource: 'none',
    ...overrides,
  };
}

function initMessage(overrides: Partial<InitMessageView> = {}): SDKMessage {
  return asMessage({
    type: 'system',
    subtype: 'init',
    claude_code_version: '0.0.0-test',
    model: 'sonnet',
    slash_commands: [],
    ...validInit(overrides),
  });
}

function resultMessage(overrides: Record<string, unknown> = {}): SDKMessage {
  return asMessage({
    type: 'result',
    subtype: 'success',
    is_error: false,
    num_turns: 2,
    total_cost_usd: 0.12,
    modelUsage: {
      sonnet: {
        inputTokens: 10,
        outputTokens: 20,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUSD: 0.12,
      },
    },
    permission_denials: [],
    structured_output: { summary: 'ok' },
    ...overrides,
  });
}

function rateLimitMessage(info: Record<string, unknown>): SDKMessage {
  return asMessage({ type: 'rate_limit_event', rate_limit_info: info });
}

async function* streamOf(messages: SDKMessage[], thenThrow?: Error): AsyncGenerator<SDKMessage, void> {
  for (const message of messages) yield message;
  if (thenThrow) throw thenThrow;
}

const readFileTool = tool('read_file', 'Read a tracked file', { path: z.string() }, async (args) => ({
  content: [{ type: 'text', text: args.path }],
}));

const testSpec: AgentSpec<{ summary: string }> = {
  name: 'review',
  systemPrompt: 'test',
  tools: [readFileTool],
  outputSchema: z.object({ summary: z.string() }),
  model: 'sonnet',
  maxTurns: 1,
  maxBudgetUsd: 0.01,
};

function reportInputs(consumed: ConsumeResult): Parameters<typeof buildReport>[1] {
  return {
    consumed,
    timedOut: false,
    stderrTail: '',
    secrets: [],
    managedSettingsKeys: [],
    durationMs: 1,
  };
}

const GIT_TEST_CONFIG: readonly string[] = [
  '-c', 'user.name=test',
  '-c', 'user.email=test@example.invalid',
  '-c', 'commit.gpgsign=false',
  '-c', 'core.hooksPath=',
  '-c', 'core.autocrlf=false',
];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...GIT_TEST_CONFIG, ...args], { cwd, encoding: 'utf8' }).trim();
}

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true, maxRetries: TEMP_DIR_RM_MAX_RETRIES });
}

describe('V0.4 tracked-file reads', () => {
  let repo: string;
  let sha: string;
  let allowed: ReadonlySet<string>;

  before(async () => {
    repo = await makeTempDir('harness-repo-');
    git(repo, 'init', '-q');
    await mkdir(join(repo, 'src', 'utils'), { recursive: true });
    await mkdir(join(repo, 'tests', 'spec'), { recursive: true });
    await writeFile(join(repo, '.gitignore'), 'tests/manual/\nsrc/ignored.ts\n.env\n');
    await writeFile(join(repo, '.env.example'), 'FOO=bar\n');
    await writeFile(join(repo, 'src', 'utils', 'redact.ts'), 'export const X = 1;\nexport const Y = 2;\nexport const Z = 3;\n');
    await writeFile(join(repo, 'src', 'utils', 'x.ts'), 'export const x = 1;\n');
    await writeFile(join(repo, 'src', 'big.ts'), 'const filler = 1;\n'.repeat(5000));
    await writeFile(join(repo, 'tests', 'spec', 'a.spec.ts'), 'export const a = 1;\n');
    await mkdir(join(repo, 'tests', '.auth'), { recursive: true });
    await writeFile(join(repo, 'tests', '.auth', 'state.json'), '{"cookies":[]}\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'fixtures');
    sha = git(repo, 'rev-parse', 'HEAD');

    await mkdir(join(repo, 'tests', 'manual'), { recursive: true });
    await writeFile(join(repo, 'src', 'untracked.ts'), 'export const u = 1;\n');
    await writeFile(join(repo, 'src', 'ignored.ts'), 'export const i = 1;\n');
    await writeFile(join(repo, 'tests', 'manual', 'foo.ts'), 'export const m = 1;\n');
    await writeFile(join(repo, '.env'), 'SECRET=1\n');

    allowed = listTrackedFiles(repo, ['src/', 'tests/']);
  });

  after(async () => {
    await removeTempDir(repo);
  });

  it('lists only tracked files under the allowed prefixes', () => {
    assert.ok(allowed.has('src/utils/x.ts'));
    assert.ok(allowed.has('src/utils/redact.ts'));
    for (const excluded of ['.env.example', '.env', 'src/untracked.ts', 'src/ignored.ts', 'tests/manual/foo.ts', 'tests/.auth/state.json']) {
      assert.ok(!allowed.has(excluded), `${excluded} must not be listed`);
    }
  });

  it('drops .env basenames even when the prefix list would match them', () => {
    const everything = listTrackedFiles(repo, ['']);
    assert.ok(everything.has('src/utils/x.ts'));
    assert.ok(!everything.has('.env.example'));
  });

  const deniedPaths: [string, string][] = [
    ['parent traversal to .env', '../.env'],
    ['traversal in the middle', 'src/../.env'],
    ['absolute posix path', '/etc/passwd'],
    ['windows drive path', 'C:\\x'],
    ['backslash path', 'src\\utils\\x.ts'],
    ['NUL byte', 'src/utils/x.ts\0'],
    ['untracked file', 'src/untracked.ts'],
    ['gitignored file', 'src/ignored.ts'],
    ['gitignored manual test', 'tests/manual/foo.ts'],
    ['tracked file under an .auth directory', 'tests/.auth/state.json'],
  ];
  for (const [label, requested] of deniedPaths) {
    it(`denies ${label}`, () => {
      const result = readTrackedFile(repo, allowed, sha, requested);
      assert.equal(result.ok, false);
    });
  }

  it('denies .env.example even when it is tracked and allowlisted', () => {
    const withEnvExample = new Set([...allowed, '.env.example']);
    assert.equal(readTrackedFile(repo, withEnvExample, sha, '.env.example').ok, false);
  });

  it('fails closed when an allowlisted path does not exist at the commit', () => {
    const missingAtCommit = ['src/untracked.ts', 'src/ignored.ts', 'tests/manual/foo.ts'];
    const widened = new Set([...allowed, ...missingAtCommit]);
    for (const requested of missingAtCommit) {
      assert.equal(readTrackedFile(repo, widened, sha, requested).ok, false);
    }
  });

  it('rejects a malformed sha before invoking git, including refs git itself would accept', () => {
    const expected = { ok: false, error: 'invalid commit sha' };
    assert.deepEqual(readTrackedFile(repo, allowed, '--help', 'src/utils/x.ts'), expected);
    assert.deepEqual(readTrackedFile(repo, allowed, 'HEAD', 'src/utils/x.ts'), expected);
  });

  const guardCases: [string, string, string][] = [
    ['parent traversal', '../.env', 'path traversal is not allowed'],
    ['mid-path traversal', 'src/../x.ts', 'path traversal is not allowed'],
    ['absolute posix path', '/etc/passwd', 'absolute paths are not allowed'],
    ['windows drive path', 'C:/x', 'absolute paths are not allowed'],
    ['backslash path', 'src\\utils\\x.ts', 'path must use forward slashes'],
    ['windows drive with backslash', 'C:\\x', 'path must use forward slashes'],
    ['NUL byte', 'src/utils/x.ts\0', 'path contains a NUL byte'],
    ['env file', 'src/.env.local', 'environment files are not readable'],
    ['auth state directory', 'tests/.auth/state.json', 'auth state files are not readable'],
  ];
  for (const [label, requested, message] of guardCases) {
    it(`path guard alone denies ${label} even when allowlisted`, () => {
      const widened = new Set([...allowed, requested]);
      assert.deepEqual(readTrackedFile(repo, widened, sha, requested), { ok: false, error: message });
    });
  }

  it('denies a path outside the allowlist with the allowlist message', () => {
    assert.deepEqual(readTrackedFile(repo, allowed, sha, 'src/untracked.ts'), {
      ok: false,
      error: 'path is not an allowed tracked file',
    });
  });

  it('reads src/utils/redact.ts with line numbers and honours a line range', () => {
    const whole = readTrackedFile(repo, allowed, sha, 'src/utils/redact.ts');
    assert.ok(whole.ok);
    assert.ok(whole.content.startsWith('1: export const X = 1;'));
    assert.equal(whole.truncated, false);

    const ranged = readTrackedFile(repo, allowed, sha, 'src/utils/redact.ts', { startLine: 2, endLine: 2 });
    assert.ok(ranged.ok);
    assert.equal(ranged.content, '2: export const Y = 2;');
  });

  it('rejects invalid line ranges', () => {
    assert.equal(readTrackedFile(repo, allowed, sha, 'src/utils/x.ts', { startLine: 0 }).ok, false);
    assert.equal(readTrackedFile(repo, allowed, sha, 'src/utils/x.ts', { startLine: 3, endLine: 2 }).ok, false);
  });

  it('applies the size cap', () => {
    const result = readTrackedFile(repo, allowed, sha, 'src/big.ts');
    assert.ok(result.ok);
    assert.equal(result.truncated, true);
    assert.ok(result.content.length <= MAX_FILE_CHARS);
  });
});

describe('V0.5 output sanitising', () => {
  const planted = `jwt ${PLANTED_JWT} mail ${PLANTED_EMAIL} card ${PLANTED_CARD} url ${PLANTED_TOKEN_URL}`;

  it('detects planted secrets in raw text and none after sanitising', () => {
    assert.equal(hasLeak(planted), true);
    const cleaned = sanitizeText(planted, 10_000);
    for (const secret of [PLANTED_JWT, PLANTED_EMAIL, PLANTED_CARD, 'abc123secret']) {
      assert.ok(!cleaned.includes(secret), `${secret} must be removed`);
    }
    assert.equal(hasLeak(cleaned), false);
  });

  it('neutralises GitHub mentions including ones inside or beside code spans', () => {
    const cleaned = sanitizeText('ping @user and `@inline` here', 10_000);
    assert.ok(cleaned.includes(`@${ZERO_WIDTH_SPACE}user`));
    assert.ok(cleaned.includes(`\`@${ZERO_WIDTH_SPACE}inline\``));
    const bypasses = ['`@user', '` @user ``', '@@user', 'x `a` @user `b`', '``@user``'];
    for (const input of bypasses) {
      const out = sanitizeText(input, 10_000);
      assert.ok(!/(?<!\w)@[A-Za-z0-9]/.test(out), `mention survived in ${JSON.stringify(input)}`);
    }
    assert.ok(sanitizeText('@@user', 10_000).includes(`@@${ZERO_WIDTH_SPACE}user`));
  });

  it('leaves angle brackets and ampersands literal because escaping is Slack-render-only', () => {
    assert.equal(sanitizeText('<!channel> a & b <@U123>', 10_000), `<!channel> a & b <@${ZERO_WIDTH_SPACE}U123>`);
  });

  // Assembled at runtime so the public repo never contains a credential-shaped literal for push protection to block.
  const fakeTail = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const harnessCredentials: [string, string][] = [
    ['Anthropic key', ['sk-ant-', 'api03-', fakeTail].join('')],
    ['Anthropic OAuth token', ['sk-ant-', 'oat01-', 'abcdefghijklmnopqrstuvwxyz_-0123456789'].join('')],
    ['GitHub personal token', ['gh', 'p_', fakeTail].join('')],
    ['GitHub server token', ['gh', 's_', fakeTail].join('')],
    ['GitHub fine-grained token', ['github', '_pat_', '11ABCDEFG0abcdefghijklmnop_qrstuvwxyz0123456789'].join('')],
    ['Slack webhook URL', ['https://hooks.slack', '.com/services/', 'T00000000/B00000000/abcdefghijklmnopqrstuvwx'].join('')],
  ];
  for (const [label, credential] of harnessCredentials) {
    it(`detects and removes a ${label}`, () => {
      const text = `before ${credential} after`;
      assert.equal(hasLeak(text), true);
      const cleaned = sanitizeText(text, 10_000);
      assert.ok(!cleaned.includes(credential));
      assert.equal(hasLeak(cleaned), false);
      assert.ok(!scrubSecrets(text, []).includes(credential));
    });
  }

  it('is idempotent across repeated sanitising passes', () => {
    const once = sanitizeText(`${planted} <!here> @user & <b>`, 10_000);
    assert.equal(sanitizeText(once, 10_000), once);
  });

  it('truncates to the cap and sanitises nested values', () => {
    assert.ok(sanitizeText('x'.repeat(500), 100).length <= 100);
    const deep = sanitizeDeep({ list: [{ note: `mail ${PLANTED_EMAIL}` }], count: 3 });
    assert.ok(!JSON.stringify(deep).includes(PLANTED_EMAIL));
    assert.equal(deep.count, 3);
  });

  it('scrubs exact credential values that no pattern would catch', () => {
    assert.ok(!scrubSecrets('token sk-ant-oat-opaque-value leaked', ['sk-ant-oat-opaque-value']).includes('opaque-value'));
  });
});

describe('V0.6 init-message invariants', () => {
  it('accepts a conforming init message', () => {
    assert.deepEqual(checkInitMessage(validInit(), expectation), []);
  });

  const violations: [string, Partial<InitMessageView>][] = [
    ['a built-in Read tool', { tools: ['mcp__review__get_diff', 'Read'] }],
    ['an extra MCP server', { mcp_servers: [{ name: 'review', status: 'connected' }, { name: 'other', status: 'connected' }] }],
    ['a disconnected server', { mcp_servers: [{ name: 'review', status: 'failed' }] }],
    ['a plugin', { plugins: [{ name: 'p' }] }],
    ['a skill', { skills: ['s'] }],
    ['a subagent', { agents: ['a'] }],
    ['permissionMode default', { permissionMode: 'default' }],
    ['an API-key credential in subscription mode', { apiKeySource: 'ANTHROPIC_API_KEY' }],
  ];
  for (const [label, override] of violations) {
    it(`reports exactly one violation for ${label}`, () => {
      assert.equal(checkInitMessage(validInit(override), expectation).length, 1);
    });
  }

  it('names the unexpected plugins, skills and agents without exposing plugin paths', () => {
    const found = checkInitMessage(
      validInit({
        plugins: [{ name: 'p', path: '/home/runner/p' } as { name: string }],
        skills: ['s1', 's2'],
        agents: ['claude', 'a'],
      }),
      expectation,
    );
    assert.deepEqual(found, [
      'plugins must be empty, got [p]',
      'skills must be empty, got [s1, s2]',
      'unexpected agents: [a]',
    ]);
  });

  it('accepts the built-in agents that no isolation switch removes', () => {
    assert.deepEqual(checkInitMessage(validInit({ agents: [...BUILTIN_AGENT_ALLOWLIST] }), expectation), []);
  });

  it('never allowlists the Agent tool, which is what keeps the allowlisted agents unreachable', () => {
    for (const name of ['Agent', 'Task']) assert.ok(!EXTRA_ALLOWED_TOOLS.includes(name), `${name} must stay denied`);
  });

  it('reports malformed init arrays as invariant violations instead of throwing', () => {
    const malformed: Record<string, unknown>[] = [
      { tools: undefined },
      { mcp_servers: null },
      { plugins: 'none' },
      { skills: undefined },
    ];
    for (const override of malformed) {
      const message = initMessage(override as Partial<InitMessageView>);
      let processed: ReturnType<typeof processMessage> | undefined;
      assert.doesNotThrow(() => {
        processed = processMessage(createStreamState(), message, ctx);
      });
      assert.equal(processed?.abort, 'invariant-violation');
      assert.ok(processed?.state.errors.some((entry) => entry.includes('must be an array')));
    }
  });

  it('permits explicitly allowlisted extra tools and expects ANTHROPIC_API_KEY in api-key mode', () => {
    const extra = { ...expectation, extraAllowedTools: ['StructuredOutput'] };
    assert.deepEqual(checkInitMessage(validInit({ tools: ['StructuredOutput'] }), extra), []);
    const apiKeyMode = { ...expectation, authMode: 'api-key' as const };
    assert.deepEqual(checkInitMessage(validInit({ apiKeySource: 'ANTHROPIC_API_KEY' }), apiKeyMode), []);
    assert.equal(checkInitMessage(validInit(), apiKeyMode).length, 1);
  });

  it('turns a violating init message into an invariant-violation abort', () => {
    const processed = processMessage(createStreamState(), initMessage({ tools: ['Bash'] }), ctx);
    assert.equal(processed.abort, 'invariant-violation');
  });
});

describe('V0.7 agent environment hygiene', () => {
  const parentEnv: NodeJS.ProcessEnv = {
    PATH: '/usr/bin',
    HOME: '/home/runner',
    LANG: 'en_US.UTF-8',
    ANTHROPIC_API_KEY: 'api-key-secret',
    ANTHROPIC_AUTH_TOKEN: 'bearer-value-secret',
    ANTHROPIC_BASE_URL: 'https://proxy.example.test',
    CLAUDE_CODE_USE_BEDROCK: '1',
    GITHUB_TOKEN: 'github-token-secret',
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/secret',
    GRA_TEST_PASSWORD: 'gra-password-secret',
    CLAUDE_CODE_OAUTH_TOKEN: 'oauth-credential-value',
    NODE_OPTIONS: '--require ./evil.js',
    HTTPS_PROXY: 'http://proxy.example.test',
    FOO_TOKEN: 'foo-token-secret',
    Path: 'C:\\bin',
    SystemRoot: 'C:\\Windows',
  };
  const FORBIDDEN_VARS = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_USE_BEDROCK',
    'GITHUB_TOKEN',
    'SLACK_WEBHOOK_URL',
    'GRA_TEST_PASSWORD',
  ];

  it('passes exactly the subscription token and drops every other credential', () => {
    const env = buildAgentEnv('subscription-oauth', '/tmp/cfg', parentEnv);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'oauth-credential-value');
    assert.equal(env.CLAUDE_CONFIG_DIR, '/tmp/cfg');
    assert.equal(env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB, '0');
    assert.equal(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
    assert.equal(env.ENABLE_CLAUDEAI_MCP_SERVERS, 'false');
    assert.equal(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, '1');
    assert.equal(env.CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS, '1');
    assert.equal(env.PATH, '/usr/bin');
    const fixedKeys = [
      'CLAUDE_CONFIG_DIR',
      'CLAUDE_CODE_DISABLE_AUTO_MEMORY',
      'ENABLE_CLAUDEAI_MCP_SERVERS',
      'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
      'CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS',
      'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB',
      'CLAUDE_CODE_OAUTH_TOKEN',
    ];
    const passthroughKeys = ['PATH', 'HOME', 'LANG'];
    const windowsKeys = process.platform === 'win32' ? ['Path', 'SystemRoot'] : [];
    assert.deepEqual(Object.keys(env).sort(), [...fixedKeys, ...passthroughKeys, ...windowsKeys].sort());
    for (const name of [...FORBIDDEN_VARS, 'NODE_OPTIONS', 'HTTPS_PROXY', 'FOO_TOKEN']) {
      assert.ok(!(name in env), `${name} must not be passed`);
    }
    const serialised = JSON.stringify(env);
    for (const secret of ['api-key-secret', 'github-token-secret', 'gra-password-secret', 'bearer-value-secret']) {
      assert.ok(!serialised.includes(secret));
    }
  });

  it('passes exactly the API key in api-key mode', () => {
    const env = buildAgentEnv('api-key', '/tmp/cfg', parentEnv);
    assert.equal(env.ANTHROPIC_API_KEY, 'api-key-secret');
    assert.ok(!('CLAUDE_CODE_OAUTH_TOKEN' in env));
  });

  it('throws without echoing secrets when the credential is missing', () => {
    const { CLAUDE_CODE_OAUTH_TOKEN: _omitted, ...withoutToken } = parentEnv;
    assert.throws(
      () => buildAgentEnv('subscription-oauth', '/tmp/cfg', withoutToken),
      (error: Error) => /CLAUDE_CODE_OAUTH_TOKEN/.test(error.message) && !error.message.includes('secret'),
    );
    assert.throws(() => buildAgentEnv('api-key', '/tmp/cfg', { ...withoutToken, ANTHROPIC_API_KEY: '' }));
  });

  it('parses the auth mode strictly', () => {
    assert.equal(parseAuthMode(undefined), 'subscription-oauth');
    assert.equal(parseAuthMode('api-key'), 'api-key');
    assert.throws(() => parseAuthMode('bearer'));
  });
});

describe('V0.8 run-time message handling', () => {
  it('aborts with usage-exhausted on a rejected rate-limit event', () => {
    const processed = processMessage(
      createStreamState(),
      rateLimitMessage({ status: 'rejected', errorCode: 'credits_required', rateLimitType: 'five_hour' }),
      ctx,
    );
    assert.equal(processed.abort, 'usage-exhausted');
    assert.equal(processed.state.rateLimit?.errorCode, 'credits_required');
  });

  it('does not abort on an allowed_warning event', () => {
    const processed = processMessage(createStreamState(), rateLimitMessage({ status: 'allowed_warning' }), ctx);
    assert.equal(processed.abort, undefined);
  });

  it('calls abort once, stops reading, and never trusts a later result', async () => {
    const abort = mock.fn();
    let yielded = 0;
    async function* counted(): AsyncGenerator<SDKMessage, void> {
      for (const message of [initMessage(), rateLimitMessage({ status: 'rejected' }), resultMessage()]) {
        yielded += 1;
        yield message;
      }
    }
    const consumed = await consumeStream(counted(), ctx, abort);
    assert.equal(abort.mock.callCount(), 1);
    assert.equal(consumed.abortOutcome, 'usage-exhausted');
    assert.equal(consumed.state.result, undefined);
    assert.equal(yielded, 2);

    const report = buildReport(testSpec, reportInputs(consumed));
    assert.equal(report.outcome, 'usage-exhausted');
    assert.equal(report.output, undefined);
  });

  it('aborts with auth-failed on authentication and org errors', () => {
    for (const error of ['authentication_failed', 'oauth_org_not_allowed']) {
      const processed = processMessage(createStreamState(), asMessage({ type: 'assistant', error, message: {} }), ctx);
      assert.equal(processed.abort, 'auth-failed');
    }
    const transient = processMessage(createStreamState(), asMessage({ type: 'assistant', error: 'overloaded', message: {} }), ctx);
    assert.equal(transient.abort, undefined);
  });

  it('keeps the captured result when the stream throws after an error result', async () => {
    const stream = streamOf(
      [initMessage(), resultMessage({ subtype: 'error_max_turns', is_error: true, errors: ['turn cap'], total_cost_usd: 0.4 })],
      new Error('process exited with code 1'),
    );
    const consumed = await consumeStream(stream, ctx, () => undefined);
    const report = buildReport(testSpec, reportInputs(consumed));
    assert.equal(report.outcome, 'agent-error');
    assert.equal(report.resultSubtype, 'error_max_turns');
    assert.equal(report.costUsdEstimate, 0.4);
    assert.ok(report.errors.some((entry) => entry.includes('process exited with code 1')));
  });

  it('builds a success report with sanitised output and captured usage', async () => {
    const stream = streamOf([initMessage(), resultMessage({ structured_output: { summary: 'ping @bob' } })]);
    const report = buildReport(testSpec, reportInputs(await consumeStream(stream, ctx, () => undefined)));
    assert.equal(report.outcome, 'success');
    assert.equal(report.output?.summary, `ping @${ZERO_WIDTH_SPACE}bob`);
    assert.equal(report.apiKeySource, 'none');
    assert.equal(report.numTurns, 2);
    assert.equal(report.modelUsage.sonnet.outputTokens, 20);
  });

  it('scrubs an exact credential value from a thrown error and the stderr tail', async () => {
    const consumed: ConsumeResult = { state: createStreamState(), thrown: `spawn failed with ${OPAQUE_CREDENTIAL}` };
    const report = buildReport(testSpec, {
      ...reportInputs(consumed),
      thrown: `wrapper threw ${OPAQUE_CREDENTIAL}`,
      stderrTail: `debug ${OPAQUE_CREDENTIAL}`,
      secrets: [OPAQUE_CREDENTIAL],
    });
    assert.equal(report.outcome, 'agent-error');
    assert.ok(!JSON.stringify(report).includes(OPAQUE_CREDENTIAL));
    assert.ok(report.errors.some((entry) => entry.startsWith('stderr tail:')));
    assert.ok(report.errors.some((entry) => entry.includes('[REDACTED-SECRET]')));
  });

  it('scrubs an exact credential value from the model output', async () => {
    const stream = streamOf([initMessage(), resultMessage({ structured_output: { summary: `value ${OPAQUE_CREDENTIAL}` } })]);
    const consumed = await consumeStream(stream, ctx, () => undefined);
    const report = buildReport(testSpec, { ...reportInputs(consumed), secrets: [OPAQUE_CREDENTIAL] });
    assert.equal(report.outcome, 'success');
    assert.ok(!JSON.stringify(report).includes(OPAQUE_CREDENTIAL));
  });

  it('aborts the query when the stream throws', async () => {
    const abort = mock.fn();
    const consumed = await consumeStream(streamOf([initMessage()], new Error('boom')), ctx, abort);
    assert.equal(abort.mock.callCount(), 1);
    assert.equal(consumed.thrown, 'boom');
  });

  it('downgrades a schema-invalid structured output to agent-error', async () => {
    const stream = streamOf([initMessage(), resultMessage({ structured_output: { wrong: true } })]);
    const report = buildReport(testSpec, reportInputs(await consumeStream(stream, ctx, () => undefined)));
    assert.equal(report.outcome, 'agent-error');
    assert.equal(report.output, undefined);
  });

  it('derives outcomes in priority order', () => {
    const base = { state: createStreamState(), timedOut: false, threw: false, managedSettingsViolations: [] };
    assert.equal(deriveOutcome({ ...base, timedOut: true }), 'timeout');
    assert.equal(deriveOutcome(base), 'invariant-violation');
    assert.equal(deriveOutcome({ ...base, threw: true }), 'agent-error');
    assert.equal(deriveOutcome({ ...base, state: { ...base.state, initChecked: true }, managedSettingsViolations: ['hooks'] }), 'invariant-violation');
    assert.equal(deriveOutcome({ ...base, abortOutcome: 'auth-failed', timedOut: true }), 'auth-failed');
  });
});

describe('query options and stderr handling', () => {
  const server = { type: 'sdk', name: 'review', instance: {} } as unknown as Parameters<typeof buildQueryOptions>[1];
  const run = { workDir: '/tmp/work', env: {}, abortController: new AbortController(), onStderr: () => undefined };

  it('sends prompts verbatim so file mentions and slash commands are never expanded', () => {
    assert.equal(buildQueryOptions(testSpec, server, run).verbatimPrompts, true);
  });

  it('keeps the built-in tool set empty and derives allowedTools from one constant', () => {
    const options = buildQueryOptions(testSpec, server, run);
    assert.deepEqual(options.tools, []);
    assert.deepEqual(options.allowedTools, ['mcp__review__*', ...EXTRA_ALLOWED_TOOLS]);
    assert.equal(options.settingSources?.length, 0);
    assert.equal(options.strictMcpConfig, true);
    assert.equal(options.permissionMode, 'dontAsk');
  });

  it('switches off the bundled skills and built-in plugins that settingSources: [] leaves loaded', () => {
    assert.deepEqual(buildQueryOptions(testSpec, server, run).settings, {
      disableBundledSkills: true,
      skillOverrides: { doctor: 'off' },
      enabledPlugins: { 'agents-md@builtin': false, 'plugin-authoring@builtin': false },
    });
  });

  it('records denied tool names but never their inputs', () => {
    const denied = resultMessage({
      permission_denials: [{ tool_name: 'Read', tool_use_id: 'toolu_1', tool_input: { file_path: 'secret-input' } }],
    });
    const { state } = processMessage(createStreamState(), denied, ctx);
    assert.deepEqual(state.errors, ['permission denied: Read']);
    assert.equal(state.result?.permissionDenials, 1);
  });

  it('records the name of every tool call the model makes but never its input', () => {
    const turn = asMessage({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'checking' },
          { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'secret-input' } },
          { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_fetch', input: { url: 'secret-input' } },
          { type: 'mcp_tool_use', id: 'mcptoolu_1', name: 'mcp__review__read_file', server_name: 'review', input: {} },
        ],
      },
    });
    const { state } = processMessage(createStreamState(), turn, ctx);
    assert.deepEqual(state.toolUseNames, ['Bash', 'web_fetch', 'mcp__review__read_file']);
    assert.ok(!JSON.stringify(state).includes('secret-input'));
  });

  it('reports each called tool once and scrubs the names like every other field', async () => {
    const call = (name: string): SDKMessage =>
      asMessage({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name, input: {} }] } });
    const stream = streamOf([
      initMessage(),
      call('mcp__review__read_file'),
      call('mcp__review__read_file'),
      call(`x${OPAQUE_CREDENTIAL}`),
      resultMessage(),
    ]);
    const consumed = await consumeStream(stream, ctx, () => undefined);
    const report = buildReport(testSpec, { ...reportInputs(consumed), secrets: [OPAQUE_CREDENTIAL] });
    assert.equal(report.toolUseNames.length, 2);
    assert.equal(report.toolUseNames[0], 'mcp__review__read_file');
    assert.ok(!JSON.stringify(report.toolUseNames).includes(OPAQUE_CREDENTIAL));
  });

  it('emits the output schema as draft-07, the only meta-schema the CLI validator resolves', () => {
    const format = buildQueryOptions(testSpec, server, run).outputFormat;
    assert.equal(format?.schema.$schema, 'http://json-schema.org/draft-07/schema#');
  });

  it('scrubs a credential split across two stderr chunks before slicing', () => {
    const half = Math.floor(OPAQUE_CREDENTIAL.length / 2);
    let tail = appendStderr('', `log ${OPAQUE_CREDENTIAL.slice(0, half)}`, [OPAQUE_CREDENTIAL]);
    tail = appendStderr(tail, `${OPAQUE_CREDENTIAL.slice(half)} more`, [OPAQUE_CREDENTIAL]);
    assert.ok(!tail.includes(OPAQUE_CREDENTIAL));
    assert.ok(tail.includes('[REDACTED-SECRET]'));
  });

  it('scrubs a secret before slicing so a cut through it leaves no fragment', () => {
    const tail = 'x'.repeat(MAX_STDERR_TAIL_CHARS - 3);
    const chunk = `${OPAQUE_CREDENTIAL}${'y'.repeat(MAX_STDERR_TAIL_CHARS - 8)}`;
    const result = appendStderr(tail, chunk, [OPAQUE_CREDENTIAL]);
    assert.ok(!result.includes(OPAQUE_CREDENTIAL.slice(-8)));
    assert.equal(result.length, MAX_STDERR_TAIL_CHARS);
  });

  it('keeps only the capped tail', () => {
    const tail = appendStderr('', 'x'.repeat(MAX_STDERR_TAIL_CHARS * 2), []);
    assert.equal(tail.length, MAX_STDERR_TAIL_CHARS);
  });
});

describe('entry-point detection', () => {
  let dir: string;

  before(async () => {
    dir = await makeTempDir('harness-entry-');
  });

  after(async () => {
    await removeTempDir(dir);
  });

  it('matches the same file and rejects others or a missing argv', async () => {
    const file = join(dir, 'real.ts');
    await writeFile(file, '');
    const url = pathToFileURL(file).href;
    assert.equal(isEntryPoint(url, file), true);
    assert.equal(isEntryPoint(url, join(dir, 'other.ts')), false);
    assert.equal(isEntryPoint(url, undefined), false);
  });

  it('matches when argv[1] reaches the file through a symlinked directory', async () => {
    const realDir = join(dir, 'real-dir');
    mkdirSync(realDir);
    const file = join(realDir, 'cli.ts');
    await writeFile(file, '');
    const link = join(dir, 'link-dir');
    symlinkSync(realDir, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(isEntryPoint(pathToFileURL(file).href, join(link, 'cli.ts')), true);
  });
});

describe('managed settings monitoring', () => {
  let dir: string;

  before(async () => {
    dir = await makeTempDir('harness-config-');
  });

  after(async () => {
    await removeTempDir(dir);
  });

  it('returns no keys when the file is absent or empty', async () => {
    assert.deepEqual(await readManagedSettingsKeys(dir), []);
    await writeFile(join(dir, SETTINGS_FILE), '{}');
    assert.deepEqual(await readManagedSettingsKeys(dir), []);
    assert.deepEqual(findManagedSettingsViolations([]), []);
  });

  it('flags any delivered key while the allowlist is empty', async () => {
    await writeFile(join(dir, SETTINGS_FILE), '{"hooks":{}}');
    const keys = await readManagedSettingsKeys(dir);
    assert.deepEqual(keys, ['hooks']);
    assert.deepEqual(findManagedSettingsViolations(keys), ['hooks']);
  });

  it('fails closed with the unreadable sentinel on a read error other than ENOENT', async () => {
    const dirAsFile = await makeTempDir('harness-config-dir-');
    try {
      await mkdir(join(dirAsFile, SETTINGS_FILE));
      const keys = await readManagedSettingsKeys(dirAsFile);
      assert.deepEqual(keys, [UNREADABLE_SETTINGS_KEY]);
      assert.deepEqual(findManagedSettingsViolations(keys), [UNREADABLE_SETTINGS_KEY]);
    } finally {
      await removeTempDir(dirAsFile);
    }
  });

  it('treats unparseable content as a violation', async () => {
    await writeFile(join(dir, SETTINGS_FILE), '[1]');
    assert.equal(findManagedSettingsViolations(await readManagedSettingsKeys(dir)).length, 1);
  });
});

describe('delivery gate', () => {
  interface Summary {
    summary: string;
  }
  const schema = z.object({ summary: z.string() });
  const registry: DeliveryRegistry = {
    fake: { schema, render: (output) => ({ title: 'Fake agent', body: codeSpan((output as Summary).summary) }) },
    leaky: { schema, render: () => ({ title: 'Leaky renderer', body: `token ${PLANTED_JWT}` }) },
  };
  const env = { GITHUB_TOKEN: 'gh-test-token', REPO: 'owner/repo', SHA: 'abcdef1234567' };
  const slackEnv = { SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/x' };
  let dir: string;

  function report(overrides: Partial<AgentRunReport<unknown>> = {}): AgentRunReport<unknown> {
    return {
      agent: 'fake',
      outcome: 'success',
      output: { summary: `mail ${PLANTED_EMAIL}` },
      costUsdEstimate: 0,
      numTurns: 1,
      modelUsage: {},
      permissionDenials: 0,
      toolUseNames: [],
      managedSettingsKeys: [],
      durationMs: 1,
      errors: [],
      ...overrides,
    };
  }

  function deliveryArgs(reportPath: string, agent: string, target: string): string[] {
    return ['--report', reportPath, '--agent', agent, '--target', target];
  }

  async function reportFile(content: AgentRunReport<unknown>): Promise<string> {
    const path = join(dir, `report-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(path, JSON.stringify(content));
    return path;
  }

  function makeFetch(status = 201): { fetchImpl: FetchLike; calls: () => number; lastBody: () => string } {
    let body = '';
    const spy = mock.fn<FetchLike>(async (_url, init) => {
      body = String(init.body);
      return { ok: status < 400, status };
    });
    return { fetchImpl: spy, calls: () => spy.mock.callCount(), lastBody: () => body };
  }

  before(async () => {
    dir = await makeTempDir('harness-deliver-');
    mock.method(console, 'error', () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    await removeTempDir(dir);
  });

  it('posts a validated, sanitised report', async () => {
    const http = makeFetch();
    const path = await reportFile(report());
    const code = await runDelivery(deliveryArgs(path, 'fake', 'github-issue'), env, registry, http.fetchImpl);
    assert.equal(code, 0);
    assert.equal(http.calls(), 1);
    assert.ok(!http.lastBody().includes(PLANTED_EMAIL));
  });

  it('exits 1 before any network call when the rendered text leaks', async () => {
    const http = makeFetch();
    const path = await reportFile(report({ agent: 'leaky' }));
    const code = await runDelivery(deliveryArgs(path, 'leaky', 'github-issue'), env, registry, http.fetchImpl);
    assert.equal(code, 1);
    assert.equal(http.calls(), 0);
    const prepared = prepareDelivery(registry, 'leaky', 'slack', report({ agent: 'leaky' }));
    assert.deepEqual(prepared, { ok: false, reason: 'leak detected in rendered message' });
  });

  it('does not resolve inherited object keys as agents and rejects a mismatched report agent', async () => {
    const http = makeFetch();
    const path = await reportFile(report({ agent: 'constructor' }));
    assert.equal(await runDelivery(deliveryArgs(path, 'constructor', 'github-issue'), env, registry, http.fetchImpl), 1);
    const prepared = prepareDelivery(registry, 'constructor', 'github-issue', report({ agent: 'constructor' }));
    assert.deepEqual(prepared, { ok: false, reason: 'unknown agent: constructor' });
    const mismatch = prepareDelivery(registry, 'fake', 'github-issue', report({ agent: 'leaky' }));
    assert.equal(mismatch.ok, false);
    assert.equal(http.calls(), 0);
  });

  it('escapes Slack control sequences in the Slack payload only', async () => {
    const hostile = '<!channel> <!here> <@U123> a & b';
    const slack = makeFetch();
    const path = await reportFile(report({ output: { summary: hostile } }));
    assert.equal(await runDelivery(deliveryArgs(path, 'fake', 'slack'), slackEnv, registry, slack.fetchImpl), 0);
    const text = (JSON.parse(slack.lastBody()) as { text: string }).text;
    for (const raw of ['<!channel>', '<!here>', '<@U123>']) assert.ok(!text.includes(raw), `${raw} must be escaped`);
    assert.ok(text.includes('&lt;!channel&gt;'));
    assert.ok(text.includes(`&lt;@${ZERO_WIDTH_SPACE}U123&gt;`));
    assert.ok(text.includes('a &amp; b'));

    const github = makeFetch();
    assert.equal(await runDelivery(deliveryArgs(path, 'fake', 'github-issue'), env, registry, github.fetchImpl), 0);
    const body = (JSON.parse(github.lastBody()) as { body: string }).body;
    assert.ok(!body.includes('&lt;') && !body.includes('&amp;'));
    assert.ok(body.includes('a & b'));
  });

  it('delivers nothing for a run that did not succeed', async () => {
    const http = makeFetch();
    const path = await reportFile(report({ outcome: 'usage-exhausted', output: undefined }));
    const code = await runDelivery(deliveryArgs(path, 'fake', 'slack'), slackEnv, registry, http.fetchImpl);
    assert.equal(code, 1);
    assert.equal(http.calls(), 0);
  });

  it('rejects output that fails the agent schema', async () => {
    const http = makeFetch();
    const path = await reportFile(report({ output: { wrong: true } }));
    assert.equal(await runDelivery(deliveryArgs(path, 'fake', 'github-issue'), env, registry, http.fetchImpl), 1);
    assert.equal(http.calls(), 0);
  });

  it('rejects an agent that is not registered', async () => {
    const http = makeFetch();
    const path = await reportFile(report());
    const code = await runDelivery(deliveryArgs(path, 'fake', 'github-issue'), env, AGENT_DELIVERY_REGISTRY, http.fetchImpl);
    assert.equal(code, 1);
    assert.equal(http.calls(), 0);
  });

  it('rejects bad configuration before any network call', async () => {
    const http = makeFetch();
    const path = await reportFile(report());
    const github = deliveryArgs(path, 'fake', 'github-commit-comment');
    const slack = deliveryArgs(path, 'fake', 'slack');
    assert.equal(await runDelivery(github, { ...env, GITHUB_TOKEN: '' }, registry, http.fetchImpl), 1);
    assert.equal(await runDelivery(github, { ...env, SHA: '--bad' }, registry, http.fetchImpl), 1);
    assert.equal(await runDelivery(slack, { SLACK_WEBHOOK_URL: 'https://evil.example.test/x' }, registry, http.fetchImpl), 1);
    assert.equal(await runDelivery(['--report', path, '--agent', 'fake'], env, registry, http.fetchImpl), 1);
    assert.equal(http.calls(), 0);
  });

  it('reports a failed HTTP delivery as exit 1', async () => {
    const http = makeFetch(500);
    const path = await reportFile(report());
    assert.equal(await runDelivery(deliveryArgs(path, 'fake', 'github-commit-comment'), env, registry, http.fetchImpl), 1);
    assert.equal(http.calls(), 1);
  });

  it('wraps evidence in a code span longer than any backtick run it contains', () => {
    assert.equal(codeSpan('plain'), '`plain`');
    assert.equal(codeSpan('a`b'), '``a`b``');
  });

  it('pads content that starts or ends with a backtick and collapses every line break to one space', () => {
    assert.equal(codeSpan('`a'), '`` `a ``');
    assert.equal(codeSpan('a`'), '`` a` ``');
    assert.equal(codeSpan('x\n\n\n  \ny'), '`x y`');
    assert.equal(codeSpan('x \t\r\n\t y'), '`x y`');
  });

  it('keeps multi-line input inside the span so no line can start markdown', () => {
    const span = codeSpan('a\n# H\n```');
    assert.equal(span, '```` a # H ``` ````');
    assert.ok(!span.includes('\n'));
  });
});
