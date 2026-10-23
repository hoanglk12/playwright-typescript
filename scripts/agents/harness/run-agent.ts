import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSdkMcpServer, query } from '@anthropic-ai/claude-agent-sdk';
import type { Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { buildAgentEnv, credentialVarFor } from './env.ts';
import { checkInitMessage } from './invariants.ts';
import {
  AGENT_WALL_CLOCK_MS,
  BUILTIN_AGENT_ALLOWLIST,
  EXTRA_ALLOWED_TOOLS,
  MANAGED_SETTINGS_KEY_ALLOWLIST,
  MAX_OUTPUT_FIELD_CHARS,
  MAX_STDERR_TAIL_CHARS,
  TEMP_DIR_RM_MAX_RETRIES,
} from './limits.ts';
import { sanitizeDeep, sanitizeText, scrubSecrets, scrubSecretsDeep } from './sanitize.ts';
import type {
  AgentRunReport,
  AgentSpec,
  AuthMode,
  ModelTokenUsage,
  RateLimitSummary,
  RunOutcome,
} from './types.ts';

const MCP_SERVER_VERSION = '1.0.0';
const REMOTE_SETTINGS_FILE = 'remote-settings.json';
const UNPARSEABLE_SETTINGS_KEY = '<unparseable>';
export const UNREADABLE_SETTINGS_KEY = '<unreadable>';
const FATAL_ASSISTANT_ERRORS: readonly string[] = ['authentication_failed', 'oauth_org_not_allowed'];
const TOOL_CALL_BLOCK_TYPES: readonly string[] = ['tool_use', 'server_tool_use', 'mcp_tool_use'];
// Built-ins that settingSources: [] leaves loaded (V1.1). Plugins can carry hooks, so they are switched off
// rather than allowlisted. Managed policy settings outrank these flag settings; the init check still catches that.
export const ISOLATION_SETTINGS = {
  disableBundledSkills: true,
  skillOverrides: { doctor: 'off' },
  enabledPlugins: { 'agents-md@builtin': false, 'plugin-authoring@builtin': false },
} satisfies Options['settings'];

export type AbortOutcome = Extract<RunOutcome, 'invariant-violation' | 'usage-exhausted' | 'auth-failed'>;

export interface ResultSnapshot {
  subtype: string;
  isError: boolean;
  structuredOutput?: unknown;
  costUsd: number;
  numTurns: number;
  modelUsage: Record<string, ModelTokenUsage>;
  permissionDenials: number;
  errors: string[];
}

export interface StreamState {
  initChecked: boolean;
  apiKeySource?: string;
  claudeCodeVersion?: string;
  resolvedModel?: string;
  rateLimit?: RateLimitSummary;
  errors: string[];
  toolUseNames: string[];
  result?: ResultSnapshot;
}

export interface ProcessContext {
  serverName: string;
  authMode: AuthMode;
  extraAllowedTools: readonly string[];
  allowedAgents: readonly string[];
}

export interface ProcessResult {
  state: StreamState;
  abort?: AbortOutcome;
}

export interface ConsumeResult {
  state: StreamState;
  abortOutcome?: AbortOutcome;
  thrown?: string;
}

export interface OutcomeInputs {
  state: StreamState;
  abortOutcome?: AbortOutcome;
  timedOut: boolean;
  threw: boolean;
  managedSettingsViolations: readonly string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createStreamState(): StreamState {
  return { initChecked: false, errors: [], toolUseNames: [] };
}

// Names only: a tool call's input can carry model output.
function toolCallNames(blocks: readonly { type: string; name?: unknown }[] | undefined): string[] {
  return (blocks ?? []).flatMap((block) =>
    TOOL_CALL_BLOCK_TYPES.includes(block.type) && typeof block.name === 'string' ? [block.name] : [],
  );
}

export function processMessage(state: StreamState, message: SDKMessage, ctx: ProcessContext): ProcessResult {
  if (message.type === 'system' && message.subtype === 'init') {
    const violations = checkInitMessage(message, ctx);
    const next: StreamState = {
      ...state,
      initChecked: true,
      apiKeySource: message.apiKeySource,
      claudeCodeVersion: message.claude_code_version,
      resolvedModel: message.model,
      errors: [...state.errors, ...violations],
    };
    return violations.length > 0 ? { state: next, abort: 'invariant-violation' } : { state: next };
  }

  if (message.type === 'rate_limit_event') {
    const info = message.rate_limit_info;
    const rateLimit: RateLimitSummary = {
      status: info.status,
      rateLimitType: info.rateLimitType,
      resetsAt: info.resetsAt,
      utilization: info.utilization,
      errorCode: info.errorCode,
    };
    const next: StreamState = { ...state, rateLimit };
    const exhausted = info.status === 'rejected' || info.errorCode === 'credits_required';
    return exhausted ? { state: next, abort: 'usage-exhausted' } : { state: next };
  }

  if (message.type === 'assistant') {
    const names = toolCallNames(message.message?.content);
    const called: StreamState = names.length > 0 ? { ...state, toolUseNames: [...state.toolUseNames, ...names] } : state;
    if (message.error === undefined) return { state: called };
    const next: StreamState = { ...called, errors: [...called.errors, `assistant error: ${message.error}`] };
    const fatal = FATAL_ASSISTANT_ERRORS.includes(message.error);
    return fatal ? { state: next, abort: 'auth-failed' } : { state: next };
  }

  if (message.type === 'result') {
    const modelUsage: Record<string, ModelTokenUsage> = {};
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      modelUsage[model] = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        costUSD: usage.costUSD,
      };
    }
    const result: ResultSnapshot = {
      subtype: message.subtype,
      isError: message.is_error,
      structuredOutput: message.subtype === 'success' ? message.structured_output : undefined,
      costUsd: message.total_cost_usd,
      numTurns: message.num_turns,
      modelUsage,
      permissionDenials: message.permission_denials.length,
      errors: message.subtype === 'success' ? [] : message.errors,
    };
    // Tool names only: tool_input can carry model output.
    const denials = message.permission_denials.map((denial) => `permission denied: ${denial.tool_name}`);
    return { state: { ...state, result, errors: [...state.errors, ...denials] } };
  }

  return { state };
}

export async function consumeStream(
  stream: AsyncIterable<SDKMessage>,
  ctx: ProcessContext,
  abort: () => void,
): Promise<ConsumeResult> {
  let state = createStreamState();
  let abortOutcome: AbortOutcome | undefined;
  try {
    for await (const message of stream) {
      const processed = processMessage(state, message, ctx);
      state = processed.state;
      if (processed.abort !== undefined) {
        abortOutcome = processed.abort;
        abort();
        break;
      }
    }
  } catch (error) {
    abort();
    // A single-shot query() throws after yielding its error result, so keep what was captured.
    return { state, abortOutcome, thrown: errorMessage(error) };
  }
  return { state, abortOutcome };
}

export function deriveOutcome(inputs: OutcomeInputs): RunOutcome {
  const { state, abortOutcome, timedOut, threw, managedSettingsViolations } = inputs;
  if (abortOutcome !== undefined) return abortOutcome;
  if (timedOut) return 'timeout';
  if (managedSettingsViolations.length > 0) return 'invariant-violation';
  if (!state.initChecked) return threw ? 'agent-error' : 'invariant-violation';
  if (state.result?.subtype === 'success' && !state.result.isError) return 'success';
  return 'agent-error';
}

export async function readManagedSettingsKeys(configDir: string): Promise<string[]> {
  let raw: string;
  try {
    raw = await readFile(join(configDir, REMOTE_SETTINGS_FILE), 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' ? [] : [UNREADABLE_SETTINGS_KEY];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [UNPARSEABLE_SETTINGS_KEY];
    }
    return Object.keys(parsed);
  } catch {
    return [UNPARSEABLE_SETTINGS_KEY];
  }
}

export function appendStderr(tail: string, chunk: string, secrets: readonly string[]): string {
  return scrubSecrets(tail + chunk, secrets).slice(-MAX_STDERR_TAIL_CHARS);
}

interface QueryRunContext {
  workDir: string;
  env: Record<string, string>;
  abortController: AbortController;
  onStderr: (data: string) => void;
}

export function buildQueryOptions(
  spec: AgentSpec<unknown>,
  server: ReturnType<typeof createSdkMcpServer>,
  run: QueryRunContext,
): Options {
  return {
    tools: [],
    mcpServers: { [spec.name]: server },
    allowedTools: [`mcp__${spec.name}__*`, ...EXTRA_ALLOWED_TOOLS],
    permissionMode: 'dontAsk',
    settingSources: [],
    settings: ISOLATION_SETTINGS,
    strictMcpConfig: true,
    persistSession: false,
    verbatimPrompts: true,
    systemPrompt: spec.systemPrompt,
    // The CLI's --json-schema validator only resolves the draft-07 meta-schema; zod 4 defaults to 2020-12.
    outputFormat: { type: 'json_schema', schema: z.toJSONSchema(spec.outputSchema, { target: 'draft-07' }) },
    maxTurns: spec.maxTurns,
    maxBudgetUsd: spec.maxBudgetUsd,
    model: spec.model,
    cwd: run.workDir,
    env: run.env,
    abortController: run.abortController,
    stderr: run.onStderr,
  };
}

async function removeDir(dir: string | undefined): Promise<void> {
  if (dir === undefined) return;
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: TEMP_DIR_RM_MAX_RETRIES });
  } catch {
    // Best effort: a locked temp dir must not fail the run or skip the other dir's cleanup.
  }
}

export function findManagedSettingsViolations(keys: readonly string[]): string[] {
  return keys.filter((key) => !MANAGED_SETTINGS_KEY_ALLOWLIST.includes(key));
}

interface ReportInputs {
  consumed: ConsumeResult;
  timedOut: boolean;
  thrown?: string;
  stderrTail: string;
  secrets: readonly string[];
  managedSettingsKeys: string[];
  durationMs: number;
}

export function buildReport<TOutput>(spec: AgentSpec<TOutput>, inputs: ReportInputs): AgentRunReport<TOutput> {
  const { consumed, secrets } = inputs;
  const { state } = consumed;
  const managedSettingsViolations = findManagedSettingsViolations(inputs.managedSettingsKeys);

  let outcome = deriveOutcome({
    state,
    abortOutcome: consumed.abortOutcome,
    timedOut: inputs.timedOut,
    threw: consumed.thrown !== undefined || inputs.thrown !== undefined,
    managedSettingsViolations,
  });

  const errors = [...state.errors, ...(state.result?.errors ?? [])];
  if (consumed.thrown !== undefined) errors.push(consumed.thrown);
  if (inputs.thrown !== undefined) errors.push(inputs.thrown);
  for (const key of managedSettingsViolations) errors.push(`unexpected managed settings key: ${key}`);

  let output: TOutput | undefined;
  if (outcome === 'success') {
    const parsed = spec.outputSchema.safeParse(state.result?.structuredOutput);
    if (parsed.success) {
      output = sanitizeDeep(scrubSecretsDeep(parsed.data, secrets));
    } else {
      outcome = 'agent-error';
      errors.push('structured output failed schema validation');
    }
  }
  if (outcome !== 'success' && inputs.stderrTail !== '') errors.push(`stderr tail: ${inputs.stderrTail}`);

  return {
    agent: spec.name,
    outcome,
    resultSubtype: state.result?.subtype,
    output,
    costUsdEstimate: state.result?.costUsd ?? 0,
    numTurns: state.result?.numTurns ?? 0,
    modelUsage: state.result?.modelUsage ?? {},
    permissionDenials: state.result?.permissionDenials ?? 0,
    toolUseNames: [...new Set(state.toolUseNames)].map((name) =>
      sanitizeText(scrubSecrets(name, secrets), MAX_OUTPUT_FIELD_CHARS),
    ),
    apiKeySource: state.apiKeySource,
    claudeCodeVersion: state.claudeCodeVersion,
    resolvedModel: state.resolvedModel,
    rateLimit: state.rateLimit,
    managedSettingsKeys: inputs.managedSettingsKeys,
    durationMs: inputs.durationMs,
    errors: errors.map((entry) => sanitizeText(scrubSecrets(entry, secrets), MAX_OUTPUT_FIELD_CHARS)),
  };
}

export async function runAgent<TOutput>(
  spec: AgentSpec<TOutput>,
  prompt: string,
  ctx: { authMode: AuthMode },
): Promise<AgentRunReport<TOutput>> {
  const startedAt = Date.now();
  const abortController = new AbortController();
  const processContext: ProcessContext = {
    serverName: spec.name,
    authMode: ctx.authMode,
    extraAllowedTools: EXTRA_ALLOWED_TOOLS,
    allowedAgents: BUILTIN_AGENT_ALLOWLIST,
  };

  let configDir: string | undefined;
  let workDir: string | undefined;
  let activeQuery: Query | undefined;
  let secrets: string[] = [];
  let consumed: ConsumeResult = { state: createStreamState() };
  let timedOut = false;
  let thrown: string | undefined;
  let stderrTail = '';
  let managedSettingsKeys: string[] = [];
  const timer = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, AGENT_WALL_CLOCK_MS);

  try {
    configDir = await mkdtemp(join(tmpdir(), 'agent-config-'));
    workDir = await mkdtemp(join(tmpdir(), 'agent-cwd-'));
    const env = buildAgentEnv(ctx.authMode, configDir);
    secrets = [env[credentialVarFor(ctx.authMode)]];

    const server = createSdkMcpServer({
      name: spec.name,
      version: MCP_SERVER_VERSION,
      tools: spec.tools,
      alwaysLoad: true,
    });

    activeQuery = query({
      prompt,
      options: buildQueryOptions(spec, server, {
        workDir,
        env,
        abortController,
        onStderr: (data: string) => {
          stderrTail = appendStderr(stderrTail, data, secrets);
        },
      }),
    });

    consumed = await consumeStream(activeQuery, processContext, () => abortController.abort());
  } catch (error) {
    if (!abortController.signal.aborted) {
      thrown = scrubSecrets(errorMessage(error), secrets);
    }
  } finally {
    clearTimeout(timer);
    try {
      activeQuery?.close();
    } catch {
      // The child may already be gone; nothing further to release.
    }
    if (configDir !== undefined) managedSettingsKeys = await readManagedSettingsKeys(configDir);
    await removeDir(configDir);
    await removeDir(workDir);
  }

  return buildReport(spec, {
    consumed,
    timedOut,
    thrown,
    stderrTail,
    secrets,
    managedSettingsKeys,
    durationMs: Date.now() - startedAt,
  });
}
