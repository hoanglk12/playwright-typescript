---
description: Implement an approved Technical Research Report — invokes technical-implementation-agent then qa-code-reviewer + devops-cicd-specialist
---

Implement the approved technical change (provide the research report path or topic as argument).

**Pre-flight checks:**

1. Confirm a Technical Research Report exists for this change. If not referenced, STOP and ask the user to run the `research` workflow first and share approval.

2. Read the report to extract:
   - Recommended approach
   - Ordered implementation steps
   - Affected files and configs
   - Validation steps

3. Confirm the user has explicitly approved the report. If no approval signal in the conversation, STOP and ask: *"Has the Technical Research Report been reviewed and approved?"*

**Implementation:**

4. Invoke the **technical-implementation-agent** with:
   - Full report content (or file path if saved)
   - Confirmation that the user approved
   - Ordered implementation steps from the report
   - List of files/configs expected to change
   - Validation commands to run after changes

**Post-implementation verification:**

5. After the implementation agent completes, run in parallel:
   - Invoke **qa-code-reviewer** on all modified `.ts` files
   - Invoke **devops-cicd-specialist** to validate any modified CI/workflow files

6. Report to the user:
   - Summary of what was changed (files, deps, config)
   - qa-code-reviewer verdict: APPROVED / CHANGES REQUIRED
   - devops-cicd-specialist verdict on CI changes (if any)
   - Next steps (e.g. run `npm run lint`, push branch, open PR)

**Do NOT skip the approval gate in step 3, even if the user says "just do it".**
