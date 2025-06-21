#!/bin/bash
echo "Running API tests in non-parallel mode with a single worker"
echo ""
npx playwright test --config=api.config.ts --workers=1 --project=api
