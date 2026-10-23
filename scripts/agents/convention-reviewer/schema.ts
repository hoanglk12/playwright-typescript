import { z } from 'zod';
import {
  MAX_EVIDENCE_CHARS,
  MAX_FINDINGS,
  MAX_PATH_CHARS,
  MAX_SUGGESTION_CHARS,
  MAX_SUMMARY_CHARS,
} from '../harness/limits.ts';

export const CONVENTION_RULES = [
  'inline-locator',
  'hierarchical-selector',
  'non-semantic-locator',
  'soft-vs-hard-assertion',
  'unnamed-data-interface',
  'comment-smell',
  'magic-timeout',
  'fixed-sleep',
  'wrong-test-import',
  'other',
] as const;

const CONVENTION_SEVERITIES = ['critical', 'warning', 'suggestion'] as const;

export type ConventionRule = (typeof CONVENTION_RULES)[number];
export type ConventionSeverity = (typeof CONVENTION_SEVERITIES)[number];

export interface ConventionFinding {
  rule: ConventionRule;
  severity: ConventionSeverity;
  file: string;
  line: number;
  evidence: string;
  suggestion: string;
}

export interface ConventionReviewOutput {
  summary: string;
  findings: ConventionFinding[];
}

export const ConventionFindingSchema: z.ZodType<ConventionFinding> = z.object({
  rule: z.enum(CONVENTION_RULES),
  severity: z.enum(CONVENTION_SEVERITIES),
  file: z.string().min(1).max(MAX_PATH_CHARS),
  line: z.number().int().min(1),
  evidence: z.string().max(MAX_EVIDENCE_CHARS),
  suggestion: z.string().max(MAX_SUGGESTION_CHARS),
});

export const ConventionReviewOutputSchema: z.ZodType<ConventionReviewOutput> = z.object({
  summary: z.string().max(MAX_SUMMARY_CHARS),
  findings: z.array(ConventionFindingSchema).max(MAX_FINDINGS),
});
