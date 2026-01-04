import { UserRole, WorkspaceRole, DocumentType, DocumentStatus, IngestionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import prisma from '../src/utils/prisma';

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a super admin user
  // Password: Admin@123 (meets requirements: 8+ chars, uppercase, lowercase, number, special char)
  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@ai.com' },
    update: {
      password: hashedPassword, // Update password if user already exists
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: 'admin@ai.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created/Updated super admin user:', superAdmin.email);
  console.log('   Email: admin@ai.com');
  console.log('   Password: Admin@123');

  // Create a regular user
  const userPassword = await bcrypt.hash('user123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: userPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created regular user:', user.email);

  // Create a demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description: 'A demo workspace for testing',
      isActive: true,
      settings: {
        maxDocuments: 1000,
        maxStorageGB: 10,
      },
    },
  });

  console.log('✅ Created workspace:', workspace.name);

  // Add super admin as workspace owner
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: superAdmin.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: superAdmin.id,
      role: WorkspaceRole.OWNER,
      joinedAt: new Date(),
    },
  });

  // Add regular user as workspace member
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.MEMBER,
      joinedAt: new Date(),
    },
  });

  console.log('✅ Added users to workspace');

  // Create a sample document (for testing)
  const document = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      name: 'Sample Document',
      originalName: 'sample.pdf',
      type: DocumentType.PDF,
      mimeType: 'application/pdf',
      size: BigInt(1024000), // 1MB
      status: DocumentStatus.PROCESSED,
      s3Key: 'documents/demo-workspace/sample.pdf',
      s3Bucket: 'ai-document-search',
      s3Region: 'us-east-1',
      ingestionStatus: IngestionStatus.COMPLETED,
      ingestionStartedAt: new Date(Date.now() - 3600000), // 1 hour ago
      ingestionCompletedAt: new Date(Date.now() - 1800000), // 30 minutes ago
      uploadedAt: new Date(Date.now() - 3600000),
      processedAt: new Date(Date.now() - 1800000),
      chunkCount: 10,
      embeddingCount: 10,
    },
  });

  console.log('✅ Created sample document:', document.name);

  // Create sample chunks
  const chunks = [];
  for (let i = 0; i < 5; i++) {
    chunks.push({
      documentId: document.id,
      content: `This is sample chunk content ${i + 1}. It contains some text that can be used for testing the search functionality.`,
      contentHash: `hash-${i + 1}`,
      chunkIndex: i,
      pageNumber: i + 1,
      hasEmbedding: false,
      tokenCount: 50,
    });
  }

  await prisma.chunk.createMany({
    data: chunks,
  });

  console.log('✅ Created sample chunks');

  // Create a sample query
  await prisma.query.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      type: 'SEARCH',
      query: 'sample search query',
      resultCount: 5,
      topDocumentIds: [document.id],
      metadata: {
        searchType: 'hybrid',
        vectorResults: 3,
        keywordResults: 2,
      },
    },
  });

  console.log('✅ Created sample query');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

