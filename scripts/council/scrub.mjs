/**
 * scripts/council/scrub.mjs
 *
 * Standalone secret/PII scrubber for content leaving this machine via
 * scripts/council/. Deliberately independent of src/utils/redact.ts, which
 * is scoped to a different threat model (API test payload keys, TypeScript,
 * imported only inside tests/config).
 *
 * This is a denylist, not a provably complete filter. It is the second line
 * of defense — the explicit consent gate in dispatch.mjs (manifest + a
 * mandatory --yes re-run after an explicit user approval message) is the
 * primary protection. Never rely on scrub() alone to justify skipping the
 * consent gate.
 */

/** Internal hostname substrings to redact. Extend as needed. */
export const INTERNAL_HOST_PATTERNS = ['.internal.', '.local.'];

function internalHostRules() {
  return INTERNAL_HOST_PATTERNS.map(substr => ({
    name: `internal-host(${substr})`,
    pattern: new RegExp(`\\b[\\w-]+${substr.replace(/\./g, '\\.')}[\\w.-]*\\b`, 'gi'),
    replacement: '[INTERNAL-HOST]',
  }));
}

/**
 * Ordered rules. Order matters: PEM/JWT/URL-credentials/auth-headers run
 * before the looser email pattern, so email doesn't eat the local part of a
 * `user:pass@host` credential before the URL-credential rule sees it.
 */
export const SCRUB_RULES = [
  {
    name: 'pem-private-key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED-PEM-KEY]',
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: '[REDACTED-JWT]',
  },
  {
    name: 'url-embedded-credentials',
    pattern: /:\/\/[^\s/:@]+:[^\s/:@]+@/g,
    replacement: '://[REDACTED-CREDENTIALS]@',
  },
  {
    name: 'authorization-header',
    pattern: /Authorization:\s*(Bearer|Basic)\s+\S+/gi,
    replacement: 'Authorization: $1 [REDACTED-TOKEN]',
  },
  {
    name: 'api-key-header',
    pattern: /\b(X-Api-Key|Api-Key):\s*\S+/gi,
    replacement: '$1: [REDACTED-TOKEN]',
  },
  {
    name: 'cookie-header',
    pattern: /\b(Cookie|Set-Cookie):\s*\S+/gi,
    replacement: '$1: [REDACTED-COOKIE]',
  },
  {
    // Intentionally case-sensitive (uppercase only): env-style assignments (KEY=..., API_TOKEN=...)
    // are the target. Case-insensitive would also fire on ordinary camelCase source code
    // (`const token = x`) inside --context files, mangling content the council needs to reason
    // about. The 'secret-assignment-ci' rule below handles lowercase/YAML-style shapes, scoped to
    // quote/JSON/YAML-delimited values so it doesn't over-match ordinary prose.
    name: 'secret-shaped-env-assignment',
    pattern: /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|WEBHOOK|DSN|CONN)[A-Z0-9_]*)\s*[:=]\s*(['"]?)([^'"\n]{4,})\2/g,
    replacement: '$1=[REDACTED]',
  },
  {
    // The key's own quote (\1) and the value's quote (\3) both being backreferenced is what makes
    // this fire on JSON's "password": "x" (unquoted keys have no \1 to match against) without also
    // firing on unquoted code expressions like `passwordInput = this.page.getByLabel('Password')` —
    // requiring the VALUE to be quoted is what excludes those.
    name: 'secret-assignment-ci',
    pattern: /(["']?)([\w-]*(?:passwd|password|secret|token|api[_-]?key|auth[_-]?token|credential)[\w-]*)\1\s*[:=]\s*(["'])([^"'\n]{4,})\3/gi,
    replacement: '$1$2$1: [REDACTED]',
  },
  {
    name: 'openrouter-key',
    pattern: /\bsk-or-v1-[A-Za-z0-9]+\b/g,
    replacement: '[REDACTED-OPENROUTER-KEY]',
  },
  {
    name: 'generic-sk-token',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED-API-KEY]',
  },
  {
    name: 'aws-access-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED-AWS-KEY]',
  },
  {
    name: 'google-api-key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    replacement: '[REDACTED-GOOGLE-KEY]',
  },
  {
    name: 'npm-token',
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g,
    replacement: '[REDACTED-NPM-TOKEN]',
  },
  {
    name: 'github-token',
    pattern: /\b(?:gh[oshu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replacement: '[REDACTED-GITHUB-TOKEN]',
  },
  {
    name: 'stripe-key',
    pattern: /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/g,
    replacement: '[REDACTED-STRIPE-KEY]',
  },
  {
    name: 'sendgrid-key',
    pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
    replacement: '[REDACTED-SENDGRID-KEY]',
  },
  {
    name: 'slack-webhook',
    pattern: /hooks\.slack\.com\/services\/\S+/g,
    replacement: '[REDACTED-SLACK-WEBHOOK]',
  },
  {
    name: 'slack-token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]+\b/gi,
    replacement: '[REDACTED-SLACK-TOKEN]',
  },
  {
    name: 'percy-auth-token',
    pattern: /\bauth_[A-Za-z0-9]{20,}\b/g,
    replacement: '[REDACTED-PERCY-TOKEN]',
  },
  {
    name: 'secret-bearing-query-param',
    pattern: /([?&](?:token|api_key|secret|access_token|password)=)[^&\s]+/gi,
    replacement: '$1[REDACTED]',
  },
  {
    name: 'email-address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED-EMAIL]',
  },
  {
    name: 'windows-user-path',
    pattern: /C:\\Users\\[^\\/\s]+/gi,
    replacement: 'C:\\Users\\[USER]',
  },
  ...internalHostRules(),
];

/**
 * Scrubs `text` against SCRUB_RULES in order. Returns the scrubbed text and
 * hit counts — never the matched raw values, so hit metadata is safe to log
 * or persist even though the input might not be.
 */
export function scrub(text) {
  let result = text ?? '';
  const hits = [];
  for (const rule of SCRUB_RULES) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
    const re = new RegExp(rule.pattern.source, flags);
    const matches = result.match(re);
    if (matches && matches.length) {
      hits.push({ rule: rule.name, count: matches.length });
      result = result.replace(re, rule.replacement);
    }
  }
  return { text: result, hits };
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n… [truncated — ${text.length - maxLen} more characters, use --dry-run to see it all]`;
}

function indent(text) {
  return text
    .split('\n')
    .map(l => `    ${l}`)
    .join('\n');
}

function hitsSuffix(hits) {
  if (!hits || !hits.length) return '';
  return `  [scrub hits: ${hits.map(h => `${h.rule}×${h.count}`).join(', ')}]`;
}

function sumHits(entries) {
  return entries.reduce((sum, e) => sum + (e.hits ?? []).reduce((s, h) => s + h.count, 0), 0);
}

/**
 * Builds the human-readable consent manifest plus a structured version for
 * the run JSON.
 *
 * `question` = { sourceLabel, bytes, hits, framedText }.
 * `contextFiles` = [{ path, bytes, hits }].
 * `models` = flat panel list, [{ slug, family }] — no chairman, no ranking
 * stage; this tool is a flat parallel fan-out (see CLAUDE.md "LLM Council"
 * section), not the reverted debate-panel-plus-chairman design this
 * function's shape was originally built for.
 * `estimate` = { totalCostUsd } — a chars/4-token approximation against
 * tiers.mjs's static pricing (this endpoint has no pricing API), or null if
 * a future model in the panel has no pricing entry there (the caller must
 * never coerce that to 0).
 */
export function buildManifest({ question, contextFiles = [], models, estimate, showFull = false }) {
  const lines = [];
  lines.push('══════════════════════════════════════════════════');
  lines.push('  Council Review — Consent Manifest');
  lines.push('══════════════════════════════════════════════════');
  lines.push('');
  lines.push('Sources:');
  lines.push(`  - question (${question.sourceLabel}): ${question.bytes} bytes${hitsSuffix(question.hits)}`);
  for (const f of contextFiles) {
    lines.push(`  - context: ${f.path} (${f.bytes} bytes)${hitsSuffix(f.hits)}`);
  }
  lines.push('');
  lines.push(`Total scrub hits: ${sumHits([question, ...contextFiles])}`);
  lines.push('');
  lines.push(showFull ? 'Framed prompt (full):' : 'Framed prompt (truncated preview — use --dry-run for full text):');
  lines.push(indent(showFull ? question.framedText : truncate(question.framedText, 500)));
  lines.push('');
  lines.push(`Models (${models.length}, flat fan-out, no ranking, no chairman):`);
  for (const m of models) {
    lines.push(`  - ${m.slug}  [${m.family}]`);
  }
  lines.push('');
  lines.push('Provider policy:');
  lines.push('  UNKNOWN — not enforceable on this endpoint (ShopAIKey proxy, not OpenRouter)');
  lines.push('');
  lines.push('Cost estimate:');
  lines.push(
    estimate.totalCostUsd === null
      ? '  UNKNOWN — this endpoint has no confirmed pricing catalog. --max-cost cannot be enforced; the consent step below is your only cost backstop.'
      : `  ~$${estimate.totalCostUsd.toFixed(4)} (character/4 prompt-token approximation at each model's max_tokens completion cap — a ceiling for models that honor the cap, a floor for any that don't; not a billed figure)`
  );
  lines.push('');

  const printable = lines.join('\n');
  const json = { question, contextFiles, models, estimate };
  return { printable, json };
}

/**
 * Throws if the literal API key value appears anywhere in the outbound
 * payload string. Call immediately before every chat() call — this is a
 * hard stop, not a scrub-and-continue.
 */
export function assertNoApiKeyInPayload(payloadString, apiKey) {
  if (apiKey && apiKey.length >= 8 && payloadString.includes(apiKey)) {
    throw new Error('Refusing to send request: API key literal found inside outbound payload.');
  }
}
