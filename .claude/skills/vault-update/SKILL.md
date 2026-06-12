---
name: vault-update
description: Fetch a Jira issue or Confluence page and save it as a typed memory vault note, then sync to LightRAG.
use_when: Use when the user says "update vault from Jira", "add this Confluence page to memory", "save this issue to the vault", "update knowledge from PROJ-123", or provides any Jira key or Confluence URL.
---

# Vault Update

Invoke the `vault-updater` agent with the source the user specified.

Pass through the Jira key, Confluence URL, page ID, or search term exactly as the user gave it.

The agent will:
1. Fetch the content from Atlassian (Jira or Confluence)
2. Decide what is worth keeping as durable knowledge
3. Write a formatted vault note to `memory-vault/20-memory/{type}/`
4. Run `scripts/sync-vault-to-lightrag.mjs` to push the note into LightRAG

If the user did not specify a source, ask: "Which Jira issue key or Confluence page should I fetch?"
