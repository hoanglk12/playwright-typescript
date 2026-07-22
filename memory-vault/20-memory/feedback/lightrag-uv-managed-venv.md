---
name: lightrag-uv-managed-venv
description: ".lightrag-venv is uv-managed and has no pip module — use `uv pip install --python .lightrag-venv/Scripts/python.exe <pkg>`, not pip/python -m pip"
type: feedback
tags: [memory, feedback, lightrag]
last_verified: 2026-07-22
---

`.lightrag-venv` (Python 3.12.13 on this machine) was created by `uv` and does not contain a `pip` module — `python.exe -m pip show/install` fails with `No module named pip`. Only `pipmaster` (a different package, not a pip replacement) is present in site-packages.

**Why:** discovered while upgrading LightRAG per [[lightrag-1.5.4-upgrade-completed]] — the runbook's steps assumed a conventional `pip show`/`pip install` inside an activated venv, which don't work here.

**How to apply:** manage packages in this venv with `uv pip install --python .lightrag-venv/Scripts/python.exe "<package>==<version>"` (and `uv pip show`/`uv pip list` for inspection) instead of activating the venv and calling `pip` directly. Check the installed version via the `*.dist-info` folder name under `.lightrag-venv/Lib/site-packages/` when in doubt, since neither `pip show` nor the pin file (`scripts/lightrag-requirements.txt`) reliably reflects what's actually installed on a given machine.
