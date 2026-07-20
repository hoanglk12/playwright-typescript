/**
 * Deep redaction utility for verbose API request/response logging (Phase 3).
 *
 * Used exclusively by `ApiClientExt`'s verbose-logging attachment path, gated behind
 * `VERBOSE_LOGS`. Never mutates the input — always returns a redacted deep clone so the
 * live request payload / parsed response body used by test assertions is left untouched.
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
  'postcode',
  'zipcode',
  'gender',
  'username',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitive => normalized.includes(sensitive));
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
