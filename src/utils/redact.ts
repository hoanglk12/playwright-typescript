/**
 * Deep redaction utility for verbose API request/response logging (Phase 3).
 *
 * Used by `ApiClientExt`'s (REST) and `GraphQLClient`'s (GraphQL) verbose-logging attachment
 * paths, gated behind `VERBOSE_LOGS`. Never mutates the input — always returns a redacted deep
 * clone so the live request payload / parsed response body used by test assertions is left
 * untouched.
 */

export const REDACTION_MARKER = '[REDACTED]';

/**
 * Key substrings considered sensitive, matched case-insensitively against object keys at
 * any nesting depth (substring, not exact — so `newPassword`, `access_token`, `x-api-key`,
 * `clientSecret` etc. are all caught, not just the bare form). Covers auth tokens/headers,
 * payment-adjacent fields, and customer PII the GRA API suite may carry.
 */
const SENSITIVE_KEYS: readonly string[] = [
  'authorization',
  'token',
  'secret',
  'apikey',
  'api-key',
  'password',
  'cardnumber',
  'cvv',
  'securitycode',
  // Cookie headers embed the same session/JWT values as accessToken/refreshToken body
  // fields — redacting only the body keys leaves the tokens readable via Set-Cookie/Cookie.
  'set-cookie',
  'cookie',
  // Customer PII — this attachment is deployed to public Cloudflare Pages report sites.
  'email',
  'firstname',
  'lastname',
  'phone',
  'telephone',
  'dob',
  'dateofbirth',
  'address',
  'street',
  'city',
  'postcode',
  'zipcode',
  'gender',
  'username',
];

// Strips separators (`_`, `-`, spaces, etc.) before lowercasing, so snake_case/kebab-case/camelCase
// variants of a key (e.g. `date_of_birth`, `dateOfBirth`) all match the same `SENSITIVE_KEYS` entry
// without needing a separate literal per naming style.
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEYS.some(sensitive => normalized.includes(normalizeKey(sensitive)));
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value !== null && typeof value === 'object') {
    const redactedEntries = Object.entries(value as Record<string, unknown>).map(
      ([key, entryValue]): [string, unknown] => [
        key,
        isSensitiveKey(key) ? REDACTION_MARKER : redactValue(entryValue),
      ],
    );
    return Object.fromEntries(redactedEntries);
  }

  return value;
}

/**
 * Deep-redact known-sensitive keys from a value, recursively through nested objects/arrays.
 * Returns a new value — the input is never mutated.
 * @param value - Arbitrary JSON-shaped value (request body, headers map, response body, etc.)
 * @returns A deep-cloned copy of `value` with sensitive field values replaced by `REDACTION_MARKER`
 */
export function redactSensitiveData<T>(value: T): T {
  return redactValue(value) as T;
}

// Value-level patterns, independent of key names — catches secrets/PII embedded in free text
// (log narration, URL query strings) that key-based redaction can't see because there's no key.
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const CARD_NUMBER_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;
const URL_SECRET_QUERY_PATTERN = /([?&](?:token|api[_-]?key|secret|access[_-]?token|password)=)[^&\s"']+/gi;

/**
 * Regex-based redaction over raw text, for content that never passes through
 * `redactSensitiveData` as a structured object — free-text log lines (e.g. a spec calling
 * `logger.verify('Customer email', testEmail, ...)`) and defense-in-depth over an
 * already key-redacted JSON string (catches secrets embedded in URL query strings, which
 * have no object key to match against).
 * @param text - Raw text to scrub (a log buffer, or a JSON.stringify'd payload)
 * @returns The same text with emails, JWTs, card numbers, and secret-bearing query params replaced
 */
export function redactSensitiveText(text: string): string {
  return text
    .replace(JWT_PATTERN, '[REDACTED-JWT]')
    .replace(EMAIL_PATTERN, '[REDACTED-EMAIL]')
    .replace(CARD_NUMBER_PATTERN, '[REDACTED-CARD]')
    .replace(URL_SECRET_QUERY_PATTERN, `$1${REDACTION_MARKER}`);
}

// Browser console/page-error/failed-request text can carry multi-KB GraphQL-over-GET URLs
// (GRA storefronts) — cap length so one noisy entry can't dominate the attachment.
const MAX_REDACTED_TEXT_LENGTH = 2000;

/**
 * Regex-based redaction for browser-side failure capture (console errors, page errors, failed
 * network requests) — a distinct surface from `redactSensitiveText`, which existing API-side
 * callers depend on for its exact current behavior.
 *
 * Deliberately omits `CARD_NUMBER_PATTERN`: this codebase's tested checkout flows never pass
 * raw card numbers through the browser (tokenized gateway widgets only — Braintree, checkmo,
 * afterpay), so the pattern has no protective value here, while it does false-positive on
 * ordinary browser telemetry (GA client IDs, epoch-millisecond timestamps) that commonly
 * appears in console output and failed-request URLs, corrupting the diagnostic text.
 * @param text - Raw text to scrub (a console message, page error, or failed-request line)
 * @returns The same text with JWTs, emails, and secret-bearing query params redacted, truncated
 * to `MAX_REDACTED_TEXT_LENGTH` characters
 */
export function redactConsoleText(text: string): string {
  const redacted = text
    .replace(JWT_PATTERN, '[REDACTED-JWT]')
    .replace(EMAIL_PATTERN, '[REDACTED-EMAIL]')
    .replace(URL_SECRET_QUERY_PATTERN, `$1${REDACTION_MARKER}`);

  return redacted.length > MAX_REDACTED_TEXT_LENGTH
    ? `${redacted.slice(0, MAX_REDACTED_TEXT_LENGTH)}...[truncated]`
    : redacted;
}
