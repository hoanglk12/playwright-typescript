---
name: Context Engineering Setup
description: State of CLAUDE.md, skills, settings, and memory for this project as of 2026-04-22
type: project
tags: [memory, project]
last_verified: 2026-06-02
---

Context engineering reviewed and fully set up on 2026-04-22. Last synced: 2026-06-01.

- **CLAUDE.md**: Created at project root. Covers architecture, helper table, import rules, page object pattern, test structure, data conventions, API setup, run commands, env config, Firefox teardown note, logging, timeouts, and skills index.
- **Skills**: Consolidated. `.claude/skills/*.md` are now thin forwarding stubs (frontmatter + H1 + one delegation line). `.agents/skills/*/SKILL.md` is the single source of truth for all 20 skills. `pull-latest` was the only skill without an `.agents/` folder — one was created to make both layers symmetrical.
- **settings.json**: Created at `.claude/settings.json` with 9 read-only allowlist entries: `npx tsc --noEmit`, `mcp__context7__resolve-library-id`, `mcp__context7__query-docs`, and 6 Vercel MCP read tools.
- **settings.local.json**: Kept separate — only has Firefox MCP curl permissions (pre-existing).
- **Memory**: Initialized 2026-04-22. Expanded 2026-05-15 through 2026-06-01 with PLA API patterns, ecommerce PDP gotchas, CAPTCHA research notes, and 2026-06-01 refactors (`api-test-helpers.ts`, `smoke-helpers.ts`, `TestState` singleton, `createPlaTestData()` factory).
- **CLAUDE.md updates (2026-06-01)**: Added "Test naming conventions" section — `TC_XX - Description` for new tests, legacy patterns documented; also covers `E2E-{DOMAIN}-{NNN}-{site}` for ecommerce smoke.

**Why:** CLAUDE.md was missing, causing every conversation to start cold with no knowledge of the composition pattern or import conventions. Skills had 17 duplicate files with broken relative links. Settings had no allowlist.

**How to apply:** Framework conventions are in CLAUDE.md. If permission prompts are excessive, remind user to run `/fewer-permission-prompts`. Skills canonical content lives under `.agents/skills/` — edit there, not in `.claude/skills/`.
