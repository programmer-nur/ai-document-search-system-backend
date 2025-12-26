# 🧠 AI Document Search & Q&A System - Backend

> A production-ready backend SaaS platform that enables teams to search and ask questions over large volumes of unstructured documents such as PDFs, spreadsheets, and presentations.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Use Cases](#use-cases)
- [Future Enhancements](#future-enhancements)

## 🎯 Overview

The AI Document Search & Q&A System is a backend-heavy SaaS platform designed to:

- **Handle thousands of messy documents** efficiently
- **Provide fast, accurate, and grounded answers** using AI
- **Avoid AI hallucinations** using hybrid retrieval (semantic + keyword)
- **Scale reliably** using asynchronous processing

This backend follows production-grade architecture used in enterprise AI platforms.

## ✨ Key Features

- ✅ **Non-blocking document ingestion** - Upload documents without blocking the UI
- ✅ **Accurate document parsing & chunking** - Supports PDF, DOCX, XLSX formats
- ✅ **Hybrid retrieval** - Combines semantic (vector) and keyword (BM25) search
- ✅ **Low-latency Q&A responses** - Optimized for 2-3 second query latency
- ✅ **Secure multi-tenant data isolation** - Workspace-based access control
- ✅ **Cost-efficient AI usage** - Optimized chunking and caching strategies
- ✅ **Asynchronous processing** - Background jobs using BullMQ and Redis
- ✅ **Production-ready error handling** - Comprehensive error management
- ✅ **Type-safe codebase** - Full TypeScript implementation

## 🛠 Technology Stack

### Core
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Primary database

### Infrastructure
- **Redis (BullMQ)** - Background jobs & caching
- **AWS S3** - Document storage
- **Docker** - Service orchestration

### AI & Search
- **OpenAI Embeddings** - Vector embeddings generation
- **Qdrant Vector Database** - Vector storage and search
- **BM25 Keyword Search** - Traditional keyword matching
- **Hybrid Ranking (RRF / Weighted)** - Combined search results

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Morgan** - HTTP request logging
- **ts-node-dev** - Development server with hot reload

## 🏗 Architecture

```
Client (Next.js)
    ↓
API Gateway (Express)
    ↓
Authentication & RBAC
    ↓
Document Service
    ↓
Redis Queue (BullMQ)
    ↓
Ingestion Worker
    ├── File Parsing
    ├── Text Chunking
    ├── Embedding Generation
    ├── Vector Storage
    ↓
Search & Q&A Service
    ├── Hybrid Retrieval
    ├── Context Assembly
    ├── LLM Answer Generation
```

## 📁 Project Structure

```
src/
├── app.ts                 # Express app configuration
├── server.ts             # Server entry point
├── router.ts             # Main API router
├── config/
│   └── env.ts           # Environment variables
├── middlewares/
│   ├── errorHandler.ts  # Global error handler
│   ├── logger.ts        # Morgan logging middleware
│   ├── notFound.ts      # 404 handler
│   └── index.ts         # Middleware exports
├── modules/              # Feature modules (auth, documents, etc.)
│   └── [module-name]/
│       ├── [module].controller.ts
│       ├── [module].service.ts
│       ├── [module].route.ts
│       ├── [module].interface.ts
│       └── [module].types.ts
├── utils/
│   ├── catchAsync.ts    # Async error wrapper
│   ├── sendResponse.ts  # Standardized response formatter
│   ├── apiError.ts      # Custom error classes
│   ├── logger.ts        # Logger utility
│   ├── pagination.ts    # Pagination helpers
│   ├── pick.ts          # Object key picker
│   └── index.ts         # Utility exports
├── queues/              # BullMQ queue definitions
├── workers/             # Background job workers
└── prisma/
    └── schema.prisma    # Database schema
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Redis (v6 or higher)
- Yarn or npm
- AWS Account (for S3)
- OpenAI API Key
- Qdrant instance (local or cloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-document-search-system-backend
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   yarn prisma generate
   
   # Run migrations
   yarn prisma migrate dev
   ```

5. **Start the development server**
   ```bash
   yarn dev
   ```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_document_search

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

## 🗄 Database Setup

### Prisma Configuration

This project uses Prisma 7, which requires the database URL to be configured in `prisma.config.ts` instead of `schema.prisma`.

### Running Migrations

```bash
# Create a new migration
yarn prisma migrate dev --name migration_name

# Apply migrations in production
yarn prisma migrate deploy

# Open Prisma Studio (database GUI)
yarn prisma studio
```

## 📚 API Documentation

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "environment": "development",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### API Base URL

All API endpoints are prefixed with `/api`:

```
http://localhost:5000/api
```

## 💻 Development

### Available Scripts

```bash
# Start development server with hot reload
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Run linter
yarn lint:check

# Fix linting issues
yarn lint:fix

# Format code with Prettier
yarn prettier:fix

# Check code formatting
yarn prettier:check

# Run both linter and formatter
yarn lint-prettier
```

### Code Quality

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety

Make sure to run `yarn lint-prettier` before committing code.

## 🚢 Production Deployment

### Build

```bash
yarn build
```

### Environment

Ensure all environment variables are set correctly for production:
- Use strong `JWT_SECRET`
- Set `NODE_ENV=production`
- Configure production database URL
- Set up AWS S3 bucket
- Configure Redis instance
- Set up Qdrant instance

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build
CMD ["yarn", "start"]
```

## 📊 Performance Optimization

### Techniques Used

- **Pre-computed embeddings** - Embeddings generated during ingestion
- **Redis caching** - Query results and embeddings cached
- **Streaming responses** - For large result sets
- **Parallel retrieval** - Vector and keyword search run in parallel

### Achieved Results

- Query latency: **2-3 seconds**
- Handles **10k+ documents**
- No upload blocking
- Horizontal scaling support

## 🔒 Security & Data Protection

- ✅ JWT authentication
- ✅ Workspace isolation
- ✅ Signed S3 URLs
- ✅ Role-based access control (RBAC)
- ✅ Audit logs
- ✅ No AI model training on customer data

## 🎯 Use Cases

- **Customer support knowledge base** - Quick answers from support documentation
- **Compliance & policy search** - Find relevant policies and compliance documents
- **Legal document analysis** - Search through legal documents and contracts
- **Internal company documentation** - Company-wide knowledge base
- **Enterprise onboarding** - Help new employees find information quickly

## 🔮 Future Enhancements

- 🌍 Multilingual search support
- 💬 Slack / Teams integration
- 📄 Auto-summary per document
- 👥 Role-based AI responses
- 🎤 Voice query support

## 📝 License

MIT

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or support, please open an issue in the repository.

---

**Built with ❤️ for enterprise AI applications**
