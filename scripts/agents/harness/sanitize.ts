import { redactSensitiveText } from '../../../src/utils/redact.ts';
import { MAX_OUTPUT_FIELD_CHARS } from './limits.ts';

const TRUNCATION_SUFFIX = '...[truncated]';
const SECRET_PLACEHOLDER = '[REDACTED-SECRET]';
const ZERO_WIDTH_SPACE = '​';
const GITHUB_MENTION = /(?<!\w)@(?=[A-Za-z0-9])/g;
const HARNESS_CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /gh[posur]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
];

function redactHarnessCredentials(text: string): string {
  return HARNESS_CREDENTIAL_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, SECRET_PLACEHOLDER), text);
}

export function redactText(text: string): string {
  return redactHarnessCredentials(redactSensitiveText(text));
}

function neutralizeMentions(text: string): string {
  return text.replace(GITHUB_MENTION, `@${ZERO_WIDTH_SPACE}`);
}

function mapStrings<T>(value: T, transform: (text: string) => string): T {
  if (typeof value === 'string') return transform(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform)) as T;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entry]): [string, unknown] => [key, mapStrings(entry, transform)],
    );
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function sanitizeText(text: string, maxChars: number): string {
  const cleaned = neutralizeMentions(redactText(text));
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, Math.max(0, maxChars - TRUNCATION_SUFFIX.length)) + TRUNCATION_SUFFIX;
}

export function sanitizeDeep<T>(value: T, maxChars: number = MAX_OUTPUT_FIELD_CHARS): T {
  return mapStrings(value, (text) => sanitizeText(text, maxChars));
}

export function hasLeak(text: string): boolean {
  return redactText(text) !== text;
}

export function scrubSecrets(text: string, secrets: readonly string[]): string {
  let scrubbed = text;
  for (const secret of secrets) {
    if (secret !== '') scrubbed = scrubbed.replaceAll(secret, SECRET_PLACEHOLDER);
  }
  return redactText(scrubbed);
}

export function scrubSecretsDeep<T>(value: T, secrets: readonly string[]): T {
  return mapStrings(value, (text) => scrubSecrets(text, secrets));
}
