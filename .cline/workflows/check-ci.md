---
description: Investigate a CI pipeline failure — invokes devops-cicd-specialist for root-cause analysis
---

Investigate the CI failure.

**Steps:**

1. Gather local context:
   - Read `test-summary.txt` if it exists
   - Check `test-results/results.json` and `api-results/results.json` for failure details
   - Run `git log --oneline -5` to capture recent commits
   - Run `git status --short` for uncommitted changes

2. Invoke the **devops-cicd-specialist** agent with:
   - The report file paths above
   - Any GitHub Actions URL, build number, or workflow name provided
   - Recent commit context
   - Current `NODE_ENV` and branch

3. The specialist should:
   - Parse failure details from JSON/HTML reports
   - Classify each failure into one of: `TIMEOUT`, `SELECTOR_STALE`, `ASSERTION`, `NETWORK`, `AUTH`, `FLAKY`, `ENV_CONFIG`, `INFRA`
   - Recommend fixes per category

4. Based on the classification:
   - **SELECTOR_STALE / ASSERTION / FLAKY** → offer to run the `fix-test` workflow for each failing spec
   - **TIMEOUT** → check if it's a real timeout or infrastructure lag
   - **NETWORK / AUTH / ENV_CONFIG / INFRA** → report the environment action required and do NOT dispatch the healer

5. Return the full Build Briefing from the devops specialist to the user.
