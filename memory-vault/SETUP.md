# Memory Vault — New Machine Setup

This vault lives inside the repo at `memory-vault/`. Follow these steps after cloning on a new machine.

## Prerequisites

- **Node.js** ≥ 18 (ESM support required by the sync script)
- **Obsidian** (optional — for graph view and backlinks; the vault works as plain `.md` files without it)
- **Claude Code** CLI installed and authenticated

## Step 1: Bootstrap live memory

The vault is the source of truth. Populate Claude Code's live memory store from it:

```powershell
node scripts/init-memory-from-vault.mjs
```

This reads `memory-vault/20-memory/**/*.md` and `memory-vault/00-index.md`, then writes them into `~/.claude/projects/{encoded}/memory/`. Start a new Claude Code session after running it.

## Step 2: Open in Obsidian (optional)

1. Open Obsidian
2. **Open folder as vault** → select `memory-vault/` inside the repo
3. Graph view, backlinks, and property search are now available

The vault is pre-configured for wikilinks (`memory-vault/.obsidian/app.json`). No plugins required for basic use.

## Ongoing sync

**Automatic:** Claude writes notes directly to `memory-vault/20-memory/{type}/`. Each vault write triggers the PostToolUse hook (`sync-memory.js`), which pushes the vault to LightRAG. The Stop hook (`lightrag-sync-status.js`) runs the same sync after every turn to catch anything left over.

**Manual:**
```powershell
npm run sync:vault   # vault → LightRAG (node scripts/sync-vault-to-lightrag.mjs)
```

`scripts/sync-memory-to-vault.mjs` is a deprecated no-op. Don't run it.

## Vault structure

```
memory-vault/
├── 00-index.md                  ← Start here — links to every note
├── 20-memory/
│   ├── user/                    ← Who the user is, working style
│   ├── feedback/                ← Corrections and confirmed patterns
│   ├── project/                 ← Architecture, API quirks, active work
│   └── reference/               ← External system pointers
├── templates/
│   └── memory-note-template.md
├── .claude/
│   └── CLAUDE.md               ← Retrieval policy for Claude Code
├── .obsidian/
│   └── app.json
└── .gitignore
```

## How Claude uses the vault

Claude searches the vault using `Glob` and `Grep` on `memory-vault/20-memory/`. The retrieval policy in `memory-vault/.claude/CLAUDE.md` instructs Claude to:
- Search by type: `Glob memory-vault/20-memory/feedback/*.md`
- Search by tag: `Grep tags:.*graphql memory-vault/20-memory/`
- Full-text search: `Grep <keyword> memory-vault/20-memory/`

No MCP server or Obsidian app needs to be running for Claude to use the vault.

## Memory flow

```
Claude session writes → memory-vault/20-memory/{type}/
    ↓ PostToolUse hook (sync-memory.js) + Stop hook (lightrag-sync-status.js)
    ↓ both run scripts/sync-vault-to-lightrag.mjs
LightRAG knowledge graph
```

To bootstrap a new machine: `node scripts/init-memory-from-vault.mjs` (vault → live memory).
