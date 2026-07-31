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
   - When invoked right after `automation-test-architect`, `playwright-test-generator`, `playwright-test-healer`, `technical-debt-fixer`, or `technical-implementation-agent` returns (see CLAUDE.md §7), `$ARGUMENTS` must be the exact file paths that agent reported creating or modifying — never `branch`/`changes`, since the working tree may hold unrelated uncommitted changes that agent didn't touch. These five agents cannot invoke this command themselves — they lack the `Skill`/`Agent` tool — so this invocation always comes from whoever dispatched them.

2. Before dispatching, read the current content of every resolved file and hold it — this is the rollback snapshot for step 3. Do not use `git checkout` for rollback: it would restore to last-commit state and could discard unrelated uncommitted work already in the tree, not just this command's own change.

3. Dispatch the **code-simplifier:code-simplifier** agent (Agent tool, `subagent_type: "code-simplifier:code-simplifier"`) with the resolved file list, plus:
   - Preserve functionality exactly — simplification only, no behavior changes.
   - Do not modify generated files, migrations, lockfiles, configuration, or structured data unless explicitly requested.
   - Respect this project's conventions while simplifying:
     - `BasePage` helper composition (`this.elements`, `this.waits`, etc.) — never introduce direct `page.locator()` / `page.click()`
     - Locators stay `private readonly` class fields, never inlined
     - No comments that restate the code (see CLAUDE.md comment policy)
     - Preserve existing test names (`TC_XX` / `E2E-{DOMAIN}-{NNN}`) and import rules (`@config/base-test` for UI, `../../src/api/ApiTest` for API)

4. After the agent finishes, run `npm run lint`.
   - If lint fails, restore every touched file to the content captured in step 2 (via the `Write` tool), and treat the result as **rolled back** — never leave a lint-broken file in place.
   - If lint passes, keep the simplified version.

5. Report to the user: files touched, a `git diff -- <files>` summary of what changed, and whether the result was **applied** (lint passed) or **rolled back** (lint failed, original restored).

**Examples:**

```
/code-simplifier src/pages/frontsite/home-page.ts
/code-simplifier branch
```

Quality pass only — it does not hunt for bugs (use `/review` for that) and does not fix tracked debt items (use `/fix-debt` for that). This is the project-aware, guardrail-injecting entry point for this repo; the generic built-in `/simplify` skill carries no project-specific guardrails and should not be used on framework code here — use `/code-simplifier` instead.
