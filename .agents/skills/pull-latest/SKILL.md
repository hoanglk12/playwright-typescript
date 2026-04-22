---
name: pull-latest
description: Pulls the latest code from the remote repository.
use_when: Use when the user says "get latest", "sync code", or "pull changes".
disable-model-invocation: true
---

# Pull Latest Code

This skill ensures your local branch is synchronized with the remote.

1. **Check Status**: Run `git status` to ensure the working directory is clean.
2. **Fetch**: Run `git fetch --all` to get the latest remote state.
3. **Identify Branch**: Determine the current branch with `git branch --show-current`.
4. **Pull**: Run `git pull origin <branch_name>`.
5. **Verify**: Run `git log -1` to show the latest commit.

If there are merge conflicts, immediately alert the user and do not proceed with automatic fixes unless asked.
