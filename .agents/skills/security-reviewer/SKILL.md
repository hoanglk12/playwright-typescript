---
name: security-reviewer
description: Identifies security vulnerabilities in a Playwright TypeScript test automation framework. Focuses on secret detection, dependency audits, unsafe eval patterns in page.evaluate(), sensitive data in test logs, and CI/CD pipeline security. Generates structured audit reports with severity ratings and actionable remediation.
license: MIT
allowed-tools: Read, Grep, Glob, Bash
metadata:
  author: https://github.com/Jeffallan
  version: "1.1.1"
  domain: security
  triggers: security review, vulnerability scan, secrets scan, npm audit, credential leak, token exposure, dependency audit, CI security, GitHub Actions security
  role: specialist
  scope: review
  output-format: report
  related-skills: qa-code-reviewer
---

# Security Reviewer

Security analyst specializing in test automation framework security: secret detection, dependency vulnerabilities, unsafe browser evaluation patterns, and CI/CD pipeline hardening.

## Scope for This Project

This is a **Playwright TypeScript test automation framework** — not an application server. The attack surface is:

- **Secrets & credentials** committed to source (`.env.*`, `src/data/`, `src/config/`)
- **Vulnerable npm dependencies** (`package.json` / `package-lock.json`)
- **Unsafe `page.evaluate()` patterns** — string interpolation in browser eval context
- **Sensitive data leaking through `logger.*`** — passwords/tokens logged during test runs
- **GitHub Actions workflow security** — exposed secrets, overly broad permissions
- **API auth token handling** in `src/api/` services

Do NOT apply general application security patterns (SQL injection, XSS, IDOR, CORS, SSRF) — this project does not implement HTTP endpoints or render user-controlled HTML.

## Core Workflow

1. **Scope** — Identify which files changed or were added. Focus on: `src/data/`, `src/config/`, `src/api/`, `.env.*`, `.github/workflows/`, `src/pages/`, `src/utils/`

2. **Scan** — Run automated tools appropriate for this TypeScript/Node.js project:
   ```bash
   # Dependency vulnerabilities (primary scan — run first)
   npm audit --audit-level=moderate

   # Secret patterns in source files
   grep -rn "password\s*=\|api_key\s*=\|token\s*=\|secret\s*=" --include="*.ts" src/
   grep -rn "AKIA[0-9A-Z]\{16\}\|ghp_\|xox[baprs]-\|sk_live_" src/ .env* 2>/dev/null || true
   grep -rn "eyJ[A-Za-z0-9_-]*\.eyJ" src/ 2>/dev/null || true

   # page.evaluate() with template literals (eval-equivalent in browser)
   grep -rn "page\.evaluate\|this\.page\.evaluate" --include="*.ts" src/

   # Sensitive data in logger calls
   grep -rn "logger\.\(action\|step\|verify\|error\)" --include="*.ts" src/ tests/

   # Hardcoded URLs or credentials in data modules
   grep -rn "http\|https\|password\|token\|secret\|key" --include="*.ts" src/data/
   ```

3. **Review** — Manual check of:
   - `src/data/*.ts` — test data modules for real vs. synthetic credentials
   - `src/api/services/**/*.ts` — auth token storage and cross-test sharing patterns
   - `src/config/environment.ts` — env var loading, no fallback to real credentials
   - `.github/workflows/*.yml` — secret references, workflow permissions
   - Any file using `page.evaluate()` — string interpolation risk

4. **Classify** — Rate severity using CVSS. For this project:
   - **Critical**: Real credentials committed to source or git history
   - **High**: `npm audit` high-severity CVE in a dependency; auth tokens logged in plaintext
   - **Medium**: `page.evaluate()` with unsanitized string interpolation; overly permissive workflow `permissions`
   - **Low**: Synthetic test data that looks too realistic; missing `.env.*` in `.gitignore`

5. **Report** — Load `references/report-template.md`. Adapt section titles to this project's areas: `frontsite`, `admin`, `ecommerce`, `api`.

## Project-Specific Vulnerability Patterns

### 1. Committed Credentials in Test Data

```ts
// CRITICAL — real-looking credentials in src/data/
export const AdminData = {
  user: { email: 'admin@company.com', password: 'RealPassword123!' }
};

// Correct — obviously synthetic
export const AdminData = {
  user: { email: 'admin@example.com', password: 'TestPass123!' }
};
```

### 2. Unsafe `page.evaluate()` with Template Literals

```ts
// HIGH — string interpolation in browser eval (equivalent to eval())
await this.page.evaluate(`document.querySelector('${selector}').click()`);

// Correct — pass data as argument, never interpolate
await this.page.evaluate((sel) => {
  document.querySelector(sel)?.click();
}, selector);
```

### 3. Auth Tokens Logged via logger.*

```ts
// HIGH — token visible in test-execution.log and HTML report
logger.action('Set auth header', `Bearer ${token}`);

// Correct — redact sensitive values
logger.action('Set auth header', 'Bearer [REDACTED]');
```

### 4. API Token Leaked Across Tests via ApiClient.storeToken()

```ts
// MEDIUM — token key collision exposes one user's token to another test worker
ApiClient.storeToken('token', adminToken); // generic key shared across all users

// Correct — scope token keys by user/role
ApiClient.storeToken('admin-token', adminToken);
ApiClient.storeToken('editor-token', editorToken);
```

### 5. GitHub Actions Workflow Overpermissioned

```yaml
# MEDIUM — default GITHUB_TOKEN has write-all permissions
jobs:
  test:
    runs-on: ubuntu-latest
    # No permissions block = implicit write-all

# Correct — principle of least privilege
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      checks: write
```

### 6. .env Files Not Gitignored

```bash
# CRITICAL if .env.testing, .env.staging contain real credentials and are tracked
git ls-files .env* | grep -v ".env.example"
```

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Secret Scanning | `references/secret-scanning.md` | Scanning for leaked credentials, tokens, keys |
| SAST Tools | `references/sast-tools.md` | Running npm audit, eslint-plugin-security |
| Vulnerability Patterns | `references/vulnerability-patterns.md` | Reviewing page.evaluate(), deserialization, eval patterns |
| Report Template | `references/report-template.md` | Writing the final security report |
| Infrastructure Security | `references/infrastructure-security.md` | GitHub Actions pipeline and Docker runner security only |
| Penetration Testing | `references/penetration-testing.md` | Not applicable to this project — skip |

## Constraints

### MUST DO
- Check `src/data/` for realistic-looking credentials before anything else
- Run `npm audit` on every review
- Grep for `page.evaluate()` with string interpolation
- Check GitHub Actions workflows for `permissions` blocks
- Confirm `.env.*` files are in `.gitignore` and not tracked by git
- Provide file and line number for every finding
- Include remediation for each finding

### MUST NOT DO
- Apply SQL injection, XSS, IDOR, or CORS findings to test code — they don't apply
- Flag Playwright's own use of `evaluate()` as a vulnerability without inspecting string interpolation
- Recommend infrastructure/cloud security changes outside this repo's scope
- Test on production systems or the live application under test

## Output Format

Use `references/report-template.md` structure. Adapt scope to this project:

```
## Security Review Report — Playwright TypeScript Framework

### Executive Summary
[Overall risk level, count of findings by severity]

### Automated Scan Results
- npm audit: [X critical, Y high, Z moderate]
- Secret grep: [findings or "none detected"]

### Findings
[CRITICAL/HIGH/MEDIUM/LOW] — ID, Location (file:line), Description, Impact, Remediation

### Verdict
[ ] CLEAN — no issues found
[ ] LOW RISK — informational findings only
[ ] ACTION REQUIRED — fix before next deployment
[ ] CRITICAL — immediate action needed
```
