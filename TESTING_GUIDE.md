# 🧪 End-to-End Testing Guide

This guide provides comprehensive instructions for testing the AI Document Search System end-to-end.

## 📋 Prerequisites

1. **Infrastructure Running**
   ```bash
   yarn docker:up  # PostgreSQL, Redis, Qdrant
   ```

2. **Database Setup**
   ```bash
   yarn db:migrate
   yarn db:seed  # Optional
   ```

3. **Environment Variables**
   - Create `.env` file with all required variables
   - Ensure AWS S3, OpenAI, and Qdrant are configured

4. **Services Running**
   ```bash
   # Terminal 1: API Server
   yarn dev

   # Terminal 2: Background Worker
   yarn worker
   ```

---

## 🚀 Quick Test (Automated Script)

Run the automated end-to-end test script:

```bash
# Make script executable (first time only)
chmod +x scripts/test-e2e.sh

# Run tests
./scripts/test-e2e.sh

# Or with custom base URL
BASE_URL=http://localhost:5000 ./scripts/test-e2e.sh
```

The script tests:
- ✅ Health check
- ✅ User registration
- ✅ User login
- ✅ Get current user
- ✅ Create workspace
- ✅ Get workspace
- ✅ Get upload URL
- ✅ Create document
- ✅ List documents
- ✅ Search documents
- ✅ Ask questions

---

## 📝 Manual Testing Steps

### 1. Health Check

```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

### 2. User Registration

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "id": "...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```

**Save the user ID for later tests.**

---

### 3. User Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "email": "test@example.com"
    }
  }
}
```

**Save the token as `TOKEN` for authenticated requests.**

---

### 4. Get Current User

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. Create Workspace

```bash
curl -X POST http://localhost:5000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Workspace",
    "description": "Workspace for testing"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Workspace created successfully",
  "data": {
    "id": "...",
    "name": "Test Workspace",
    "slug": "test-workspace",
    ...
  }
}
```

**Save the workspace ID as `WORKSPACE_ID`.**

---

### 6. Get Workspace

```bash
curl -X GET http://localhost:5000/api/workspaces/$WORKSPACE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

### 7. Add Workspace Member

```bash
# First, create another user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "member@example.com",
    "password": "Password123!",
    "firstName": "Member",
    "lastName": "User"
  }'

# Get the member user ID, then add to workspace
curl -X POST http://localhost:5000/api/workspaces/$WORKSPACE_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "MEMBER_USER_ID",
    "role": "MEMBER"
  }'
```

---

### 8. Get Upload URL

```bash
curl -X GET "http://localhost:5000/api/documents/workspaces/$WORKSPACE_ID/documents/upload-url?fileName=test.pdf&contentType=application/pdf" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Upload URL generated successfully",
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "s3Key": "workspaces/.../documents/...",
    "expiresIn": 3600
  }
}
```

**Save the `s3Key` for document creation.**

---

### 9. Upload File to S3

```bash
# Use the uploadUrl from previous step
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary "@path/to/test.pdf"
```

**Note:** You need a test PDF file for this step.

---

### 10. Create Document Record

```bash
curl -X POST http://localhost:5000/api/documents/workspaces/$WORKSPACE_ID/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Document",
    "originalName": "test.pdf",
    "type": "PDF",
    "mimeType": "application/pdf",
    "size": 1024,
    "s3Key": "SAVED_S3_KEY",
    "s3Bucket": "your-bucket-name",
    "s3Region": "us-east-1"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Document created successfully",
  "data": {
    "id": "...",
    "name": "Test Document",
    "ingestionStatus": "PENDING",
    ...
  }
}
```

**Save the document ID as `DOCUMENT_ID`.**

**Note:** The document will be automatically queued for ingestion. Check the worker logs to see processing.

---

### 11. Check Document Status

```bash
curl -X GET http://localhost:5000/api/documents/$DOCUMENT_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Wait for ingestion to complete** (check `ingestionStatus` field):
- `PENDING` → `PARSING` → `CHUNKING` → `EMBEDDING` → `INDEXING` → `COMPLETED`

---

### 12. List Documents

```bash
curl -X GET "http://localhost:5000/api/documents/workspaces/$WORKSPACE_ID/documents?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 13. Search Documents

```bash
curl -X POST http://localhost:5000/api/search/workspaces/$WORKSPACE_ID/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "your search query",
    "limit": 10
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Search completed successfully",
  "data": {
    "results": [
      {
        "chunkId": "...",
        "documentId": "...",
        "documentName": "...",
        "content": "...",
        "score": 0.95
      }
    ],
    "total": 1,
    "query": "your search query"
  }
}
```

---

### 14. Ask Question (Q&A)

```bash
curl -X POST http://localhost:5000/api/search/workspaces/$WORKSPACE_ID/question \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "question": "What is this document about?",
    "limit": 5
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Question answered successfully",
  "data": {
    "answer": "Based on the documents...",
    "sources": [...],
    "query": "What is this document about?",
    "metadata": {
      "model": "gpt-3.5-turbo",
      "tokensUsed": 150
    }
  }
}
```

---

### 15. Get Query History

```bash
curl -X GET "http://localhost:5000/api/search/workspaces/$WORKSPACE_ID/queries?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔍 Testing Document Ingestion Pipeline

### Monitor Worker Logs

Watch the worker terminal for:
1. Job received
2. File download from S3
3. Document parsing
4. Text chunking
5. Embedding generation
6. Vector storage in Qdrant
7. Database updates

### Verify in Database

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/ai_document_search

# Check document status
SELECT id, name, "ingestionStatus", "chunkCount", "embeddingCount" 
FROM documents 
WHERE "workspaceId" = 'YOUR_WORKSPACE_ID';

# Check chunks created
SELECT COUNT(*) FROM chunks WHERE "documentId" = 'YOUR_DOCUMENT_ID';

# Check query history
SELECT * FROM queries WHERE "workspaceId" = 'YOUR_WORKSPACE_ID' ORDER BY "createdAt" DESC LIMIT 10;
```

### Verify in Qdrant

```bash
# Check collection exists
curl http://localhost:6333/collections/workspace_YOUR_WORKSPACE_ID

# Check points count
curl http://localhost:6333/collections/workspace_YOUR_WORKSPACE_ID | jq '.result.points_count'
```

---

## 🐛 Troubleshooting

### Health Check Fails

- **Database not connected**: Check PostgreSQL is running and `DATABASE_URL` is correct
- **Redis not connected**: Check Redis is running and connection settings

### Authentication Fails

- **Token expired**: Login again to get new token
- **Invalid token**: Check JWT_SECRET matches between requests

### Document Ingestion Fails

- **Worker not running**: Start worker with `yarn worker`
- **S3 access denied**: Check AWS credentials
- **OpenAI API error**: Check API key and quota
- **Qdrant connection error**: Check Qdrant is running

### Search Returns No Results

- **Document not processed**: Wait for ingestion to complete
- **No embeddings**: Check OpenAI API key and worker logs
- **Qdrant empty**: Verify vectors were stored

---

## 📊 Test Coverage Checklist

- [ ] Health check endpoint
- [ ] User registration
- [ ] User login
- [ ] Password change
- [ ] Workspace CRUD
- [ ] Workspace member management
- [ ] Document upload URL generation
- [ ] Document creation
- [ ] Document ingestion (worker)
- [ ] Document status tracking
- [ ] Document search (hybrid)
- [ ] Q&A functionality
- [ ] Query history
- [ ] Error handling
- [ ] Rate limiting
- [ ] Workspace isolation

---

## 🎯 Performance Testing

### Test Search Latency

```bash
time curl -X POST http://localhost:5000/api/search/workspaces/$WORKSPACE_ID/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "test", "limit": 10}'
```

**Target**: < 2 seconds for search queries

### Test Q&A Latency

```bash
time curl -X POST http://localhost:5000/api/search/workspaces/$WORKSPACE_ID/question \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "What is this about?", "limit": 5}'
```

**Target**: < 3 seconds for Q&A responses

---

## ✅ Success Criteria

All tests pass when:
1. ✅ Health check returns `status: "ok"`
2. ✅ User can register and login
3. ✅ Workspace can be created and accessed
4. ✅ Document can be uploaded and processed
5. ✅ Search returns relevant results
6. ✅ Q&A generates accurate answers
7. ✅ All services (DB, Redis, Qdrant) are connected

---

**Happy Testing! 🚀**

