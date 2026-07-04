---
description: Fix technical debt issues from TECH_DEBT_REPORT.md — invokes technical-debt-fixer then qa-code-reviewer
---

Fix technical debt from the audit report.

## Pre-flight

1. Verify `TECH_DEBT_REPORT.md` exists at the project root. If not, stop and tell the user: "No TECH_DEBT_REPORT.md found. Run the technical-debt-agent first to generate the audit."

2. Read `TECH_DEBT_REPORT.md` to extract the DEBT items relevant to the scope.

## Scope Resolution

Parse the user's scope argument:

| Scope form | Items to fix |
|---|---|
| `DEBT-NNN` or `DEBT-NNN,DEBT-MMM` | Exactly those items |
| `phase:1` / `phase-1` / `1` | All items under Phase 1 |
| `phase:2` | All items under Phase 2 |
| `phase:3` | All items under Phase 3 |
| `critical` | All Critical issues |
| `warning` | All Warning issues |
| *(empty)* | Show summary table, stop and ask which scope to fix |

If scope is empty or ambiguous — **do not fix anything** — show the summary and ask.

## Scope Preview (always show before fixing)

Before invoking the fixer, output a table of exactly which DEBT items will be fixed:

```
## Scope: [resolved scope description]

| DEBT | Severity | Category | Files | Est. Hours |
|---|---|---|---|---|
| DEBT-002 | Critical | Import Convention | tests/api/spec.ts | 0.5 h |
```

## Dispatch

Invoke the **technical-debt-fixer** agent with:
- The resolved scope (comma-separated DEBT IDs or named phase/severity)
- Full relevant sections from `TECH_DEBT_REPORT.md`
- Framework reminders:
  - Import in UI tests: `@config/base-test`; in API tests: `../../src/api/ApiTest`
  - Page classes: extend `BasePage`, use helpers, never call `this.page.*` directly
  - Locators: `private readonly` class fields, `getByRole` preferred
  - API specs: `test.describe.configure({ mode: 'serial' })` mandatory

## Post-fix verification

After the fixer completes:
1. Invoke **qa-code-reviewer** on all `.ts` files that were modified
2. Report: which DEBT items were fixed, which were skipped, `npm run lint` result, reviewer verdict
