import type { DeliveryTarget, RenderedMessage } from '../harness/deliver.ts';
import { codeSpan } from '../harness/markdown.ts';
import type { ConventionFinding, ConventionReviewOutput, ConventionSeverity } from './schema.ts';

const SEVERITY_ORDER: readonly ConventionSeverity[] = ['critical', 'warning', 'suggestion'];

const MARKDOWN_ACTIVE = /[\\`*_[\]()<>!#|~]/g;

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

function slackText(text: string): string {
  return flatten(text).replace(/`/g, "'");
}

function slackCode(text: string): string {
  return `\`${slackText(text)}\``;
}

function renderSlackFinding(finding: ConventionFinding): string {
  const location = slackCode(`${finding.file}:${finding.line}`);
  return `- ${location} ${slackCode(finding.rule)}: ${slackText(finding.suggestion)}\n  evidence: ${slackCode(finding.evidence)}`;
}

function reviewTitle(count: number): string {
  return `Convention review: ${count} finding${count === 1 ? '' : 's'}`;
}

function renderConventionSlack(output: ConventionReviewOutput): RenderedMessage {
  const title = reviewTitle(output.findings.length);
  const sections: string[] = [slackText(output.summary)];
  for (const severity of SEVERITY_ORDER) {
    const group = output.findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) continue;
    sections.push(`*${severity} (${group.length})*\n${group.map(renderSlackFinding).join('\n')}`);
  }
  return { title, body: sections.join('\n\n') };
}

export function renderConventionMarkdown(output: ConventionReviewOutput, target: DeliveryTarget): RenderedMessage {
  if (target === 'slack') return renderConventionSlack(output);
  const title = reviewTitle(output.findings.length);
  const sections: string[] = [inert(output.summary)];
  for (const severity of SEVERITY_ORDER) {
    const group = output.findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) continue;
    sections.push(`### ${severity} (${group.length})\n${group.map(renderFinding).join('\n')}`);
  }
  return { title, body: sections.join('\n\n') };
}
