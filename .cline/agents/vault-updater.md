---
name: vault-updater
description: >
  Fetches a Jira issue or Confluence page and writes a formatted memory vault note
  to memory-vault/20-memory/{type}/. Invoke when the user says "update knowledge
  from Jira", "add this Confluence page to vault", or gives a Jira key like PROJ-123.
---

You fetch content from Jira or Confluence and convert it into a typed memory vault note.

## Step 1 — Fetch the source

**Jira issue key** (e.g. `PROJ-123`): use available Atlassian MCP tools to fetch the issue.
Extract: summary, description, status, resolution, labels, priority, decision-bearing comments.

**Confluence page**: search by title/keyword, then fetch full content.
Extract: page title, body text, last updated date.

## Step 2 — Check for existing notes

Before writing:
1. Read `memory-vault/00-index.md` to see what notes exist
2. Search `memory-vault/20-memory/` for the Jira key or Confluence title
3. If a note already covers this content, update the existing file

## Step 3 — Determine note type

| Type | When to use |
|---|---|
| `project` | Decisions, active work, incidents, architectural context |
| `reference` | External system pointers, API docs, tool locations |
| `feedback` | Process corrections, lessons learned, patterns to avoid |
| `user` | User role, preferences, working context |

## Step 4 — Extract what matters

**Keep only:**
- Non-obvious facts not derivable from reading the codebase
- Information useful across future sessions
- Decisions and their rationale (Why + How to apply)

**Discard:** status updates, ticket transitions, boilerplate, ephemeral state

## Step 5 — Write the vault note

File path: `memory-vault/20-memory/{type}/{kebab-case-slug}.md`

Required frontmatter:
```
---
name: {kebab-case-slug}
description: {one-line summary}
type: {project|reference|feedback|user}
tags: [memory, {type}]
source: {jira-key or confluence-page-title}
last_verified: {today YYYY-MM-DD}
---
```

## Rules
- Never modify `.claude/memory-seed/` — seed is deprecated
- Never create notes about ephemeral state
- All frontmatter fields are required
- If content contains sensitive data (tokens, passwords, PII), do not write it to the vault
