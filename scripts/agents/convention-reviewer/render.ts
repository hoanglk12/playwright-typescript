import { codeSpan } from '../harness/deliver.ts';
import type { DeliveryTarget, RenderedMessage } from '../harness/deliver.ts';
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

export function renderConventionMarkdown(output: ConventionReviewOutput, _target: DeliveryTarget): RenderedMessage {
  const count = output.findings.length;
  const title = `Convention review: ${count} finding${count === 1 ? '' : 's'}`;
  const sections: string[] = [inert(output.summary)];
  for (const severity of SEVERITY_ORDER) {
    const group = output.findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) continue;
    sections.push(`### ${severity} (${group.length})\n${group.map(renderFinding).join('\n')}`);
  }
  return { title, body: sections.join('\n\n') };
}
