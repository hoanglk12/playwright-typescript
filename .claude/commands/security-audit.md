---
description: Run a security audit on the project — invokes security-reviewer for a severity-rated report
---

Run a security audit.

Scope: $ARGUMENTS

**Steps:**

1. Determine scan scope from $ARGUMENTS:
   - **Empty / "full" / "all"** → scan the entire project: `src/`, `tests/`, `.github/workflows/`, `.env*`, `package.json`, `.claude/`
   - **"changes" / "branch" / "pr"** → run `git diff --name-only main...HEAD`, use changed files only, but ALWAYS include `package.json` and `.github/workflows/` regardless
   - **Specific paths provided** → use those paths, plus `package.json`

2. Invoke the **security-reviewer** agent with the resolved scope and these check categories:
   - **Committed secrets**: API keys, tokens, passwords, private keys in any file
   - **Vulnerable dependencies**: run `npm audit` and parse output for High/Critical CVEs in `package.json`
   - **Unsafe `page.evaluate()` patterns**: dynamic code injection with user-controlled input
   - **Sensitive data in logs**: passwords or tokens passed to `logger.*` methods
   - **GitHub Actions permissions**: over-broad workflow permissions, exposed secrets in logs, unpinned action versions
   - **`.env*` files**: check that no real secrets are committed (should reference env vars, not values)
   - **Test data**: verify all test credentials use fake/synthetic values (test@example.com pattern)

3. The reviewer produces a severity-rated report: **Critical / High / Medium / Low** with file:line references and remediation steps.

4. Return the full report to the user without interpretation.

5. If **Critical** or **High** findings exist:
   - Surface them clearly with the specific file:line locations
   - Ask: "Do you want me to fix these findings?" — **do NOT auto-fix**
   - Security remediation requires explicit user approval before any changes

**Note:** This command is audit-only. No files are modified by the security-reviewer.
