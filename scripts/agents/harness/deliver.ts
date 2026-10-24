import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { z } from 'zod';
import { renderConventionMarkdown, renderConventionSlack } from '../convention-reviewer/render.ts';
import { ConventionReviewOutputSchema } from '../convention-reviewer/schema.ts';
import type { ConventionReviewOutput } from '../convention-reviewer/schema.ts';
import { renderParityMarkdown, renderParitySlack } from '../mirror-parity/render.ts';
import { MirrorParityOutputSchema, needsAction } from '../mirror-parity/schema.ts';
import type { MirrorParityOutput } from '../mirror-parity/schema.ts';
import { isEntryPoint } from './entry-point.ts';
import { DELIVERY_HTTP_TIMEOUT_MS, MAX_RENDERED_CHARS } from './limits.ts';
import { hasLeak, sanitizeDeep, sanitizeText } from './sanitize.ts';
import { findSlackProblem } from './slack.ts';
import type { SlackContext, SlackMessage } from './slack.ts';
import { SHA_PATTERN } from './tracked-files.ts';
import type { AgentRunReport } from './types.ts';

const GITHUB_API_BASE = 'https://api.github.com';
const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/';
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const SERVER_URL_PATTERN = /^https:\/\/[\w.-]+(:\d+)?$/;
const RUN_ID_PATTERN = /^\d+$/;
const BRANCH_PATTERN = /^[\w./-]{1,100}$/;
const MAX_REPO_URL_CHARS = 200;
const MAX_COMMIT_SUBJECT_CHARS = 200;

const DELIVERY_TARGETS = ['github-commit-comment', 'github-issue', 'slack'] as const;
export type DeliveryTarget = (typeof DELIVERY_TARGETS)[number];
export type GitHubTarget = Exclude<DeliveryTarget, 'slack'>;

export interface RenderedMessage {
  title: string;
  body: string;
}

export interface AgentDeliverySpec {
  schema: z.ZodType<unknown>;
  render: (output: unknown, target: GitHubTarget) => RenderedMessage;
  renderSlack: (output: unknown, context: SlackContext) => SlackMessage;
  isEmpty?: (output: unknown) => boolean;
}

export type DeliveryRegistry = Readonly<Record<string, AgentDeliverySpec>>;

export const AGENT_DELIVERY_REGISTRY: DeliveryRegistry = {
  review: {
    schema: ConventionReviewOutputSchema,
    render: (output) => renderConventionMarkdown(output as ConventionReviewOutput),
    renderSlack: (output, context) => renderConventionSlack(output as ConventionReviewOutput, context),
    isEmpty: (output) => (output as ConventionReviewOutput).findings.length === 0,
  },
  'mirror-parity': {
    schema: MirrorParityOutputSchema,
    render: (output) => renderParityMarkdown(output as MirrorParityOutput),
    renderSlack: (output, context) => renderParitySlack(output as MirrorParityOutput, context),
    isEmpty: (output) => !(output as MirrorParityOutput).pairs.some(needsAction),
  },
};

export type PreparedMessage = { target: 'slack'; slack: SlackMessage } | ({ target: GitHubTarget } & RenderedMessage);

export type PrepareResult = { ok: true; message: PreparedMessage; skipReason?: string } | { ok: false; reason: string };

export interface DeliveryRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;

function isDeliveryTarget(value: string): value is DeliveryTarget {
  return DELIVERY_TARGETS.some((target) => target === value);
}

// Only values that pass these patterns reach a link; any other value drops just the part that needs it.
export function buildSlackContext(env: Record<string, string | undefined>): SlackContext {
  const server = env.GITHUB_SERVER_URL ?? '';
  const repo = env.GITHUB_REPOSITORY ?? '';
  const sha = env.SHA ?? '';
  const runId = env.GITHUB_RUN_ID ?? '';
  const branch = env.GITHUB_REF_NAME ?? '';
  const subject = env.COMMIT_SUBJECT ?? '';
  const repoUrl = `${server}/${repo}`;
  const validRepoUrl = SERVER_URL_PATTERN.test(server) && REPO_PATTERN.test(repo) && repoUrl.length <= MAX_REPO_URL_CHARS;
  return {
    repoUrl: validRepoUrl ? repoUrl : undefined,
    sha: SHA_PATTERN.test(sha) ? sha : undefined,
    runUrl: validRepoUrl && RUN_ID_PATTERN.test(runId) ? `${repoUrl}/actions/runs/${runId}` : undefined,
    branch: BRANCH_PATTERN.test(branch) ? branch : undefined,
    subject: subject.trim() === '' ? undefined : sanitizeText(subject, MAX_COMMIT_SUBJECT_CHARS),
  };
}

export function prepareDelivery(
  registry: DeliveryRegistry,
  agent: string,
  target: DeliveryTarget,
  report: AgentRunReport<unknown>,
  slackContext: SlackContext = {},
): PrepareResult {
  if (!Object.hasOwn(registry, agent)) return { ok: false, reason: `unknown agent: ${agent}` };
  const spec = registry[agent];
  if (report.agent !== agent) return { ok: false, reason: `report agent ${report.agent} does not match ${agent}` };
  if (report.outcome !== 'success') return { ok: false, reason: `run outcome was ${report.outcome}` };

  const parsed = spec.schema.safeParse(report.output);
  if (!parsed.success) return { ok: false, reason: 'report output failed schema validation' };

  const data = sanitizeDeep(parsed.data);
  const skipReason = spec.isEmpty?.(data) ? 'nothing to report' : undefined;
  if (target === 'slack') {
    const slack = spec.renderSlack(data, slackContext);
    const problem = findSlackProblem(slack, slackContext.repoUrl);
    if (problem !== undefined) return { ok: false, reason: problem };
    return { ok: true, message: { target, slack }, skipReason };
  }

  const rendered = spec.render(data, target);
  if (hasLeak(`${rendered.title}\n${rendered.body}`)) {
    return { ok: false, reason: 'leak detected in rendered message' };
  }
  return {
    ok: true,
    message: { target, title: rendered.title.slice(0, MAX_RENDERED_CHARS), body: rendered.body.slice(0, MAX_RENDERED_CHARS) },
    skipReason,
  };
}

export function buildRequest(message: PreparedMessage, env: Record<string, string | undefined>): DeliveryRequest {
  if (message.target === 'slack') {
    const url = env.SLACK_WEBHOOK_URL ?? '';
    if (!url.startsWith(SLACK_WEBHOOK_PREFIX)) throw new Error('SLACK_WEBHOOK_URL is missing or invalid');
    return {
      url,
      headers: { 'content-type': 'application/json' },
      // Slack still auto-links a bare URL in model text; no unfurl keeps it from fetching a preview into the channel.
      body: JSON.stringify({ ...message.slack, unfurl_links: false, unfurl_media: false }),
    };
  }

  const token = env.GITHUB_TOKEN ?? '';
  const repo = env.REPO ?? '';
  if (token === '') throw new Error('GITHUB_TOKEN is required');
  if (!REPO_PATTERN.test(repo)) throw new Error('REPO must look like owner/name');
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
  };

  if (message.target === 'github-issue') {
    return {
      url: `${GITHUB_API_BASE}/repos/${repo}/issues`,
      headers,
      body: JSON.stringify({ title: message.title, body: message.body }),
    };
  }

  const sha = env.SHA ?? '';
  if (!SHA_PATTERN.test(sha)) throw new Error('SHA must be a hex commit id');
  return {
    url: `${GITHUB_API_BASE}/repos/${repo}/commits/${sha}/comments`,
    headers,
    body: JSON.stringify({ body: `**${message.title}**\n\n${message.body}` }),
  };
}

export async function runDelivery(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  registry: DeliveryRegistry,
  fetchImpl: FetchLike,
): Promise<number> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      report: { type: 'string' },
      agent: { type: 'string' },
      target: { type: 'string' },
    },
  });
  const { report: reportPath, agent, target } = values;
  if (reportPath === undefined || agent === undefined || target === undefined || !isDeliveryTarget(target)) {
    console.error(`usage: --report <file> --agent <name> --target ${DELIVERY_TARGETS.join('|')}`);
    return 1;
  }

  let report: AgentRunReport<unknown>;
  try {
    report = JSON.parse(await readFile(reportPath, 'utf8')) as AgentRunReport<unknown>;
  } catch {
    console.error('could not read report file');
    return 1;
  }

  const prepared = prepareDelivery(registry, agent, target, report, buildSlackContext(env));
  if (!prepared.ok) {
    console.error(`not delivered: ${prepared.reason}`);
    return 1;
  }

  if (prepared.skipReason !== undefined) {
    console.log(`not delivered: ${prepared.skipReason}`);
    return 0;
  }

  let request: DeliveryRequest;
  try {
    request = buildRequest(prepared.message, env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'invalid delivery configuration');
    return 1;
  }

  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(DELIVERY_HTTP_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.error(`delivery failed with HTTP ${response.status}`);
    return 1;
  }
  return 0;
}

if (isEntryPoint(import.meta.url, process.argv[1])) {
  process.exitCode = await runDelivery(process.argv.slice(2), process.env, AGENT_DELIVERY_REGISTRY, fetch);
}
