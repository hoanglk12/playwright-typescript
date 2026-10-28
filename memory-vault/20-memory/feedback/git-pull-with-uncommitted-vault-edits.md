---
name: git-pull-with-uncommitted-vault-edits
description: "Plain git pull on main aborts with 'Your local changes ... would be overwritten by merge' when a session left vault edits (usually 00-index.md) that an incoming commit also touches. That's a check git runs before merging, not a conflict. Stash only the listed files, pull --ff-only, then stash pop."
type: feedback
tags: [memory, feedback, git, vault]
last_verified: 2026-10-29
---

## Pulling main when vault edits aren't committed yet

Both machines (`Lincoln.Pham` and `ACER`, see [[user_profile]]) commit vault notes straight to `main`, and nearly every new note adds a line to `memory-vault/00-index.md`. Sessions often leave a note and its index line uncommitted. So a plain `git pull` regularly stops with:

```
error: Your local changes to the following files would be overwritten by merge:
        memory-vault/00-index.md
Please commit your changes or stash them before you merge.
Aborting
```

On 2026-10-29 the user hit this and asked "but why", so explain it when it comes up. It isn't a merge conflict. Git won't write an incoming change over a file that has edits not yet in any commit, because if anything failed those edits would be gone. It aborts before touching anything, so the repo is unchanged and the pull can be retried safely. It lists only files changed both locally and by the incoming commits. A locally edited file the remote didn't touch, like `scripts/start-rag.bat` that day, isn't listed and doesn't block. An untracked file blocks only when an incoming commit adds a file at the same path.

**Why:** "Pull and resolve conflict" usually means this check, not a real `CONFLICT`. Real conflicts show up later, at `stash pop`. Explaining the difference stops the user from assuming their edits were at risk.

**How to apply:**
- Check first: `git status --short`, `git fetch`, `git log --oneline origin/main..HEAD` (any local commits mean no fast-forward), and `git diff --stat HEAD...origin/main` to see which incoming files overlap local edits.
- Stash only the overlapping tracked files: `git stash push -m "<why>" -- <paths>`, then `git pull --ff-only`, then `git stash pop`. The pop is a 3-way merge. On 2026-10-29 the two index inserts had one unchanged line between them and merged cleanly. If they had touched each other, the pop would have stopped with `CONFLICT` and git would have kept the stash. In that case, resolve the markers, then `git stash drop`.
- Afterwards, `grep '^<<<<<<<\|^>>>>>>>'` the touched files and tell the user whether a real conflict happened.
- One-step shortcut: `git pull --autostash`. The `Lincoln.Pham` machine runs Git 2.54, so the `merge.autoStash` config also works. Don't set it globally unless the user asks.
- Report incoming changes that undo a recent local commit. On 2026-10-29 the pull changed `.claude/agents/qa-orchestrator.md` back from `model: sonnet` (8a645ce) to `model: opus` (e6c1d82). The two machines had been switching the model back and forth (f248668 opus, 8a645ce sonnet, e6c1d82 opus).
