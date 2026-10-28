---
name: lightrag-endpoint-host-masking
description: "start-rag.bat launches LightRAG via scripts/lightrag-server-masked.py, which masks *_BINDING_HOST hostnames as *** in console + lightrag.log; relies on LightRAG internals, so re-verify after every upgrade; old log lines and /health still expose the host"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-10-29
---

## What

Since 2026-10-29, `scripts/start-rag.bat` runs `python scripts\lightrag-server-masked.py` instead of `lightrag-server`. The wrapper replaces the hostname of every `*_BINDING_HOST` env var (LLM, embedding, rerank, per-role) with `***`. The output then reads `https://***/v1` in both the console and `lightrag.log`. The bind address `127.0.0.1` is deliberately left visible.

LightRAG 1.5.7 has no built-in option to hide the endpoint host. It prints the host in the splash `Embedding Configuration → Host:` line and in the per-role `Role LLM Configuration … host=` log lines.

**Why:** the user asked for the endpoint host (the ShopAIKey proxy) to be masked whenever the server starts.

**How to apply:** the wrapper depends on three LightRAG/ascii_colors internals that an upgrade can change without any error:
- the `lightrag-server` entry point is `lightrag.api.lightrag_server:main` (check `lightrag_hku-*.dist-info/entry_points.txt`)
- `ascii_colors` binds `sys.stdout` as a default argument at import time, so the stdout/stderr proxy must be installed before lightrag is imported
- the log handlers format through `logging.Formatter.format`

After any LightRAG upgrade (see [[lightrag-1.5.4-upgrade-completed]], [[lightrag-uv-managed-venv]]), start a throwaway instance with a different `--port` and a scratch `--working-dir`, `--input-dir` and `LOG_DIR`. Count occurrences of the real hostname in its console and `lightrag.log`; it should be 0. Count `***` lines; there should be at least 1. Never start a second instance against the live `.lightrag` working dir.

## Still exposed (not changed)

- The root `lightrag.log` written before 2026-10-29 still holds about 216 unmasked `host=` lines. Scrubbing them was offered, not done.
- `/health` still returns `llm_binding_host` and `embedding_binding_host`, which `check_lightrag_health` and the sync-status hook can see.
- `docs/technical-research/lightrag-memory-guide.html` still shows a bare `lightrag-server ^` start command.
