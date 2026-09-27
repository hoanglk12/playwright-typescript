---
name: lightrag-token-secret-rotation
description: "LightRAG TOKEN_SECRET in gitignored .lightrag.env was 22 bytes (PyJWT InsecureKeyLengthWarning); rotated 2026-09-27 to 64-char hex — hex only, because start-rag.bat's for /f loader mangles cmd metacharacters"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-09-27
---

## What happened

`lightrag-server` logged `InsecureKeyLengthWarning: The HMAC key is 22 bytes long ... below the minimum recommended length of 32 bytes for SHA256` from `.lightrag-venv\Lib\site-packages\jwt\api_jwt.py`. The key is `TOKEN_SECRET` on line 19 of `.lightrag.env` (project root, gitignored at `.gitignore:162`, untracked). It is the only source: `scripts/start-rag.bat` loads that file line by line, and `TOKEN_SECRET` is not set at the User, Machine or Process environment level.

On 2026-09-27 the value was replaced with `crypto.randomBytes(32).toString('hex')` (64 ASCII chars), generated and written inside a node script so the value never appeared in a command or transcript. The pre-rotation file was backed up to that session's scratchpad only, not the repo.

**Not yet confirmed end-to-end.** The fix only takes effect after a server restart (Ctrl+C, then `scripts\start-rag.bat`), which was left to the user. Any JWTs issued under the old key stop validating, so connected clients such as the LightRAG MCP may need to reconnect once.

**Why hex:** `start-rag.bat` does `for /f "usebackq eol=# tokens=1,* delims==" ... set "%%A=%%B"`. Characters like `%`, `!`, `^` and `&` can be mangled by cmd.exe during that `set`, and base64 adds `=`, `+` and `/`. Hex has no cmd metacharacters. PyJWT measures the encoded string's length, so 64 hex chars clears the 32-byte HS256 floor (RFC 7518 §3.2) by a wide margin.

**How to apply:**
- On any other machine that pulls the repo, `.lightrag.env` doesn't travel with git, so check `TOKEN_SECRET` length there too. Print only key names and lengths, never values.
- In auto mode, the classifier blocks both listing `lightrag` processes (command lines may carry secrets) and running a script that reads `TOKEN_SECRET` from `.lightrag.env`, even for verification. Don't retry either through another tool; hand the restart and the startup-output check to the user.
- `docs/technical-research/lightrag-memory-guide.html` (Error 7, commit `36fe1ac`) already documents the 32-byte requirement; this note adds the hex constraint and the fact that the rotation was applied on this machine.

Related: [[lightrag-1.5.4-upgrade-completed]], [[lightrag-uv-managed-venv]]
