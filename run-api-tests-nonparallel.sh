#!/bin/bash
ENV=${1:-testing}
echo "Running API tests in non-parallel mode with a single worker"
echo "Environment: $ENV"
echo ""
export API_ENV=$ENV
npm run test:api:serial
