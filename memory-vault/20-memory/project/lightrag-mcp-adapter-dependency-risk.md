---
name: lightrag-mcp-adapter-dependency-risk
description: "lightrag-mcp==0.1.1's unbounded mcp dependency broke the adapter (fixed via mcp<2 pin, per upstream's own guidance); three of its document-mutation tools are now dead against LightRAG 1.5.7, evidence for treating the adapter as unmaintained"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-09-10
---

## What broke and why

`.mcp.json`'s `lightrag` MCP server stopped working: `ModuleNotFoundError: No module named
'mcp.server.fastmcp'`. Root cause: `lightrag-mcp==0.1.1` (the only version ever published to PyPI)
declares `Requires-Dist: mcp>=1.6.0` with no upper bound. `uvx` has no lockfile and re-resolves
dependencies on every launch, so it picked up `mcp==2.2.0`, which renamed `FastMCP`→`MCPServer` and
broke the adapter's import.

**Fix:** added `--with "mcp<2"` to the `uvx` args in `.mcp.json`. This is not a workaround — the
MCP Python SDK's own v2.0.1 release notes say verbatim: "Ideally either pin `mcp<2` or upgrade to
2." Pinning is the documented migration path.

**Why this will recur:** `mcp` is not the only unbounded dependency. `lightrag-mcp`'s own
`pyproject.toml` also floats `httpx`, `pydantic`, and `attrs` with no upper bound. Any of these
libraries making a similarly disruptive breaking release (a common pattern for pydantic v1→v2 style
migrations) will silently break this adapter again the same way, since `uvx` re-resolves fresh each
launch rather than reusing a known-good resolution.

## Cascade found this session: three document tools are dead against 1.5.7

While upgrading the LightRAG backend from 1.5.4 to 1.5.7 ([[lightrag-1.5.4-upgrade-completed]]),
compared the adapter's cached source (`lightrag_mcp/server.py` + its generated OpenAPI client)
against the live 1.5.7 `/openapi.json` schema — not by invoking the MCP tools live, since the MCP
server registered in this session had launched before the `.mcp.json` fix landed and can't be
trusted as a test surface. Findings:

| MCP tool | HTTP route it calls | Status on 1.5.7 |
|---|---|---|
| `get_documents` | `GET /documents` | **Gone** — 405, replaced by `POST /documents/paginated` |
| `insert_file` | `POST /documents/file` | **Gone** — route removed entirely |
| `delete_by_doc_ids` | `DELETE /documents/{doc_id}` | **Never existed** on either 1.5.4 or 1.5.7 — the correct route is `DELETE /documents/delete_document` with body `{doc_ids: [...]}` |
| `query_document` | `POST /query` | Live, unchanged |
| `check_lightrag_health` | `GET /health` | Live, unchanged |
| `get_pipeline_status` | `GET /documents/pipeline_status` | Live, unchanged |

Two of the three broken tools worked fine against 1.5.4 — the 1.5.7 upgrade itself caused that
part of the breakage, not a pre-existing bug. `vault-updater.md` (the only agent that had these
three tools in its frontmatter) was updated to remove them and route sync through
`scripts/sync-vault-to-lightrag.mjs` instead, which already implements the correct routes plus the
delete-then-poll-then-reinsert sequencing needed to avoid a 409 race on LightRAG's async delete.

## Abandonment risk

Per the technical research this session: `lightrag-mcp` has had no commits since 2026-06-08, no
license file, and 2 unmerged PRs open since June 2026. This session's cascade finding — three of
its ~15 document tools already dead against the current LightRAG server, with no released fix —
is direct, empirical evidence that this specific abandonment risk has already materialized, not
just a hypothetical maintenance concern.

**Why:** the adapter's tool surface is generated against a specific LightRAG API version and does
not get updated as the backend evolves. Every backend upgrade is a potential fresh breakage for
whichever tools touch a changed route, with no upstream fix to pull.

**How to apply:** don't build new agent workflows on `mcp__lightrag__*` document-mutation tools
(insert/delete/list) — use the direct REST calls in `scripts/sync-vault-to-lightrag.mjs` instead,
which this repo controls and can fix immediately when a route changes. The read-only tools
(`query_document`, `check_lightrag_health`, `get_pipeline_status`) are lower-risk since their
routes are simpler and less likely to be restructured, but re-verify against
`/openapi.json` after any future LightRAG backend upgrade rather than assuming they still work.

Related: [[lightrag-1.5.4-upgrade-completed]], [[lightrag-agent-scoping-2026-08-05]], [[lightrag-uv-managed-venv]]
