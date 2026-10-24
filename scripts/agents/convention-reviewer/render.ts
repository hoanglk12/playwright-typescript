import type { RenderedMessage } from '../harness/deliver.ts';
import { codeSpan } from '../harness/markdown.ts';
import { slackPlain } from '../harness/slack.ts';
import type { SlackAttachment, SlackBlock, SlackContext, SlackMessage } from '../harness/slack.ts';
import type { ConventionFinding, ConventionReviewOutput, ConventionSeverity } from './schema.ts';

const SEVERITY_ORDER: readonly ConventionSeverity[] = ['critical', 'warning', 'suggestion'];

const MARKDOWN_ACTIVE = /[\\`*_[\]()<>!#|~]/g;

const SLACK_SEVERITY: Readonly<Record<ConventionSeverity, { label: string; color: string }>> = {
  critical: { label: 'Critical', color: '#E01E5A' },
  warning: { label: 'Warning', color: '#ECB22E' },
  suggestion: { label: 'Suggestion', color: '#1D9BD1' },
};

const SHORT_SHA_LENGTH = 7;
// Escaped-length caps. With a link URL of at most MAX_SLACK_URL_CHARS, a finding's section stays under Slack's
// 3000-character limit even when every character of the model's text needs an entity.
const MAX_SLACK_URL_CHARS = 800;
const MAX_SLACK_PATH_CHARS = 300;
const MAX_SLACK_SUGGESTION_CHARS = 1000;
const MAX_SLACK_EVIDENCE_CHARS = 700;
const MAX_SLACK_SUMMARY_CHARS = 2900;
const MAX_SLACK_FIELD_CHARS = 300;

function flatten(text: string): string {
  return text.replace(/\s+/g, ' ');
}

export function inert(text: string): string {
  return flatten(text).replace(MARKDOWN_ACTIVE, '\\$&');
}

function renderFinding(finding: ConventionFinding): string {
  const location = codeSpan(flatten(`${finding.file}:${finding.line}`));
  const evidence = codeSpan(flatten(finding.evidence));
  return `- ${location} \`${finding.rule}\`: ${inert(finding.suggestion)}\n  - evidence: ${evidence}`;
}

function reviewTitle(count: number): string {
  return `Convention review: ${count} finding${count === 1 ? '' : 's'}`;
}

export function renderConventionMarkdown(output: ConventionReviewOutput): RenderedMessage {
  const title = reviewTitle(output.findings.length);
  const sections: string[] = [inert(output.summary)];
  for (const severity of SEVERITY_ORDER) {
    const group = output.findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) continue;
    sections.push(`### ${severity} (${group.length})\n${group.map(renderFinding).join('\n')}`);
  }
  return { title, body: sections.join('\n\n') };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function slackLink(url: string | undefined, label: string): string {
  return url === undefined || url.length > MAX_SLACK_URL_CHARS ? label : `<${url}|${label}>`;
}

function section(text: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function blobUrl(context: SlackContext, file: string): string | undefined {
  const segments = file.split('/');
  if (context.repoUrl === undefined || context.sha === undefined) return undefined;
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return undefined;
  return `${context.repoUrl}/blob/${context.sha}/${segments.map(encodeURIComponent).join('/')}`;
}

// First-seen file order keeps the model's own ordering; lines ascend within a file.
function groupByFile(findings: readonly ConventionFinding[]): Array<[string, ConventionFinding[]]> {
  const files = new Map<string, ConventionFinding[]>();
  for (const finding of findings) files.set(finding.file, [...(files.get(finding.file) ?? []), finding]);
  return [...files].map(([file, items]) => [file, [...items].sort((a, b) => a.line - b.line)]);
}

function renderSlackFinding(finding: ConventionFinding, fileUrl: string | undefined): SlackBlock {
  const lineLink = slackLink(fileUrl === undefined ? undefined : `${fileUrl}#L${finding.line}`, `line ${finding.line}`);
  const lines = [finding.rule === 'other' ? lineLink : `${lineLink}  \`${finding.rule}\``];
  const suggestion = slackPlain(finding.suggestion, MAX_SLACK_SUGGESTION_CHARS);
  if (suggestion.trim() !== '') lines.push(suggestion);
  const evidence = slackPlain(finding.evidence, MAX_SLACK_EVIDENCE_CHARS);
  if (evidence.trim() !== '') lines.push(`\`\`\`${evidence}\`\`\``);
  return section(lines.join('\n'));
}

function renderSeverity(severity: ConventionSeverity, group: readonly ConventionFinding[], context: SlackContext): SlackAttachment {
  const { label, color } = SLACK_SEVERITY[severity];
  const files = groupByFile(group);
  const blocks: SlackBlock[] = [section(`*${label} · ${plural(group.length, 'finding')} in ${plural(files.length, 'file')}*`)];
  for (const [file, items] of files) {
    const fileUrl = blobUrl(context, file);
    blocks.push(section(`*${slackLink(fileUrl, slackPlain(file, MAX_SLACK_PATH_CHARS))}*`));
    blocks.push(...items.map((finding) => renderSlackFinding(finding, fileUrl)));
  }
  return { color, blocks };
}

function renderSlackFields(output: ConventionReviewOutput, context: SlackContext): SlackBlock {
  const fields: string[] = [];
  if (context.sha !== undefined) {
    const shortSha = context.sha.slice(0, SHORT_SHA_LENGTH);
    const commit = context.repoUrl === undefined ? `\`${shortSha}\`` : slackLink(`${context.repoUrl}/commit/${context.sha}`, shortSha);
    const subject = context.subject === undefined ? '' : ` ${slackPlain(context.subject, MAX_SLACK_FIELD_CHARS)}`;
    fields.push(`*Commit*\n${commit}${subject}`);
  }
  if (context.branch !== undefined) fields.push(`*Branch*\n${slackPlain(context.branch, MAX_SLACK_FIELD_CHARS)}`);
  const counts = SEVERITY_ORDER.map((severity) => [severity, output.findings.filter((f) => f.severity === severity).length] as const)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${count} ${severity}`);
  fields.push(`*Findings*\n${counts.join(', ')}`);
  fields.push(`*Files*\n${new Set(output.findings.map((finding) => finding.file)).size}`);
  return { type: 'section', fields: fields.map((text) => ({ type: 'mrkdwn' as const, text })) };
}

export function renderConventionSlack(output: ConventionReviewOutput, context: SlackContext): SlackMessage {
  const title = reviewTitle(output.findings.length);
  const blocks: SlackBlock[] = [{ type: 'header', text: { type: 'plain_text', text: title } }, renderSlackFields(output, context)];
  const summary = slackPlain(output.summary, MAX_SLACK_SUMMARY_CHARS);
  if (summary.trim() !== '') blocks.push(section(summary));

  const commitUrl = context.repoUrl !== undefined && context.sha !== undefined ? `${context.repoUrl}/commit/${context.sha}` : undefined;
  const buttons = [
    { text: 'View workflow run', url: context.runUrl },
    { text: 'View commit', url: commitUrl },
  ].flatMap(({ text, url }) => (url === undefined ? [] : [{ type: 'button' as const, text: { type: 'plain_text' as const, text }, url }]));
  if (buttons.length > 0) blocks.push({ type: 'actions', elements: buttons });

  const attachments = SEVERITY_ORDER.flatMap((severity) => {
    const group = output.findings.filter((finding) => finding.severity === severity);
    return group.length === 0 ? [] : [renderSeverity(severity, group, context)];
  });
  const lastAttachment = attachments.at(-1);
  if (lastAttachment !== undefined && commitUrl !== undefined) {
    lastAttachment.blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Line links open the file at the reviewed commit.' }] });
  }
  return { text: title, blocks, attachments };
}
