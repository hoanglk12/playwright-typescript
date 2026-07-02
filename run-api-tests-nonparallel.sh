#!/bin/bash
ENV=${1:-testing}
echo "Running API tests with 8 workers (one per brand+region), sequential within each spec"
echo "Environment: $ENV"
echo ""
export API_ENV=$ENV
npm run test:api
