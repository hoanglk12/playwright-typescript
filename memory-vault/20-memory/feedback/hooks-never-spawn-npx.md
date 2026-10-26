---
name: hooks-never-spawn-npx
description: "Hook scripts must not call spawnSync('npx', ...) — on Windows it fails with ENOENT because npx is npx.cmd, and the failure is silent; run the package's JS entry point with process.execPath, or require() the library in-process"
type: feedback
tags: [memory, feedback, hooks, claude-code, windows]
last_verified: 2026-10-26
---

**Rule:** inside a hook script (or a `node -e` hook), never start a tool with `spawnSync('npx', [...])`. Run the package's own entry point with `process.execPath` instead (`node_modules/@playwright/test/cli.js`, `node_modules/prettier/bin/prettier.cjs`), or `require()` the library in-process (`js-yaml`'s `loadAll`). Shell-form hook commands in settings.json (`npx tsc --noEmit` run by bash) are fine, because bash resolves `npx.cmd`.

**Why:** on Windows, npx is the batch file `npx.cmd`. Node's `spawnSync` without a shell only resolves `.exe`/`.com`, so it returns `status: null, error.code: 'ENOENT'` (verified on Node v24.17.0, 2026-10-26). Newer Node versions also refuse to start `.cmd` files without `shell: true` (EINVAL). Three hooks failed this way, and none of them ever reported it:
- **Prettier on edit:** never formatted a file. `|| true` hid the failure. The hook was removed rather than fixed, because Prettier would rewrite 119 of 152 tracked `.ts` files on first touch, which goes against the surgical-edit rule.
- **YAML check:** `null !== 0` took the error branch, so every valid `.yml` edit showed "YAML syntax error … undefined". It is now `.claude/hooks/yaml-check.js`.
- **Changed-spec Stop runner:** never ran a test, and exited 2 (asyncRewake) at the end of every turn while any spec was dirty. It is now `.claude/hooks/run-changed-specs.js`.

**Don't fix it with `shell: true` plus an args array.** Node 24 emits DEP0190 for that, and the args are joined without quoting, which breaks on paths with spaces such as `Guideline/AI Instructions/`. `post-tool-batch.js` and `post-tool-use-failure.js` use `shell: true` with fixed args (`npx tsc --noEmit`), which is why they work.

**How to apply:**
- When writing or reviewing a hook, grep for `spawnSync('npx'` and `spawn('npx'`.
- Test a hook by piping sample JSON into the exact command, and check for `r.error`, not just `r.status`. A silent `|| true` wrapper hides exactly this class of bug.
- A spawned tool's failure should either reach Claude (stderr with exit 2, or `additionalContext`) or be deliberately ignored. It should never be an accidental no-op.

**run-changed-specs.js design (2026-10-26):** API specs run with `--config=api.config.ts --project=pla-au --project=misc-api`, because `playwright.config.ts` ignores `**/api/**` and `--project=chromium` alone gave "No tests found". `security-posture.spec.ts` is excluded from `api.config.ts` on purpose, so it runs with `--config=security-patch.config.ts --project=pla-au` (8 tests). `--pass-with-no-tests` covers any spec no project matches. Each spec runs once per content hash (`.claude/.state/run-changed-specs.json`, saved before the run), so a spec failing against red staging doesn't rerun and re-wake Claude at every Stop. On failure, the last 60 lines go to stderr, because asyncRewake shows stderr to Claude and falls back to stdout only when stderr is empty.

Related: [[hook-commands-use-claude-project-dir]], [[advisor-nudge-mechanism]]
