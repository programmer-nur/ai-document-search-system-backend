import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../src/config/env';

async function testQdrantConnection() {
  console.log('🔍 Testing Qdrant Connection...\n');

  // Display configuration
  console.log('Configuration:');
  console.log(`  QDRANT_URL: ${env.QDRANT_URL}`);
  console.log(`  QDRANT_API_KEY: ${env.QDRANT_API_KEY ? '***set***' : 'not set'}\n`);

  try {
    // Initialize Qdrant client
    const qdrantClient = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY || undefined,
    });

    console.log('📡 Attempting to connect to Qdrant...');

    // Test 1: Get collections (simple health check)
    console.log('\n1️⃣ Testing: Get Collections');
    const collections = await qdrantClient.getCollections();
    console.log('✅ Connection successful!');
    console.log(`   Found ${collections.collections.length} collection(s):`);
    collections.collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    // Test 2: Create a test collection
    console.log('\n2️⃣ Testing: Create Test Collection');
    const testCollectionName = 'test_connection_check';

    // Check if test collection already exists
    const exists = collections.collections.some(col => col.name === testCollectionName);

    if (exists) {
      console.log(
        `   ⚠️  Test collection '${testCollectionName}' already exists, deleting it first...`
      );
      await qdrantClient.deleteCollection(testCollectionName);
    }

    await qdrantClient.createCollection(testCollectionName, {
      vectors: {
        size: 1536, // OpenAI text-embedding-3-small dimension
        distance: 'Cosine',
      },
    });
    console.log(`   ✅ Test collection '${testCollectionName}' created successfully`);

    // Test 3: Get collection info
    console.log('\n3️⃣ Testing: Get Collection Info');
    const collectionInfo = await qdrantClient.getCollection(testCollectionName);
    console.log('   ✅ Collection info retrieved:');
    console.log(`      Points count: ${collectionInfo.points_count || 0}`);
    console.log(
      `      Vectors count: ${collectionInfo.indexed_vectors_count || collectionInfo.points_count || 0}`
    );
    console.log(`      Vector size: ${collectionInfo.config?.params?.vectors?.size || 'N/A'}`);

    // Test 4: Upsert a test vector
    console.log('\n4️⃣ Testing: Upsert Test Vector');
    const testVector = new Array(1536).fill(0).map(() => Math.random());
    await qdrantClient.upsert(testCollectionName, {
      wait: true,
      points: [
        {
          id: 1, // Qdrant expects numeric or UUID IDs
          vector: testVector,
          payload: {
            test: true,
            timestamp: new Date().toISOString(),
          },
        },
      ],
    });
    console.log('   ✅ Test vector upserted successfully');

    // Test 5: Search vectors
    console.log('\n5️⃣ Testing: Search Vectors');
    const searchResults = await qdrantClient.search(testCollectionName, {
      vector: testVector,
      limit: 5,
      with_payload: true,
    });
    console.log(`   ✅ Search completed, found ${searchResults.length} result(s)`);
    if (searchResults.length > 0) {
      console.log(`      Top result ID: ${searchResults[0].id}`);
      console.log(`      Top result score: ${searchResults[0].score?.toFixed(4)}`);
    }

    // Test 6: Clean up - Delete test collection
    console.log('\n6️⃣ Testing: Delete Test Collection');
    await qdrantClient.deleteCollection(testCollectionName);
    console.log(`   ✅ Test collection '${testCollectionName}' deleted successfully`);

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED - Qdrant is fully operational!');
    console.log('='.repeat(50) + '\n');

    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Qdrant connection test failed!\n');

    if (error instanceof Error) {
      console.error('Error details:');
      console.error(`  Message: ${error.message}`);
      console.error(`  Name: ${error.name}`);

      if ('status' in error) {
        console.error(`  Status: ${error.status}`);
      }
      if ('response' in error) {
        console.error(`  Response: ${JSON.stringify(error.response, null, 2)}`);
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.error('\n💡 Troubleshooting tips:');
    console.error('  1. Check if Qdrant is running: docker ps | grep qdrant');
    console.error('  2. Verify QDRANT_URL in .env file');
    console.error('  3. Check Qdrant logs: docker logs ai-doc-search-qdrant');
    console.error('  4. Test connection manually: curl http://localhost:6333/collections\n');

    process.exit(1);
  }
}

// Run the test
testQdrantConnection();
