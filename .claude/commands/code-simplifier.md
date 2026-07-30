---
description: Simplify code for clarity and consistency — invokes the code-simplifier plugin agent (opus)
---

Invoke the **code-simplifier:code-simplifier** agent to simplify and refine code without changing behavior.

Target: $ARGUMENTS

**Steps:**

1. Resolve target files:
   - If `$ARGUMENTS` specifies file paths, use those exactly.
   - If `$ARGUMENTS` is empty, `branch`, or `changes`: run `git diff --name-only main...HEAD`, filter to `.ts`/`.tsx` files, and use those.
   - If no files resolve, report "No files to simplify" and stop.

2. Dispatch the **code-simplifier:code-simplifier** agent (Agent tool, `subagent_type: "code-simplifier:code-simplifier"`) with the resolved file list, plus:
   - Preserve functionality exactly — simplification only, no behavior changes.
   - Respect this project's conventions while simplifying:
     - `BasePage` helper composition (`this.elements`, `this.waits`, etc.) — never introduce direct `page.locator()` / `page.click()`
     - Locators stay `private readonly` class fields, never inlined
     - No comments that restate the code (see CLAUDE.md comment policy)
     - Preserve existing test names (`TC_XX` / `E2E-{DOMAIN}-{NNN}`) and import rules (`@config/base-test` for UI, `../../src/api/ApiTest` for API)

3. After the agent finishes, run `npm run lint` to confirm no type errors were introduced.

4. Report to the user: files touched, a short summary of what was simplified, and the lint result.

**Examples:**

```
/code-simplifier src/pages/frontsite/home-page.ts
/code-simplifier branch
```

Quality pass only — it does not hunt for bugs (use `/review` for that) and does not fix tracked debt items (use `/fix-debt` for that).
