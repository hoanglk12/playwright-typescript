import { hasLeak } from './sanitize.ts';

export interface SlackMrkdwn {
  type: 'mrkdwn';
  text: string;
  verbatim?: boolean;
}

export interface SlackPlainText {
  type: 'plain_text';
  text: string;
}

export interface SlackButton {
  type: 'button';
  text: SlackPlainText;
  url: string;
}

export type SlackBlock =
  | { type: 'header'; text: SlackPlainText }
  | { type: 'section'; text: SlackMrkdwn }
  | { type: 'section'; fields: SlackMrkdwn[] }
  | { type: 'actions'; elements: SlackButton[] }
  | { type: 'context'; elements: SlackMrkdwn[] };

export interface SlackAttachment {
  color: string;
  blocks: SlackBlock[];
}

export interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
  attachments: SlackAttachment[];
}

export interface SlackContext {
  repoUrl?: string;
  sha?: string;
  runUrl?: string;
  branch?: string;
  subject?: string;
}

const SLACK_LINK = /<([^<>|\s]+)\|([^<>]*)>/g;
const ELLIPSIS = '…';

export function escapeForSlack(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The cap applies after escaping, so text made of '&' cannot grow a block past Slack's per-field limits.
export function slackPlain(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, ' ').replace(/`/g, "'");
  const escaped = escapeForSlack(flat);
  if (escaped.length <= maxChars) return escaped;
  let kept = '';
  for (const char of flat) {
    const piece = escapeForSlack(char);
    if (kept.length + piece.length > maxChars - ELLIPSIS.length) break;
    kept += piece;
  }
  return kept + ELLIPSIS;
}

// The leak patterns match raw text: "&amp;token=" would slip past the URL-secret pattern that looks for "&token=".
function unescapeForSlack(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function isRepoLink(url: string, repoUrl: string | undefined): boolean {
  if (repoUrl === undefined || !url.startsWith(`${repoUrl}/`)) return false;
  // URL parsing resolves dot segments, so "blob/sha/../../../other/repo" cannot pass on its raw prefix alone.
  try {
    return new URL(url).href.startsWith(new URL(`${repoUrl}/`).href);
  } catch {
    return false;
  }
}

function mrkdwnTexts(block: SlackBlock): string[] {
  if (block.type === 'section') return 'fields' in block ? block.fields.map((field) => field.text) : [block.text.text];
  if (block.type === 'context') return block.elements.map((element) => element.text);
  return [];
}

function plainTexts(block: SlackBlock): string[] {
  if (block.type === 'header') return [block.text.text];
  if (block.type === 'actions') return block.elements.map((button) => button.text.text);
  return [];
}

export function findSlackProblem(message: SlackMessage, repoUrl: string | undefined): string | undefined {
  const blocks = [...message.blocks, ...message.attachments.flatMap((attachment) => attachment.blocks)];
  const visible = blocks.flatMap(plainTexts);
  const linkUrls = blocks.flatMap((block) => (block.type === 'actions' ? block.elements.map((button) => button.url) : []));
  for (const text of [message.text, ...blocks.flatMap(mrkdwnTexts)]) {
    const shown = text.replace(SLACK_LINK, (_link, url: string, label: string) => {
      linkUrls.push(url);
      return label;
    });
    if (/[<>]/.test(shown)) return 'unescaped Slack markup in rendered message';
    visible.push(shown);
  }
  if (!linkUrls.every((url) => isRepoLink(url, repoUrl))) return 'Slack link outside the repository';
  if (visible.some((text) => hasLeak(unescapeForSlack(text)))) return 'leak detected in rendered message';
  return undefined;
}
