#!/bin/bash
# scripts/aider-cmd.sh
# Wrapper to execute Claude Code custom commands (.claude/commands/*.md) within Aider.

if [ -z "$1" ]; then
    echo "Usage: ./scripts/aider-cmd.sh <command-name> [arguments...]"
    echo "Example: ./scripts/aider-cmd.sh write-tests As a user, I want to filter products"
    echo ""
    echo "Available commands:"
    ls -1 .claude/commands/ | sed 's/\.md$//'
    exit 1
fi

CMD_NAME=$1
shift
CMD_ARGS="$*"

CMD_FILE=".claude/commands/${CMD_NAME}.md"

if [ ! -f "$CMD_FILE" ]; then
    echo "Error: Command file '$CMD_FILE' not found."
    echo "Available commands:"
    ls -1 .claude/commands/ | sed 's/\.md$//'
    exit 1
fi

# Use perl for robust replacement of the literal string '$ARGUMENTS' 
# with the provided arguments, preventing shell injection or regex issues.
# The result is piped directly into aider as an initial prompt.
perl -pe "s/\\\$ARGUMENTS/\Q$CMD_ARGS\E/g" "$CMD_FILE" | aider
