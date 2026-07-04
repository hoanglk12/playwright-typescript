---
description: Research a technical topic, integration, or upgrade — produces a structured Technical Research Report
---

Research the following topic and produce a Technical Research Report.

**Instructions:**

Invoke the **technical-research-agent**. This agent researches only — it does NOT modify any code or configuration.

Before starting, orient the agent to the project:
1. Read `CLAUDE.md` — framework architecture, helper structure, config layout
2. Read `playwright.config.ts` and `api.config.ts` — current tooling and reporter setup
3. Read `package.json` — current dependencies and versions
4. Read `.github/workflows/` — CI pipeline structure

Common research categories:
- **Third-party integrations** (new tool, SDK, service)
- **Playwright upgrades** (version migration, new API, breaking changes)
- **Framework refactors** (scalability, architecture, new pattern)
- **CI/CD changes** (new pipeline, runner, caching strategy)
- **Security / compliance** (CVEs, dep audits, permission changes)

The report must include:
- **Summary** — what is being changed and why
- **Scope** — which files, configs, and workflows are affected
- **Options** — at least two approaches with trade-offs
- **Recommended approach** — with justification
- **Risk assessment** — breaking changes, rollback plan, side effects
- **Implementation steps** — ordered action list
- **Validation** — how to verify the change worked

**IMPORTANT:** Present the full report to the user and wait for explicit approval before any implementation. Do NOT invoke the technical-implementation-agent automatically.
