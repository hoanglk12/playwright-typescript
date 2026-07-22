---
name: lightrag-1.5.4-upgrade-completed
description: "LightRAG memory-vault backend upgraded to 1.5.4 on this machine (E:\\OLDDATA\\...\\playwright-typescript); repo-side pin/script fixes were already committed, only per-machine steps remained"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-07-22
---

## What happened

`docs/technical-research/lightrag-1.5.4-upgrade-runbook.html` documented an upgrade "executed & verified" on 2026-07-21, on a different machine (`C:\Users\Lincoln.Pham\...\playwright-typescript`, per `memory-vault/.claude/CLAUDE.md`). The repo-side artifacts from that run (`scripts/lightrag-requirements.txt` pinning `lightrag-hku==1.5.4`, the `PYTHONIOENCODING=utf-8` fix in `scripts/start-rag.bat`, and the runbook itself) were committed in `33495c1`.

On **this** machine (`E:\OLDDATA\DATA\TESTING\AutomationTesting\playwright-typescript`, Windows user `ACER`), the two gitignored per-machine items called out in the runbook were still outstanding as of 2026-07-22:
- `.lightrag-venv` still had `lightrag_hku==1.5.2` installed (pin file existing in git does not auto-upgrade an already-created venv)
- root `.env` did not exist, which blocks/crashes `lightrag-server` startup on the >=1.5.3 multi-instance check

## What I did (2026-07-22)

1. Confirmed nothing was bound to port 9621
2. `.lightrag.bak-1.5.2` backup already existed — reused it, did not re-back-up
3. This venv is `uv`-managed (Python 3.12.13, no `pip` module inside it) — upgraded with `uv pip install --python .lightrag-venv/Scripts/python.exe "lightrag-hku==1.5.4"` (plain `pip show`/`pip install` fails inside this venv — see [[lightrag-uv-managed-venv]])
4. Created root `.env` with `LIGHTRAG_RUNTIME_TARGET=host`
5. Started via `scripts\start-rag.bat` — clean startup, no Unicode crash, banner showed `LightRAG Server v1.5.4/0313`
6. Validated `/health` (`core_version: 1.5.4`, `status: healthy`, pipeline fields intact) and `/documents` (processed statuses present)
7. Ran `node scripts/sync-vault-to-lightrag.mjs` — `0 new, 0 updated, 34 unchanged`, no errors

**Why:** the runbook's own per-machine gotcha section predicted exactly this — repo changes travel via git, but the venv install and the gitignored `.env` do not, so every machine that pulls the repo needs these two steps run locally.

**How to apply:** on any *other* machine that pulls this repo fresh, check `.lightrag-venv` actual installed version (`dist-info` folder name, since `pip` isn't available inside the venv) before assuming the pin file means it's already upgraded — it only affects fresh installs via `scripts/lightrag-requirements.txt`, not existing venvs.

## Still open / unaffected by this upgrade

- `mcp__lightrag__*` tools still have no backing registered MCP server (separate finding from the runbook, unrelated to the version bump) — vault sync itself is unaffected since it talks to the REST API directly via `scripts/sync-vault-to-lightrag.mjs`.
