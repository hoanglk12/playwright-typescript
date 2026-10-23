import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { z } from 'zod';
import { renderConventionMarkdown } from '../convention-reviewer/render.ts';
import { ConventionReviewOutputSchema } from '../convention-reviewer/schema.ts';
import type { ConventionReviewOutput } from '../convention-reviewer/schema.ts';
import { isEntryPoint } from './entry-point.ts';
import { DELIVERY_HTTP_TIMEOUT_MS, MAX_RENDERED_CHARS } from './limits.ts';
import { hasLeak, sanitizeDeep } from './sanitize.ts';
import { SHA_PATTERN } from './tracked-files.ts';
import type { AgentRunReport } from './types.ts';

const GITHUB_API_BASE = 'https://api.github.com';
const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/';
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const SERVER_URL_PATTERN = /^https:\/\/[\w.-]+(:\d+)?$/;
const RUN_ID_PATTERN = /^\d+$/;
const SHORT_SHA_LENGTH = 7;

const DELIVERY_TARGETS = ['github-commit-comment', 'github-issue', 'slack'] as const;
export type DeliveryTarget = (typeof DELIVERY_TARGETS)[number];

export interface RenderedMessage {
  title: string;
  body: string;
}

export interface AgentDeliverySpec {
  schema: z.ZodType<unknown>;
  render: (output: unknown, target: DeliveryTarget) => RenderedMessage;
  isEmpty?: (output: unknown) => boolean;
}

export type DeliveryRegistry = Readonly<Record<string, AgentDeliverySpec>>;

export const AGENT_DELIVERY_REGISTRY: DeliveryRegistry = {
  review: {
    schema: ConventionReviewOutputSchema,
    render: (output, target) => renderConventionMarkdown(output as ConventionReviewOutput, target),
    isEmpty: (output) => (output as ConventionReviewOutput).findings.length === 0,
  },
};

export type PrepareResult = { ok: true; message: RenderedMessage; skipReason?: string } | { ok: false; reason: string };

export interface DeliveryRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;

function escapeForSlack(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isDeliveryTarget(value: string): value is DeliveryTarget {
  return DELIVERY_TARGETS.some((target) => target === value);
}

export function prepareDelivery(
  registry: DeliveryRegistry,
  agent: string,
  target: DeliveryTarget,
  report: AgentRunReport<unknown>,
): PrepareResult {
  if (!Object.hasOwn(registry, agent)) return { ok: false, reason: `unknown agent: ${agent}` };
  const spec = registry[agent];
  if (report.agent !== agent) return { ok: false, reason: `report agent ${report.agent} does not match ${agent}` };
  if (report.outcome !== 'success') return { ok: false, reason: `run outcome was ${report.outcome}` };

  const parsed = spec.schema.safeParse(report.output);
  if (!parsed.success) return { ok: false, reason: 'report output failed schema validation' };

  const data = sanitizeDeep(parsed.data);
  const rendered = spec.render(data, target);
  if (hasLeak(`${rendered.title}\n${rendered.body}`)) {
    return { ok: false, reason: 'leak detected in rendered message' };
  }
  const title = target === 'slack' ? escapeForSlack(rendered.title) : rendered.title;
  const body = target === 'slack' ? escapeForSlack(rendered.body) : rendered.body;
  return {
    ok: true,
    message: { title: title.slice(0, MAX_RENDERED_CHARS), body: body.slice(0, MAX_RENDERED_CHARS) },
    skipReason: spec.isEmpty?.(data) ? 'nothing to report' : undefined,
  };
}

function buildSlackHeader(env: Record<string, string | undefined>): string {
  const sha = env.SHA ?? '';
  const server = env.GITHUB_SERVER_URL ?? '';
  const repo = env.GITHUB_REPOSITORY ?? '';
  const runId = env.GITHUB_RUN_ID ?? '';
  if (!SHA_PATTERN.test(sha) || !SERVER_URL_PATTERN.test(server) || !REPO_PATTERN.test(repo) || !RUN_ID_PATTERN.test(runId)) {
    return '';
  }
  return `Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` - <${server}/${repo}/actions/runs/${runId}|workflow run>\n`;
}

export function buildRequest(
  target: DeliveryTarget,
  message: RenderedMessage,
  env: Record<string, string | undefined>,
): DeliveryRequest {
  if (target === 'slack') {
    const url = env.SLACK_WEBHOOK_URL ?? '';
    if (!url.startsWith(SLACK_WEBHOOK_PREFIX)) throw new Error('SLACK_WEBHOOK_URL is missing or invalid');
    return {
      url,
      headers: { 'content-type': 'application/json' },
      // Slack still auto-links a bare URL in model text; no unfurl keeps it from fetching a preview into the channel.
      body: JSON.stringify({
        text: `${buildSlackHeader(env)}*${message.title}*\n${message.body}`,
        unfurl_links: false,
        unfurl_media: false,
      }),
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

  if (target === 'github-issue') {
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

  const prepared = prepareDelivery(registry, agent, target, report);
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
    request = buildRequest(target, prepared.message, env);
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
