import { TextChunker } from '../src/chunker.js';
import { EmbeddingService } from '../src/embeddings.js';
import { VectorStore } from '../src/vector-store.js';
import { DocumentLoader } from '../src/document-loader.js';
import { RagAgent } from '../src/rag-agent.js';
import {
  AdkRagAgent,
  createKnowledgeSearchTool,
  createIngestDocumentTool,
  createKnowledgeStatsTool,
} from '../src/adk-rag-agent.js';
import path from 'path';
import fs from 'fs';

async function runTests() {
  console.log('🚀 Starting RAG Agent Test Suite (Google ADK & Direct)...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. TextChunker Tests
  console.log('📌 Test 1: TextChunker');
  const chunker = new TextChunker({ chunkSize: 100, chunkOverlap: 20 });
  const sampleDoc = {
    id: 'test_doc_1',
    content: 'Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics to solve problems too complex for classical computers. Qubits can exist in superposition of 0 and 1. Entanglement allows instant correlation.',
    metadata: { source: 'unit_test' },
  };
  const chunks = chunker.chunkDocument(sampleDoc);
  assert(chunks.length > 1, `Splits text into multiple chunks (got ${chunks.length})`);
  assert(chunks[0].documentId === 'test_doc_1', 'Chunk retains correct documentId');
  assert(chunks[0].totalChunks === chunks.length, 'Chunk contains accurate totalChunks count');

  // 2. EmbeddingService & Cosine Similarity Tests
  console.log('\n📌 Test 2: EmbeddingService & Cosine Similarity');
  const vecA = [1, 0, 0];
  const vecB = [1, 0, 0];
  const vecC = [0, 1, 0];
  const vecD = [0.7071, 0.7071, 0];

  assert(Math.abs(EmbeddingService.cosineSimilarity(vecA, vecB) - 1.0) < 0.001, 'Identical vectors have similarity 1.0');
  assert(Math.abs(EmbeddingService.cosineSimilarity(vecA, vecC) - 0.0) < 0.001, 'Orthogonal vectors have similarity 0.0');
  assert(EmbeddingService.cosineSimilarity(vecA, vecD) > 0.7, 'Diagonal vector has ~0.707 similarity');

  const embeddingService = new EmbeddingService();
  const emb1 = await embeddingService.embedText('quantum physics');
  const emb2 = await embeddingService.embedText('quantum mechanics');
  const emb3 = await embeddingService.embedText('baking chocolate cookies');

  assert(emb1.length > 0, 'Generates non-empty embedding vector');
  const simRelated = EmbeddingService.cosineSimilarity(emb1, emb2);
  const simUnrelated = EmbeddingService.cosineSimilarity(emb1, emb3);
  assert(simRelated > simUnrelated, `Semantic similarity: related (${simRelated.toFixed(3)}) > unrelated (${simUnrelated.toFixed(3)})`);

  // 3. VectorStore Tests
  console.log('\n📌 Test 3: VectorStore');
  const testStorePath = path.resolve(process.cwd(), 'tests', 'temp_store.json');
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

  const vectorStore = new VectorStore(testStorePath);
  vectorStore.addChunks([
    {
      id: 'c1',
      documentId: 'docA',
      content: 'Machine learning models require optimization algorithms like Adam and SGD.',
      embedding: emb1,
      chunkIndex: 0,
      totalChunks: 1,
      metadata: { source: 'ml.txt' },
    },
    {
      id: 'c2',
      documentId: 'docB',
      content: 'Recipe for dark chocolate cake with ganache frosting.',
      embedding: emb3,
      chunkIndex: 0,
      totalChunks: 1,
      metadata: { source: 'cake.txt' },
    },
  ]);

  const searchResults = vectorStore.search(emb1, 2, 0.0);
  assert(searchResults.length === 2, `Retrieved 2 chunks from vector store`);
  assert(searchResults[0].chunk.id === 'c1', `Top match is the ML chunk (score: ${searchResults[0].score.toFixed(3)})`);

  const deletedCount = vectorStore.deleteDocument('docB');
  assert(deletedCount === 1, 'Correctly deletes document chunks by ID');
  assert(vectorStore.getChunks().length === 1, 'Vector store contains remaining chunks after deletion');

  // Persistence test
  const reloadedStore = new VectorStore(testStorePath);
  assert(reloadedStore.getChunks().length === 1, 'Loads saved vector store from JSON file');
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

  // 4. DocumentLoader Tests
  console.log('\n📌 Test 4: DocumentLoader');
  const rawDoc = DocumentLoader.fromText('Test document content', { title: 'My Doc' });
  assert(rawDoc.content === 'Test document content', 'Loads document from raw text');
  assert(rawDoc.metadata.title === 'My Doc', 'Attaches metadata to loaded document');

  // 5. RagAgent End-to-End Tests
  console.log('\n📌 Test 5: RagAgent End-to-End Execution');
  const agent = new RagAgent({
    storagePath: undefined, // in-memory
    similarityThreshold: 0.2,
    topK: 3,
  });

  const ingestedCount = await agent.ingestText(
    `Project Helios is an advanced space mission scheduled for 2028.
The mission target is Europa, an icy moon of Jupiter.
The primary scientific instrument on board is the Sub-surface Radar Sounder (SRS-9), which penetrates up to 15km of ice.
The mission commander is Dr. Evelyn Vance.`,
    { title: 'Project Helios Mission Brief', source: 'helios_brief.md' }
  );

  assert(ingestedCount > 0, `Ingested ${ingestedCount} chunks into RAG Agent`);

  console.log('  🔍 Querying RAG Agent for "Who is the mission commander of Project Helios?"...');
  const res1 = await agent.query('Who is the mission commander of Project Helios?');
  assert(res1.citations.length > 0, `Found ${res1.citations.length} citation sources`);
  assert(
    res1.answer.toLowerCase().includes('evelyn') || res1.answer.toLowerCase().includes('vance'),
    `Agent answer includes Dr. Evelyn Vance (Answer: "${res1.answer.trim()}")`
  );

  console.log('  🔍 Querying RAG Agent for "What is the primary scientific instrument on Project Helios?"...');
  const res2 = await agent.query('What is the primary scientific instrument on Project Helios?');
  assert(
    res2.answer.toLowerCase().includes('srs-9') || res2.answer.toLowerCase().includes('radar'),
    `Agent answer includes SRS-9 radar (Answer: "${res2.answer.trim()}")`
  );

  // Conversational chat memory test
  console.log('  💬 Testing Conversational Memory in RAG Agent...');
  await agent.chat('Tell me about Project Helios.');
  const chatHistory = agent.getHistory();
  assert(chatHistory.length === 2, `Conversation history recorded ${chatHistory.length} messages (user + assistant)`);

  // 6. Google ADK Function Tools Tests
  console.log('\n📌 Test 6: Google ADK (@google/adk) Function Tools');
  const adkVectorStore = new VectorStore();
  const adkEmbeddingService = new EmbeddingService();
  const adkChunker = new TextChunker();

  const toolOptions = {
    vectorStore: adkVectorStore,
    embeddingService: adkEmbeddingService,
    chunker: adkChunker,
  };

  const searchTool = createKnowledgeSearchTool(toolOptions);
  const ingestTool = createIngestDocumentTool(toolOptions);
  const statsTool = createKnowledgeStatsTool(toolOptions);

  assert(searchTool.name === 'search_knowledge_base', 'search_knowledge_base tool created with correct name');
  assert(ingestTool.name === 'ingest_document', 'ingest_document tool created with correct name');
  assert(statsTool.name === 'get_knowledge_base_stats', 'get_knowledge_base_stats tool created with correct name');

  // Test tool execution via runAsync
  const ingestResult: any = await ingestTool.runAsync({
    args: {
      content: 'Project Chronos is a time synchronization network deploying atomic clocks in low Earth orbit.',
      source: 'chronos_spec.md',
      title: 'Project Chronos Specs',
    },
  });
  assert(ingestResult?.success === true, 'ADK ingest_document tool runs and returns success');
  assert(ingestResult?.chunksAdded > 0, `ADK ingest tool added ${ingestResult?.chunksAdded} chunks`);

  const statsResult: any = await statsTool.runAsync({ args: {} });
  assert(statsResult?.chunksCount > 0, 'ADK get_knowledge_base_stats tool returns non-zero chunks');

  const searchResult: any = await searchTool.runAsync({
    args: { query: 'atomic clocks in low Earth orbit' },
  });
  assert(searchResult?.found === true, 'ADK search_knowledge_base tool retrieved matched document');
  assert(searchResult?.results?.length > 0, 'ADK search tool returns results array');

  // 7. Google ADK RAG Agent End-to-End Tests
  console.log('\n📌 Test 7: Google ADK (@google/adk) AdkRagAgent End-to-End Execution');
  const adkRagAgent = new AdkRagAgent({
    storagePath: undefined,
  });

  await adkRagAgent.ingestText(
    'Project Chronos is led by Dr. Marcus Sterling and utilizes optical lattice atomic clocks.',
    { title: 'Chronos Leadership', source: 'chronos_team.md' }
  );

  console.log('  🔍 Querying Google ADK Agent for "Who leads Project Chronos?"...');
  const adkRes1 = await adkRagAgent.query('Who leads Project Chronos?');
  assert(adkRes1.citations.length > 0, `Google ADK Agent returned ${adkRes1.citations.length} citations`);
  assert(
    adkRes1.answer.toLowerCase().includes('marcus') || adkRes1.answer.toLowerCase().includes('sterling'),
    `Google ADK Agent answer contains Dr. Marcus Sterling (Answer: "${adkRes1.answer.trim()}")`
  );

  console.log(`\n====================================================`);
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
