---
description: Run a security audit on the project — invokes security-reviewer for a severity-rated report
---

Run a security audit.

**Steps:**

1. Determine scan scope from the argument:
   - **Empty / "full" / "all"** → scan entire project: `src/`, `tests/`, `.github/workflows/`, `.env*`, `package.json`
   - **"changes" / "branch" / "pr"** → run `git diff --name-only main...HEAD`, use changed files only, but ALWAYS include `package.json` and `.github/workflows/`
   - **Specific paths provided** → use those paths, plus `package.json`

2. Invoke the **security-reviewer** agent with the resolved scope and these check categories:
   - **Committed secrets**: API keys, tokens, passwords, private keys in any file
   - **Vulnerable dependencies**: run `npm audit` and parse for High/Critical CVEs
   - **Unsafe `page.evaluate()` patterns**: dynamic code injection with user-controlled input
   - **Sensitive data in logs**: passwords or tokens passed to `logger.*` methods
   - **GitHub Actions permissions**: over-broad workflow permissions, unpinned action versions
   - **`.env*` files**: check that no real secrets are committed
   - **Test data**: verify all test credentials use fake/synthetic values

3. The reviewer produces a severity-rated report: **Critical / High / Medium / Low** with file:line references and remediation steps.

4. Return the full report to the user without interpretation.

5. If **Critical** or **High** findings exist:
   - Surface them clearly with file:line locations
   - Ask: "Do you want me to fix these findings?" — **do NOT auto-fix**
   - Security remediation requires explicit user approval before any changes

**Note:** This workflow is audit-only. No files are modified by the security-reviewer.
