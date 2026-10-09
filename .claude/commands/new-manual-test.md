---
description: Scaffold a one-off manual-assist spec in tests/manual/ for a Jira/Xray case (run once, never committed, never in CI)
---

Create a manual-assist spec for: $ARGUMENTS

`$ARGUMENTS` starts with a Jira key (e.g. `GRA-6266`), optionally followed by notes. If there is no key, ask for one before creating anything.

Read `tests/manual/CLAUDE.md` and `tests/manual/_template.ts` first — they are the rules and the starting point. Never commit the spec, never add it to `playwright.config.ts`, never weaken the `.gitignore` entries.

## 1. Get the case

Fetch the ticket with `mcp__claude_ai_Atlassian__getJiraIssue` (`cloudId: "accentgr.atlassian.net"`, `responseContentFormat: "markdown"`, fields: summary, description, status, issuetype, labels, issuelinks). Xray Test tickets usually keep the steps in the Xray step grid, not the description. Find the steps in this order and stop at the first that has them:

1. The ticket description.
2. Local test-case JSON under `../../ManualTest/Tasks/**` (relative to the repo root; outside the repo, so it may not exist on every machine — skip to the next source if it doesn't). Match on the ticket summary: the Jira key itself usually is not in these files. Prefer the most recently modified revision of a file family.
3. The `read-xray-test-web` skill.
4. Ask the user.

Record which source was used — it goes in the header's `Steps source` line and in the report.

## 2. Decide the style

Default to manual-assist: the script sets up simulations and sign-in, `page.pause()` hands the UI steps to the tester, and automated checks run after Resume on what the network timeline proves. Automate a UI step fully only when its selectors have been confirmed against the live page in this session. Copy any simulation instructions from the ticket (Netify / `page.route` snippets) into the route setup.

## 3. Write the spec

Copy `_template.ts` to `tests/manual/gra-<ticket>-<slug>.spec.ts`, then:

- Fill the header — `How it works`, `To run it (PowerShell)`, `Optional env`, `Steps source` — exactly as `tests/manual/CLAUDE.md` describes.
- Replace every placeholder (`GRA-XXXX`, `GRAXXXX_*`, `<OperationName>`, `<…>`) and delete the parts the case does not need (e.g. the `simulate()` variants it never uses).
- Apply the writing rules in `tests/manual/CLAUDE.md`, especially: routes before navigation, prove the simulation fired before asserting an absence, unverified selectors as timeline markers only.

## 4. Verify

Run each, and report the result honestly:

- `npm run lint` passes.
- `npx playwright test --config=manual.config.ts --list tests/manual/<file>.spec.ts` lists the test.
- `git check-ignore -v tests/manual/<file>.spec.ts` shows it is ignored.

Do not launch the headed run yourself unless the user asks — it pauses for a human.

## 5. Report

Reply with the spec path, then the header's **How it works** and **To run it (PowerShell)** sections verbatim, then the optional env vars, the steps source, and every assumption still to confirm on the first run (op names, endpoints, account preconditions, whether the feature is deployed on staging).
