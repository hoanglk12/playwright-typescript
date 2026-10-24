import type { RenderedMessage } from '../harness/deliver.ts';
import { codeSpan, inert } from '../harness/markdown.ts';
import { slackPlain } from '../harness/slack.ts';
import type { SlackAttachment, SlackBlock, SlackContext, SlackMessage } from '../harness/slack.ts';
import {
  MAX_SLACK_PATH_CHARS,
  actionButtons,
  blobUrl,
  branchFieldText,
  commitFieldText,
  plural,
  section,
  slackLink,
} from '../harness/slack-blocks.ts';
import { MIRROR_PAIRS } from './pairs.ts';
import { PARITY_STATUSES, needsAction } from './schema.ts';
import type { MirrorParityOutput, PairVerdict, ParityStatus } from './schema.ts';

const MAX_SLACK_EXPLANATION_CHARS = 1000;
const MAX_SLACK_MISSING_CHANGE_CHARS = 800;

const SLACK_STATUS: Readonly<Record<ParityStatus, { label: string; color: string }>> = {
  'needs-mirror': { label: 'Needs mirror', color: '#E01E5A' },
  unclear: { label: 'Unclear', color: '#ECB22E' },
  'in-sync': { label: 'In sync', color: '#2EB67D' },
  'intentional-divergence': { label: 'Intentional divergence', color: '#1D9BD1' },
};

function sides(verdict: PairVerdict): { changed: string; counterpart: string } | undefined {
  const pair = MIRROR_PAIRS.find((entry) => entry.id === verdict.pair);
  if (pair === undefined) return undefined;
  return verdict.changedSide === 'source'
    ? { changed: pair.source, counterpart: pair.mirror }
    : { changed: pair.mirror, counterpart: pair.source };
}

function actionable(output: MirrorParityOutput): PairVerdict[] {
  return output.pairs.filter(needsAction);
}

function parityTitle(count: number): string {
  return `Mirror parity: action needed on ${plural(count, 'pair')}`;
}

function statusCounts(verdicts: readonly PairVerdict[]): string {
  return PARITY_STATUSES.map((status) => [status, verdicts.filter((verdict) => verdict.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
}

function renderVerdict(verdict: PairVerdict): string {
  const found = sides(verdict);
  const files = found === undefined ? '' : ` ${codeSpan(found.changed)} changed, ${codeSpan(found.counterpart)} not`;
  const lines = [`- \`${verdict.pair}\` ${verdict.status}:${files}`, `  - ${inert(verdict.explanation)}`];
  if (verdict.missingChange.trim() !== '') lines.push(`  - missing change: ${inert(verdict.missingChange)}`);
  return lines.join('\n');
}

export function renderParityMarkdown(output: MirrorParityOutput): RenderedMessage {
  const title = parityTitle(actionable(output).length);
  const body = output.pairs.length === 0 ? 'No pairs were checked.' : output.pairs.map(renderVerdict).join('\n');
  return { title, body: `${statusCounts(output.pairs)}\n\n${body}` };
}

function renderSlackVerdict(verdict: PairVerdict, context: SlackContext): SlackAttachment {
  const { label, color } = SLACK_STATUS[verdict.status];
  const found = sides(verdict);
  const blocks: SlackBlock[] = [];
  if (found === undefined) {
    blocks.push(section(`*${label}* · \`${slackPlain(verdict.pair, MAX_SLACK_PATH_CHARS)}\``));
  } else {
    const changed = slackLink(blobUrl(context, found.changed), slackPlain(found.changed, MAX_SLACK_PATH_CHARS));
    const counterpart = slackLink(blobUrl(context, found.counterpart), slackPlain(found.counterpart, MAX_SLACK_PATH_CHARS));
    blocks.push(section(`*${label}* · \`${verdict.pair}\`\nChanged: ${changed}\nNot changed: ${counterpart}`));
  }
  const lines: string[] = [];
  const explanation = slackPlain(verdict.explanation, MAX_SLACK_EXPLANATION_CHARS);
  if (explanation.trim() !== '') lines.push(explanation);
  const missing = slackPlain(verdict.missingChange, MAX_SLACK_MISSING_CHANGE_CHARS);
  if (missing.trim() !== '') lines.push(`*Missing change:* ${missing}`);
  // Slack auto-links bare URLs, which findSlackProblem never sees; verbatim stops that for the model's text.
  if (lines.length > 0) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n'), verbatim: true } });
  return { color, blocks };
}

export function renderParitySlack(output: MirrorParityOutput, context: SlackContext): SlackMessage {
  const toAct = actionable(output);
  const title = parityTitle(toAct.length);
  const fields: string[] = [];
  const commit = commitFieldText(context);
  if (commit !== undefined) fields.push(commit);
  const branch = branchFieldText(context);
  if (branch !== undefined) fields.push(branch);
  fields.push(`*Pairs needing action*\n${statusCounts(toAct) || 'none'}`);

  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: title } },
    { type: 'section', fields: fields.map((text) => ({ type: 'mrkdwn' as const, text })) },
  ];
  const others = output.pairs.length - toAct.length;
  if (others > 0) blocks.push(section(`${plural(others, 'other pair')} checked, no action needed.`));
  const buttons = actionButtons(context);
  if (buttons !== undefined) blocks.push(buttons);
  return { text: title, blocks, attachments: toAct.map((verdict) => renderSlackVerdict(verdict, context)) };
}
