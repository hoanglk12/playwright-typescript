#!/bin/bash
ENV=${1:-testing}
echo "Running API tests with 4 workers (one per brand), sequential within each spec"
echo "Environment: $ENV"
echo ""
export API_ENV=$ENV
npm run test:api
