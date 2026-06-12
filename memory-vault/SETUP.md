# Memory Vault — New Machine Setup

This vault lives inside the repo at `memory-vault/`. Follow these steps after cloning the repo on a new machine.

## Prerequisites

- **Node.js** ≥ 18 (ESM support required by the sync script)
- **Obsidian** (optional — for the graph view and backlinks UI; the vault works as plain `.md` files without it)
- **Claude Code** CLI installed and authenticated

## Step 1: Populate the vault

The vault notes are generated — they are not committed to git (the seed files in `.claude/memory-seed/` are the source of truth). Run the sync script once after cloning:

```powershell
node scripts/sync-memory-to-vault.mjs
```

This reads `.claude/memory-seed/*.md`, normalizes frontmatter, and writes all notes into `memory-vault/20-memory/{type}/`. It is safe to run multiple times (idempotent).

**Expected output:**
```
[sync] memory-vault/00-index.md
[sync] memory-vault/20-memory/user/user_profile.md
[sync] memory-vault/20-memory/feedback/feedback_preferences.md
[sync] memory-vault/20-memory/feedback/ecommerce-pdp-page-gotchas.md
[sync] memory-vault/20-memory/project/project_context.md
[sync] memory-vault/20-memory/project/project_architecture.md
[sync] memory-vault/20-memory/project/project_context_engineering.md
[sync] memory-vault/20-memory/project/pla-api-testing.md
[sync] memory-vault/20-memory/project/technical_debt_phase1.md
Done — 9 note(s) synced.
```

## Step 2: Open in Obsidian (optional)

1. Open Obsidian
2. **Open folder as vault** → select `memory-vault/` inside the repo
3. Graph view, backlinks, and property search are now available

The vault is pre-configured for wikilinks (`memory-vault/.obsidian/app.json`). No plugins required for basic use.

## Step 3: Seed the live Claude memory (if on a brand-new machine)

The `memory-vault/` is the Obsidian-readable mirror. Claude Code's own live memory store is separate (`~/.claude/projects/.../memory/`). To seed it on a new machine:

```powershell
.\.claude\memory-seed\init-memory.ps1
```

This copies the seed files into the live memory directory Claude Code reads at session start.

## Ongoing sync

**Automatic:** The Stop hook in `.claude/settings.json` runs `sync-memory-to-vault.mjs` at the end of every Claude Code session. The vault stays current without manual intervention.

**Manual:** Run `/sync-vault` in a Claude Code session, or run the script directly:
```powershell
node scripts/sync-memory-to-vault.mjs
```

**When to re-run manually:** after pulling changes from main that include updates to `.claude/memory-seed/` files.

## Vault structure

```
memory-vault/
├── 00-index.md                  ← Start here — links to every note
├── 20-memory/
│   ├── user/                    ← Who the user is, working style
│   ├── feedback/                ← Corrections and confirmed patterns
│   ├── project/                 ← Architecture, API quirks, active work
│   └── reference/               ← External system pointers (empty)
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

## Updating memory

Memory flows in one direction: **Claude session → `.claude/memory-seed/` → vault**.

1. Claude updates memory during a session (writes to `~/.claude/projects/.../memory/`)
2. You commit the updated seed files from `.claude/memory-seed/` to git
3. On pull, run `node scripts/sync-memory-to-vault.mjs` (or let the Stop hook do it)

Do not edit notes directly in `memory-vault/20-memory/` — they are overwritten on every sync.
