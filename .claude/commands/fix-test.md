---
description: Fix a failing or flaky test — invokes playwright-test-healer then qa-code-reviewer
---

Fix the following failing test:

$ARGUMENTS

**Steps:**

1. Identify the spec file path. If $ARGUMENTS is a test name rather than a path, use Glob to find the file in `tests/`.

2. Verify the spec file exists.

3. Check for failure context:
   - Read `test-summary.txt` if it exists
   - Check `test-results/` for `.json` or error artifacts matching this spec

4. Determine the test area (api/frontsite/admin/ecommerce) from the file path.

5. Invoke the **playwright-test-healer** agent with:
   - Exact spec file path
   - Any error messages or stack traces from test-results/
   - The test area
   - For API tests: reminder that import must be from `../../src/api/ApiTest` and `test.describe.configure({ mode: 'serial' })` must be present

6. After the healer completes and reports what it fixed, invoke **qa-code-reviewer** on the modified files only.

7. Report to the user: what was broken, what was fixed, and the reviewer verdict.

If the healer cannot fix the issue (ENV_CONFIG, INFRA, NETWORK class failures), report the root cause and recommended environment action instead.
