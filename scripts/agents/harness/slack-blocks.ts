import { slackPlain } from './slack.ts';
import type { SlackBlock, SlackButton, SlackContext } from './slack.ts';

const SHORT_SHA_LENGTH = 7;
// Escaped-length caps. With a link URL of at most MAX_SLACK_URL_CHARS, a section stays under Slack's
// 3000-character limit even when every character of the model's text needs an entity.
const MAX_SLACK_URL_CHARS = 800;
export const MAX_SLACK_PATH_CHARS = 300;
const MAX_SLACK_FIELD_CHARS = 300;

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function slackLink(url: string | undefined, label: string): string {
  return url === undefined || url.length > MAX_SLACK_URL_CHARS ? label : `<${url}|${label}>`;
}

export function section(text: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

export function blobUrl(context: SlackContext, file: string): string | undefined {
  const segments = file.split('/');
  if (context.repoUrl === undefined || context.sha === undefined) return undefined;
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return undefined;
  return `${context.repoUrl}/blob/${context.sha}/${segments.map(encodeURIComponent).join('/')}`;
}

export function commitUrl(context: SlackContext): string | undefined {
  return context.repoUrl !== undefined && context.sha !== undefined ? `${context.repoUrl}/commit/${context.sha}` : undefined;
}

export function commitFieldText(context: SlackContext): string | undefined {
  if (context.sha === undefined) return undefined;
  const shortSha = context.sha.slice(0, SHORT_SHA_LENGTH);
  const url = commitUrl(context);
  const commit = url === undefined ? `\`${shortSha}\`` : slackLink(url, shortSha);
  const subject = context.subject === undefined ? '' : ` ${slackPlain(context.subject, MAX_SLACK_FIELD_CHARS)}`;
  return `*Commit*\n${commit}${subject}`;
}

export function branchFieldText(context: SlackContext): string | undefined {
  return context.branch === undefined ? undefined : `*Branch*\n${slackPlain(context.branch, MAX_SLACK_FIELD_CHARS)}`;
}

export function actionButtons(context: SlackContext): SlackBlock | undefined {
  const buttons = [
    { text: 'View workflow run', url: context.runUrl },
    { text: 'View commit', url: commitUrl(context) },
  ].flatMap(({ text, url }): SlackButton[] =>
    url === undefined ? [] : [{ type: 'button', text: { type: 'plain_text', text }, url }],
  );
  return buttons.length > 0 ? { type: 'actions', elements: buttons } : undefined;
}
