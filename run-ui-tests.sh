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

echo "Environment: $ENV"
echo "Workers: $WORKERS"
echo ""

export API_ENV=$ENV
npx playwright test --config=playwright.config.ts --workers=$WORKERS
