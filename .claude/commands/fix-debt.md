---
description: Fix technical debt issues from TECH_DEBT_REPORT.md — invokes technical-debt-fixer then qa-code-reviewer. Scope: DEBT-ID(s), phase:N, critical, or warning.
---

Fix technical debt from the audit report.

Scope: $ARGUMENTS

---

## Pre-flight

1. Verify `TECH_DEBT_REPORT.md` exists at the project root.
   If it does not exist, stop and tell the user: "No TECH_DEBT_REPORT.md found. Run `/tech-debt` first to generate the audit."

2. Read `TECH_DEBT_REPORT.md` to extract the DEBT items relevant to the scope below.

---

## Scope Resolution

Parse `$ARGUMENTS` to determine which DEBT items to fix:

| `$ARGUMENTS` form | Items to fix |
|---|---|
| `DEBT-NNN` or `DEBT-NNN,DEBT-MMM,...` | Exactly those items |
| `phase:1` / `phase-1` / `1` | All items under Phase 1 of the Remediation Roadmap |
| `phase:2` / `phase-2` / `2` | All items under Phase 2 |
| `phase:3` / `phase-3` / `3` | All items under Phase 3 |
| `critical` | All 🔴 Critical issues |
| `warning` | All 🟡 Warning issues |
| *(empty)* | Show a summary table of all DEBT items with their severity, file, and estimated hours — then stop and ask the user which scope to fix |

If `$ARGUMENTS` is empty or ambiguous, **do not fix anything** — show the summary and ask.

---

## Scope Preview (always show before dispatching)

Before invoking the fixer, output a table of exactly which DEBT items will be fixed:

```
## Scope: [resolved scope description]

| DEBT | Severity | Category | Files | Est. Hours |
|---|---|---|---|---|
| DEBT-002 | Critical | Import Convention | tests/api/api-mocking-examples.spec.ts | 0.5 h |
| DEBT-003 | Critical | API Pattern | 3 spec files | 0.5 h |
| DEBT-004 | Critical | TypeScript | src/data/services-az-data.ts | 0.5 h |

Total: ~1.5 hours
```

Then invoke the **technical-debt-fixer** agent.

---

## Dispatch

Invoke the **technical-debt-fixer** agent with:
- The resolved scope (comma-separated DEBT IDs or named phase/severity)
- The content of `TECH_DEBT_REPORT.md` (pass the full relevant sections so the agent has exact file paths and remediation recipes)
- A reminder of the top framework rules:
  - Import in UI tests: `@config/base-test`; in API tests: `../../src/api/ApiTest`
  - Page classes: extend `BasePage`, use helpers, never call `this.page.*` directly
  - Locators: `private readonly` class fields, `getByRole` preferred
  - API specs: `test.describe.configure({ mode: 'serial' })` mandatory

---

## Post-fix verification

After the fixer completes:

1. Invoke **qa-code-reviewer** on all `.ts` files that were modified by the fixer.
   Pass the list of changed files explicitly.

2. Report to the user:
   - Which DEBT items were fixed (from the fixer's Fix Report)
   - Which were skipped or had sanctioned exceptions
   - The `npm run lint` result
   - The qa-code-reviewer verdict (APPROVED / CHANGES REQUIRED)
   - Remaining open DEBT items not yet fixed

---

## Examples

```
/fix-debt DEBT-004
/fix-debt DEBT-002,DEBT-003,DEBT-004
/fix-debt phase:1
/fix-debt critical
/fix-debt warning
```

Start with `phase:1` or individual safe DEBT IDs (DEBT-002, DEBT-003, DEBT-004) before tackling
DEBT-001 (which touches many files) or DEBT-011 (CI workflows).
