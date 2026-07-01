#!/bin/bash
ENV=${1:-testing}
MODE=${2:-parallel}  # parallel or serial

if [ "$MODE" = "serial" ]; then
    echo "Running UI tests in SERIAL mode"
    WORKERS=1
else
    echo "Running UI tests in PARALLEL mode"
    WORKERS=${3:-4}
fi

SHARD=${4:-}

echo "Environment: $ENV"
echo "Workers: $WORKERS"
[ -n "$SHARD" ] && echo "Shard: $SHARD"
echo ""

export API_ENV=$ENV
if [ -n "$SHARD" ]; then
    npx playwright test --config=playwright.config.ts --workers=$WORKERS --shard=$SHARD
else
    npx playwright test --config=playwright.config.ts --workers=$WORKERS
fi
