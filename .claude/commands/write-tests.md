---
description: Write tests from a requirement or user story — invokes qa-orchestrator WORKFLOW-1
---

Invoke the **qa-orchestrator** agent to write automated tests for the following requirement:

$ARGUMENTS

**Instructions for the orchestrator:**

Use **WORKFLOW-1** (automation-test-architect → qa-code-reviewer).

Before dispatching the architect, read:
1. `src/config/base-test.ts` — existing UI fixtures
2. `src/api/ApiTest.ts` — existing API fixtures
3. `src/pages/` — existing page objects (do not recreate what exists)
4. `src/data/` — existing data modules (reuse if relevant)

Determine from the requirement whether this is:
- An **API test** → `tests/api/`, uses `apiTest as test` from `../../src/api/ApiTest`
- A **UI test** → `tests/{frontsite|admin|ecommerce}/`, uses `test` from `@config/base-test`

Include in the architect handoff:
- The full requirement text above
- The area (api/frontsite/admin/ecommerce)
- Existing page objects or service fixtures that should be reused
- Relevant existing data modules

After the architect creates files, dispatch **qa-code-reviewer** on all created/modified files. Report the reviewer verdict (APPROVED / CHANGES REQUIRED) to the user with any critical issues highlighted.
