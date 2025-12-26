# Prisma Schema Documentation

This document describes the database schema for the AI Document Search & Q&A System.

## Overview

The schema is designed for a multi-tenant SaaS application with the following key features:
- **Multi-tenant isolation** via Workspaces
- **Role-based access control** (RBAC)
- **Document management** with ingestion tracking
- **Vector search** integration with Qdrant
- **Audit logging** for compliance
- **Query analytics** for search history

## Models

### User
Represents system users with authentication and role management.

**Key Fields:**
- `email` - Unique email address (indexed)
- `password` - Hashed password
- `role` - System-wide role (USER, ADMIN, SUPER_ADMIN)
- `isActive` - Account status
- `emailVerified` - Email verification status

**Relations:**
- `workspaceMemberships` - Workspaces the user belongs to
- `queries` - Search queries made by the user
- `auditLogs` - Audit trail entries

### Workspace
Multi-tenant container for documents and users. Provides data isolation.

**Key Fields:**
- `name` - Workspace display name
- `slug` - URL-friendly identifier (unique, indexed)
- `settings` - JSON field for workspace-specific configuration
- `isActive` - Workspace status

**Relations:**
- `members` - Users in this workspace
- `documents` - Documents owned by this workspace
- `queries` - Search queries in this workspace
- `auditLogs` - Audit logs for this workspace

### WorkspaceMember
Junction table for many-to-many relationship between Users and Workspaces with role assignment.

**Key Fields:**
- `workspaceId` + `userId` - Composite unique constraint
- `role` - Workspace-specific role (OWNER, ADMIN, MEMBER, VIEWER)
- `invitedBy` - User who sent the invitation
- `joinedAt` - When user joined the workspace

**Indexes:**
- Composite unique on `[workspaceId, userId]`
- Indexed on `workspaceId`, `userId`, and `role` for fast lookups

### Document
Represents uploaded documents with full lifecycle tracking.

**Key Fields:**
- `name` - Display name
- `originalName` - Original filename
- `type` - Document type enum (PDF, DOCX, etc.)
- `size` - File size in bytes (BigInt)
- `status` - Current status (PENDING, UPLOADING, PROCESSED, etc.)
- `s3Key` - S3 object key (unique, indexed)
- `ingestionStatus` - Detailed ingestion pipeline status
- `chunkCount` - Number of chunks created
- `embeddingCount` - Number of embeddings generated
- `qdrantCollectionId` - Reference to Qdrant collection

**Status Flow:**
```
PENDING → UPLOADING → UPLOADED → PROCESSING → PROCESSED
                                    ↓
                                  FAILED
```

**Relations:**
- `workspace` - Owner workspace
- `chunks` - Text chunks extracted from document
- `queries` - Queries that returned this document

**Indexes:**
- Full-text search on `name` and `originalName`
- Indexed on `workspaceId`, `status`, `ingestionStatus`, `type`, `createdAt`

### Chunk
Text fragments extracted from documents for vector search.

**Key Fields:**
- `content` - Text content (full-text indexed)
- `contentHash` - Hash for deduplication
- `chunkIndex` - Order within document
- `pageNumber` - Page reference (for PDFs)
- `sectionTitle` - Contextual heading
- `qdrantPointId` - Vector point ID in Qdrant (unique)
- `hasEmbedding` - Whether embedding has been generated
- `embeddingModel` - Model used for embedding
- `tokenCount` - Token count for cost tracking

**Relations:**
- `document` - Parent document

**Indexes:**
- Full-text search on `content`
- Unique constraint on `[documentId, chunkIndex]`
- Indexed on `documentId`, `qdrantPointId`, `hasEmbedding`, `contentHash`

### Query
Stores search queries and Q&A interactions for analytics.

**Key Fields:**
- `type` - SEARCH or QUESTION
- `query` - User's query text (full-text indexed)
- `queryEmbedding` - Stored embedding for analytics
- `resultCount` - Number of results returned
- `topChunkIds` - Array of chunk IDs in results
- `topDocumentIds` - Array of document IDs in results
- `aiResponse` - AI-generated answer (for Q&A)
- `aiModel` - Model used for response
- `tokensUsed` - Token consumption
- `responseTime` - Query latency in milliseconds

**Relations:**
- `workspace` - Workspace where query was made
- `user` - User who made the query (nullable for anonymous)

**Indexes:**
- Full-text search on `query`
- Indexed on `workspaceId`, `userId`, `type`, `createdAt`

### AuditLog
Comprehensive audit trail for security and compliance.

**Key Fields:**
- `action` - Action performed (e.g., "document.upload")
- `resourceType` - Type of resource affected
- `resourceId` - ID of resource affected
- `details` - JSON field for additional context
- `ipAddress` - Client IP address
- `userAgent` - Client user agent

**Relations:**
- `workspace` - Workspace context (nullable)
- `user` - User who performed action (nullable)

**Indexes:**
- Composite index on `[resourceType, resourceId]`
- Indexed on `workspaceId`, `userId`, `action`, `createdAt`

## Enums

### UserRole
- `USER` - Standard user
- `ADMIN` - System administrator
- `SUPER_ADMIN` - Super administrator

### WorkspaceRole
- `OWNER` - Workspace owner (full control)
- `ADMIN` - Workspace administrator
- `MEMBER` - Regular member
- `VIEWER` - Read-only access

### DocumentStatus
- `PENDING` - Initial state
- `UPLOADING` - Currently uploading
- `UPLOADED` - Upload complete
- `PROCESSING` - Being processed
- `PROCESSED` - Processing complete
- `FAILED` - Processing failed
- `DELETED` - Soft deleted

### DocumentType
Supports: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, MD, CSV, OTHER

### IngestionStatus
- `PENDING` - Waiting to be processed
- `PARSING` - Extracting text
- `CHUNKING` - Creating chunks
- `EMBEDDING` - Generating embeddings
- `INDEXING` - Indexing in Qdrant
- `COMPLETED` - Ingestion complete
- `FAILED` - Ingestion failed

### QueryType
- `SEARCH` - Document search
- `QUESTION` - Q&A query

## Indexes & Performance

### Composite Indexes
- `WorkspaceMember`: `[workspaceId, userId]` (unique)
- `Chunk`: `[documentId, chunkIndex]` (unique)
- `AuditLog`: `[resourceType, resourceId]`

### Full-Text Search
Full-text search indexes are not directly supported in Prisma 7 with PostgreSQL. However, you can add PostgreSQL GIN indexes manually via SQL migrations for better search performance:

- `Document`: `name`, `originalName` (regular indexes added, GIN indexes available via SQL)
- `Chunk`: `content` (GIN index available via SQL migration)
- `Query`: `query` (GIN index available via SQL migration)

See `prisma/migrations/add-fulltext-indexes.sql` for PostgreSQL full-text search setup.

### Single Column Indexes
All foreign keys and frequently queried fields are indexed for optimal performance.

## Soft Deletes

The following models support soft deletes via `deletedAt`:
- `User`
- `Workspace`
- `WorkspaceMember`
- `Document`
- `Chunk`

Queries should filter by `deletedAt IS NULL` to exclude soft-deleted records.

## Data Types

- **String** - Standard text fields
- **BigInt** - For file sizes (supports large files)
- **DateTime** - Timestamps
- **Json** - Flexible metadata storage
- **String[]** - Array of strings (for query results)

## Best Practices

1. **Always filter by workspaceId** when querying documents/chunks to ensure multi-tenant isolation
2. **Use soft deletes** instead of hard deletes for audit compliance
3. **Index foreign keys** for join performance
4. **Use full-text indexes** for search functionality
5. **Store embeddings in Qdrant**, only keep reference IDs in PostgreSQL
6. **Use BigInt for file sizes** to support large files
7. **Track ingestion status** separately from document status for better observability

## Migration Commands

```bash
# Create a new migration
yarn prisma migrate dev --name migration_name

# Apply migrations in production
yarn prisma migrate deploy

# Reset database (development only)
yarn prisma migrate reset

# Generate Prisma Client
yarn prisma generate

# Open Prisma Studio
yarn prisma studio
```

