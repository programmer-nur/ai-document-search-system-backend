#!/bin/bash

# Simple API Testing Script
# Tests basic endpoints without full E2E flow

BASE_URL="${BASE_URL:-http://localhost:5000}"

echo "🧪 Testing API Endpoints"
echo "========================="
echo ""

# Health Check
echo "1. Health Check"
curl -s "$BASE_URL/health" | jq '.' || echo "Failed"
echo ""

# API Info
echo "2. API Info"
curl -s "$BASE_URL/api" | jq '.' || echo "Failed"
echo ""

echo "✅ Basic API tests complete"
echo ""
echo "For full E2E testing, run: ./scripts/test-e2e.sh"

