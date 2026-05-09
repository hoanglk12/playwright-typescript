---
description: Code review changed files on current branch — invokes qa-code-reviewer (WORKFLOW-5)
---

Invoke the **qa-code-reviewer** agent to review test code quality.

Target: $ARGUMENTS

**Steps:**

1. If $ARGUMENTS specifies file paths, use those exactly.

2. If $ARGUMENTS is empty or says "branch" / "changes":
   - Run `git diff --name-only main...HEAD` to get changed files
   - Filter to `.ts` files only
   - If no changed `.ts` files found, report "No TypeScript changes on this branch."

3. Dispatch **qa-code-reviewer** with the file list and instruct it to check all categories:

   **For all files:**
   - Import conventions (@config/base-test for UI, ../../src/api/ApiTest for API)
   - Page object architecture (BasePage helpers, private readonly locators at class level)
   - Test structure (TC_XX format, createTestLogger, logger.step/verify/action)
   - Test data (typed interfaces, no hardcoded strings in specs)
   - Timeouts (TIMEOUTS.* constants, no magic numbers)
   - TypeScript quality (no `any`, explicit return types, named interface annotations)
   - Assertions (specific matchers, soft assertions for multi-checks, hard for preconditions)
   - Reliability (no waitForTimeout, no test.only, no console.log)
   - Security (no committed secrets, fake test data only)
   - File placement (correct directories)
   - Dead code (unused imports, orphaned methods, commented-out tests)

   **For files under tests/api/ additionally:**
   - `apiTest as test` import (NEVER @config/base-test)
   - `test.describe.configure({ mode: 'serial' })` present
   - ApiResponseWrapper chain used (not raw expect(response.status()))
   - assertNoErrors() before data assertions in GraphQL happy-path tests
   - No string-interpolated GraphQL variables
   - No hardcoded auth tokens

4. Pass the full review report to the user without interpretation. Include the verdict: APPROVED / APPROVED WITH COMMENTS / CHANGES REQUIRED.
