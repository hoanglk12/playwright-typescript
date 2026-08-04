---
name: lightrag-agent-scoping-2026-08-05
description: "LightRAG query access deliberately scoped to 5 vault/context agents (qa-orchestrator, playwright-test-planner, technical-research-agent, memory-vault-curator, vault-updater), not all 19 .claude/agents/*.md definitions"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-08-05
---

## Decision

User asked to "force all agents use lightrag when the server is up." Before implementing, flagged
the tradeoff and the user confirmed a narrower scope via AskUserQuestion: only agents whose task
benefits from cross-note vault synthesis get a mandatory `mcp__lightrag__check_lightrag_health` →
`mcp__lightrag__query_document` (mode `"hybrid"`) step, with silent fallback to `Grep` over
`memory-vault/20-memory/` when the server is down.

**Agents updated (tools + inline workflow step):**
- `qa-orchestrator` — queries before selecting a workflow, to surface prior decisions/gotchas that should shape workflow choice or handoff context
- `playwright-test-planner` — queries the feature/area name before navigating, to fold known storefront gotchas into the plan
- `technical-research-agent` — queries the research topic (step 2a), to avoid re-deriving vendor evaluations or accepted-risk decisions already on record
- `memory-vault-curator` — uses it during semantic enrichment (Step 2) to find relationship-based wikilink candidates a plain Grep misses
- `vault-updater` — already had write-side LightRAG tools (`get_documents`/`delete_by_doc_ids`/`insert_file`); added `query_document` for relationship-aware duplicate detection before writing a new note (catches same content under a different Jira key/title)

**Why not all 19 agents:** LightRAG only indexes `memory-vault/20-memory/` notes, not source code
(see [[project_context_engineering]] / root `CLAUDE.md` Memory section). Code-only agents
(`qa-code-reviewer`, `playwright-test-healer`, `automation-test-architect`, `technical-debt-agent`,
`technical-debt-fixer`, `security-reviewer`, `devops-cicd-specialist`, `playwright-test-generator`,
`technical-implementation-agent`, `statusline-setup`) would gain a health-check + query round-trip
per invocation with nothing relevant for LightRAG to return.

## Naming inconsistency found (not fixed)

`memory-vault/.claude/CLAUDE.md` (the vault's own retrieval-policy doc) references the tool as
`mcp__lightrag__query`, while the project-root `CLAUDE.md`, `.claude/settings.json`'s permission
allowlist, and the pre-existing `vault-updater.md` all use `mcp__lightrag__query_document`. Went
with `query_document` for consistency with the allowlisted/already-in-use name. The vault doc's
`query` reference is stale and should be corrected if noticed again.

**How to apply:** if a future agent edit needs LightRAG query access, use
`mcp__lightrag__check_lightrag_health` + `mcp__lightrag__query_document` (mode `"hybrid"`), not
`mcp__lightrag__query` — and add the same health-check-first, silent-Grep-fallback pattern used
in the 5 agents above rather than a hard dependency on the server being up.

Related: [[lightrag-1.5.4-upgrade-completed]], [[lightrag-uv-managed-venv]]
