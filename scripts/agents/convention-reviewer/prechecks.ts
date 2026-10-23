import { MAX_EVIDENCE_CHARS } from '../harness/limits.ts';
import { sanitizeText } from '../harness/sanitize.ts';
import type { ConventionFinding, ConventionRule, ConventionSeverity } from './schema.ts';

export type PrecheckId =
  | 'playwright-test-import'
  | 'api-base-test-import'
  | 'fixed-sleep'
  | 'numeric-timeout'
  | 'test-only'
  | 'console-log'
  | 'gra-serial-mode'
  | 'comment-emoji'
  | 'explicit-any';

export interface PrecheckFinding extends ConventionFinding {
  check: PrecheckId;
}

export interface AddedLine {
  file: string;
  line: number;
  text: string;
}

export interface ParsedDiff {
  addedLines: AddedLine[];
  files: ReadonlySet<string>;
}

interface SplitLine {
  code: string;
  comment: string | undefined;
}

interface Precheck {
  id: PrecheckId;
  rule: ConventionRule;
  severity: ConventionSeverity;
  suggestion: string;
  appliesTo: (file: string) => boolean;
  matches: (line: SplitLine) => boolean;
}

const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const LINE_COMMENT_START = /(^|\s)\/\//;
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;
const PLAYWRIGHT_TEST_IMPORT =
  /^\s*import\s+(?!type\b)\{[^}]*\b(?:test|expect)\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/;
const BASE_TEST_IMPORT = /from\s*['"]@config\/base-test['"]/;
const SPEC_FILE = /^tests\/.*\.spec\.ts$/;
const API_TEST_FILE = /^tests\/api\/.*\.ts$/;
const GRA_SPEC_FILE = /^tests\/api\/(?:.*\/)?gra-[^/]*\.spec\.ts$/;

function isTypeScript(file: string): boolean {
  return file.endsWith('.ts');
}

function isTestOrPage(file: string): boolean {
  return isTypeScript(file) && (file.startsWith('tests/') || file.startsWith('src/pages/'));
}

const PRECHECKS: readonly Precheck[] = [
  {
    id: 'playwright-test-import',
    rule: 'wrong-test-import',
    severity: 'critical',
    suggestion: "Import test and expect from '@config/base-test', not '@playwright/test'.",
    appliesTo: (file) => SPEC_FILE.test(file),
    matches: ({ code }) => PLAYWRIGHT_TEST_IMPORT.test(code),
  },
  {
    id: 'api-base-test-import',
    rule: 'wrong-test-import',
    severity: 'critical',
    suggestion: "API tests import apiTest from '../../src/api/ApiTest', never '@config/base-test'.",
    appliesTo: (file) => API_TEST_FILE.test(file),
    matches: ({ code }) => BASE_TEST_IMPORT.test(code),
  },
  {
    id: 'fixed-sleep',
    rule: 'fixed-sleep',
    severity: 'warning',
    suggestion: 'Replace the fixed sleep with a WaitHelper condition (this.waits.*).',
    appliesTo: isTestOrPage,
    matches: ({ code }) => /\bwaitForTimeout\s*\(/.test(code),
  },
  {
    id: 'numeric-timeout',
    rule: 'magic-timeout',
    severity: 'critical',
    suggestion: 'Use a named TIMEOUTS constant from src/constants/timeouts.ts instead of a number.',
    appliesTo: isTypeScript,
    matches: ({ code }) => /\btimeout\s*:\s*\d/.test(code),
  },
  {
    id: 'test-only',
    rule: 'other',
    severity: 'critical',
    suggestion: 'Remove .only before merging; it silently skips every other test.',
    appliesTo: (file) => isTypeScript(file) && file.startsWith('tests/'),
    matches: ({ code }) => /\.only\s*\(/.test(code),
  },
  {
    id: 'console-log',
    rule: 'other',
    severity: 'warning',
    suggestion: 'Use createTestLogger() (logger.step/action/verify) instead of console.log.',
    appliesTo: isTypeScript,
    matches: ({ code }) => /\bconsole\.log\s*\(/.test(code),
  },
  {
    id: 'gra-serial-mode',
    rule: 'other',
    severity: 'warning',
    suggestion: 'GRA specs run in default mode; serial mode causes cascade-skips that hide test signal.',
    appliesTo: (file) => GRA_SPEC_FILE.test(file),
    matches: ({ code }) => /mode\s*:\s*['"]serial['"]|\.describe\.serial\s*\(/.test(code),
  },
  {
    id: 'comment-emoji',
    rule: 'comment-smell',
    severity: 'suggestion',
    suggestion: 'Remove the emoji from the comment (AI-generated-code smell, qa-code-reviewer section 16).',
    appliesTo: isTypeScript,
    matches: ({ comment }) => comment !== undefined && EMOJI.test(comment),
  },
  {
    id: 'explicit-any',
    rule: 'other',
    severity: 'warning',
    suggestion: 'Replace any with a specific type or unknown.',
    appliesTo: isTypeScript,
    matches: ({ code }) => /:\s*any\b/.test(code),
  },
];

export const PRECHECK_IDS: readonly PrecheckId[] = PRECHECKS.map((check) => check.id);

function splitLine(text: string): SplitLine {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*')) return { code: '', comment: trimmed };
  const match = LINE_COMMENT_START.exec(text);
  if (match === null) return { code: text, comment: undefined };
  return { code: text.slice(0, match.index), comment: text.slice(match.index + match[0].length) };
}

function headerPath(raw: string): string | undefined {
  const path = raw.split('\t')[0];
  if (path === '/dev/null' || path.startsWith('"') || !path.startsWith('b/')) return undefined;
  return path.slice(2);
}

export function parseDiff(diff: string): ParsedDiff {
  const addedLines: AddedLine[] = [];
  const files = new Set<string>();
  let currentFile: string | undefined;
  let oldRemaining = 0;
  let newRemaining = 0;
  let newLine = 0;

  for (const raw of diff.split(/\r?\n/)) {
    if (oldRemaining > 0 || newRemaining > 0) {
      const marker = raw[0];
      if (marker === '+') {
        if (currentFile !== undefined) addedLines.push({ file: currentFile, line: newLine, text: raw.slice(1) });
        newLine += 1;
        newRemaining -= 1;
        continue;
      }
      if (marker === '-') {
        oldRemaining -= 1;
        continue;
      }
      if (marker === ' ' || raw === '') {
        oldRemaining -= 1;
        newRemaining -= 1;
        newLine += 1;
        continue;
      }
      if (marker === '\\') continue;
      oldRemaining = 0;
      newRemaining = 0;
    }

    if (raw.startsWith('diff --git ')) {
      currentFile = undefined;
    } else if (raw.startsWith('+++ ')) {
      currentFile = headerPath(raw.slice(4));
      if (currentFile !== undefined) files.add(currentFile);
    } else {
      const hunk = HUNK_HEADER.exec(raw);
      if (hunk !== null) {
        oldRemaining = hunk[1] === undefined ? 1 : Number(hunk[1]);
        newRemaining = hunk[3] === undefined ? 1 : Number(hunk[3]);
        newLine = Number(hunk[2]);
      }
    }
  }
  return { addedLines, files };
}

export function runPrechecks(addedLines: readonly AddedLine[]): PrecheckFinding[] {
  const findings: PrecheckFinding[] = [];
  for (const added of addedLines) {
    const split = splitLine(added.text);
    for (const check of PRECHECKS) {
      if (!check.appliesTo(added.file) || !check.matches(split)) continue;
      findings.push({
        check: check.id,
        rule: check.rule,
        severity: check.severity,
        file: added.file,
        line: added.line,
        evidence: sanitizeText(added.text.trim(), MAX_EVIDENCE_CHARS),
        suggestion: check.suggestion,
      });
    }
  }
  return findings;
}

export function toFinding(finding: PrecheckFinding): ConventionFinding {
  const { check: _check, ...rest } = finding;
  return rest;
}
