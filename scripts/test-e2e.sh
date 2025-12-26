#!/bin/bash

# End-to-End Testing Script for AI Document Search System
# This script tests the complete flow from user registration to document search

set -e

BASE_URL="${BASE_URL:-http://localhost:5000}"
API_URL="${BASE_URL}/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_test() {
    echo -e "${YELLOW}▶ Testing: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

check_response() {
    local response="$1"
    local expected_status="$2"
    local description="$3"
    
    if echo "$response" | grep -q "\"success\":true" && echo "$response" | grep -q "\"statusCode\":$expected_status"; then
        print_success "$description"
        return 0
    else
        print_error "$description"
        echo "Response: $response"
        return 1
    fi
}

# Start testing
echo "=========================================="
echo "🧪 End-to-End Testing Script"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# 1. Health Check
print_test "Health Check"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health" || echo "")
if echo "$HEALTH_RESPONSE" | grep -q "\"status\":\"ok\""; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    echo "Response: $HEALTH_RESPONSE"
fi
echo ""

# 2. User Registration
print_test "User Registration"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!",
        "firstName": "Test",
        "lastName": "User"
    }' || echo "")

if check_response "$REGISTER_RESPONSE" "201" "User registration"; then
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    print_success "User ID: $USER_ID"
else
    # User might already exist, try login
    print_test "User might exist, trying login..."
fi
echo ""

# 3. User Login
print_test "User Login"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!"
    }' || echo "")

if check_response "$LOGIN_RESPONSE" "200" "User login"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    if [ -z "$TOKEN" ]; then
        TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    fi
    if [ -n "$TOKEN" ]; then
        print_success "Token obtained: ${TOKEN:0:20}..."
        export AUTH_TOKEN="$TOKEN"
    else
        print_error "Failed to extract token"
        echo "Response: $LOGIN_RESPONSE"
    fi
else
    print_error "Login failed - cannot continue"
    exit 1
fi
echo ""

# 4. Get Current User
print_test "Get Current User"
if [ -n "$AUTH_TOKEN" ]; then
    USER_RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" || echo "")
    check_response "$USER_RESPONSE" "200" "Get current user"
else
    print_error "No token available"
fi
echo ""

# 5. Create Workspace
print_test "Create Workspace"
WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{
        "name": "Test Workspace",
        "description": "Test workspace for E2E testing"
    }' || echo "")

if check_response "$WORKSPACE_RESPONSE" "201" "Create workspace"; then
    WORKSPACE_ID=$(echo "$WORKSPACE_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    if [ -n "$WORKSPACE_ID" ]; then
        print_success "Workspace ID: $WORKSPACE_ID"
        export WORKSPACE_ID="$WORKSPACE_ID"
    else
        print_error "Failed to extract workspace ID"
    fi
else
    print_error "Workspace creation failed"
    exit 1
fi
echo ""

# 6. Get Workspace
print_test "Get Workspace"
if [ -n "$WORKSPACE_ID" ] && [ -n "$AUTH_TOKEN" ]; then
    GET_WORKSPACE_RESPONSE=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" || echo "")
    check_response "$GET_WORKSPACE_RESPONSE" "200" "Get workspace"
fi
echo ""

# 7. Get Upload URL
print_test "Get Document Upload URL"
if [ -n "$WORKSPACE_ID" ] && [ -n "$AUTH_TOKEN" ]; then
    UPLOAD_URL_RESPONSE=$(curl -s -X GET "$API_URL/documents/workspaces/$WORKSPACE_ID/documents/upload-url?fileName=test.pdf&contentType=application/pdf" \
        -H "Authorization: Bearer $AUTH_TOKEN" || echo "")
    if check_response "$UPLOAD_URL_RESPONSE" "200" "Get upload URL"; then
        S3_KEY=$(echo "$UPLOAD_URL_RESPONSE" | grep -o '"s3Key":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
        print_success "S3 Key: $S3_KEY"
    fi
fi
echo ""

# 8. Create Document Record
print_test "Create Document Record"
if [ -n "$WORKSPACE_ID" ] && [ -n "$AUTH_TOKEN" ] && [ -n "$S3_KEY" ]; then
    DOCUMENT_RESPONSE=$(curl -s -X POST "$API_URL/documents/workspaces/$WORKSPACE_ID/documents" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"name\": \"Test Document\",
            \"originalName\": \"test.pdf\",
            \"type\": \"PDF\",
            \"mimeType\": \"application/pdf\",
            \"size\": 1024,
            \"s3Key\": \"$S3_KEY\",
            \"s3Bucket\": \"test-bucket\",
            \"s3Region\": \"us-east-1\"
        }" || echo "")
    
    if check_response "$DOCUMENT_RESPONSE" "201" "Create document"; then
        DOCUMENT_ID=$(echo "$DOCUMENT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
        if [ -n "$DOCUMENT_ID" ]; then
            print_success "Document ID: $DOCUMENT_ID"
            export DOCUMENT_ID="$DOCUMENT_ID"
        fi
    fi
fi
echo ""

# 9. Get Documents
print_test "Get Documents List"
if [ -n "$WORKSPACE_ID" ] && [ -n "$AUTH_TOKEN" ]; then
    DOCUMENTS_RESPONSE=$(curl -s -X GET "$API_URL/documents/workspaces/$WORKSPACE_ID/documents" \
        -H "Authorization: Bearer $AUTH_TOKEN" || echo "")
    check_response "$DOCUMENTS_RESPONSE" "200" "Get documents list"
fi
echo ""

# 10. Search (if document is processed)
print_test "Search Documents"
if [ -n "$WORKSPACE_ID" ] && [ -n "$AUTH_TOKEN" ]; then
    SEARCH_RESPONSE=$(curl -s -X POST "$API_URL/search/workspaces/$WORKSPACE_ID/search" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{
            "query": "test query",
            "limit": 10
        }' || echo "")
    check_response "$SEARCH_RESPONSE" "200" "Search documents"
fi
echo ""

# 11. Ask Question
print_test "Ask Question (Q&A)"
if [ -n "$WORKSPACE_ID" ] && [ -n "$AUTH_TOKEN" ]; then
    QUESTION_RESPONSE=$(curl -s -X POST "$API_URL/search/workspaces/$WORKSPACE_ID/question" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{
            "question": "What is this document about?",
            "limit": 5
        }' || echo "")
    check_response "$QUESTION_RESPONSE" "200" "Ask question"
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

