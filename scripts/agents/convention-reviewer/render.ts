import type { RenderedMessage } from '../harness/deliver.ts';
import { codeSpan, flatten, inert } from '../harness/markdown.ts';
import { slackPlain } from '../harness/slack.ts';
import type { SlackAttachment, SlackBlock, SlackContext, SlackMessage } from '../harness/slack.ts';
import {
  MAX_SLACK_PATH_CHARS,
  actionButtons,
  blobUrl,
  branchFieldText,
  commitFieldText,
  commitUrl,
  plural,
  section,
  slackLink,
} from '../harness/slack-blocks.ts';
import type { ConventionFinding, ConventionReviewOutput, ConventionSeverity } from './schema.ts';

export { inert };

const SEVERITY_ORDER: readonly ConventionSeverity[] = ['critical', 'warning', 'suggestion'];

const SLACK_SEVERITY: Readonly<Record<ConventionSeverity, { label: string; color: string }>> = {
  critical: { label: 'Critical', color: '#E01E5A' },
  warning: { label: 'Warning', color: '#ECB22E' },
  suggestion: { label: 'Suggestion', color: '#1D9BD1' },
};

const MAX_SLACK_SUGGESTION_CHARS = 1000;
const MAX_SLACK_EVIDENCE_CHARS = 700;
const MAX_SLACK_SUMMARY_CHARS = 2900;

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
  const commit = commitFieldText(context);
  if (commit !== undefined) fields.push(commit);
  const branch = branchFieldText(context);
  if (branch !== undefined) fields.push(branch);
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

  const buttons = actionButtons(context);
  if (buttons !== undefined) blocks.push(buttons);

  const attachments = SEVERITY_ORDER.flatMap((severity) => {
    const group = output.findings.filter((finding) => finding.severity === severity);
    return group.length === 0 ? [] : [renderSeverity(severity, group, context)];
  });
  const lastAttachment = attachments.at(-1);
  if (lastAttachment !== undefined && commitUrl(context) !== undefined) {
    lastAttachment.blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Line links open the file at the reviewed commit.' }] });
  }
  return { text: title, blocks, attachments };
}
