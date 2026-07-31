---
description: Run the multi-provider LLM Council (scripts/council/) on a question via OpenRouter — dry-run preview, then explicit user approval, then real run
---

Run the multi-provider LLM Council on the following question:

$ARGUMENTS

**This costs real money via OpenRouter.** It is a separate tool from the free all-Claude `llm-council` skill. Follow this two-step consent flow exactly — do not collapse it into one step, because the Bash tool is non-interactive and `scripts/council/index.mjs`'s own "Type SEND" prompt would hang forever waiting for input that never arrives.

**Step 1 — dry run.** `$ARGUMENTS` is one blob of text — if the user included flags like `--context=CLAUDE.md`, `--panel=quality`, or `--neutral` anywhere in it, pull those out and pass them as separate CLI flags. The remaining plain question text (flags removed) must be written to a temporary file using the Write tool, then passed to the script via `--question-file=<path>` — never as a positional argument inside a quoted shell string. **The question text must never be interpolated directly into a shell command string — always route it through `--question-file`.** Shape:

```bash
node scripts/council/index.mjs --question-file=<path to temp file> --dry-run [--context=... --panel=... --neutral ...]
```

Do nothing else at first. Do not add `--yes`. Do not proceed past this step automatically.

**Step 2 — surface the manifest.** Paste the full printed manifest verbatim into the chat: sources with byte counts and scrub-hit counts, the model list with provider families, the active provider policy (data_collection, zdr), and the cost estimate.

**Step 3 — stop and wait.** Do not run anything further. Wait for the user's next message.

Step 4 must not run without a user message approving it. Do not treat your own assessment that the plan "looks fine" as approval. If the user's next message asks a clarifying question, edits the question, or otherwise doesn't clearly approve, answer it and stay at Step 3 — do not advance.

**Step 4 — only after an explicit user approval message** (e.g. "yes", "send it", "go ahead"), re-run the identical command (same `--question-file` temp file, same flags) with `--yes` appended:

```bash
node scripts/council/index.mjs --question-file=<path to temp file> --yes [--context=... --panel=... --neutral ...]
```

**Step 5 — report back.** Once it completes, report the three output file paths (HTML report, transcript, run JSON) under `council-output/`, the real total cost printed in the summary, and any failed models.
