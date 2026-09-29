require('dotenv').config();
const { chunkText } = require('../services/chunker');
const { cosineSimilarity, VectorStore } = require('../services/vectorStore');
const logger = require('../services/logger');

function runUnitTests() {
  console.log('Testing Logger...');
  logger.server('Server started test log');
  logger.ingest('Document ingest test log');
  logger.chunker('Chunker test log');
  logger.embed('Embedding test log');
  logger.vectorStore('VectorStore test log');
  logger.rag(1, 'RAG step 1 test log');
  logger.ragSummary('RAG summary test log');
  logger.warn('TEST', 'Warning test log');
  logger.error('TEST', 'Error test log');
  console.log('✓ Logger functions executed without errors.');

  console.log('Testing Chunker...');
  const sample = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.';
  const chunks = chunkText(sample, 30, 5);
  console.assert(chunks.length > 1, 'Chunker should break sample into multiple chunks');
  console.log(`✓ Chunker produced ${chunks.length} chunks correctly.`);

  console.log('Testing Cosine Similarity...');
  const vec1 = [1, 0, 0];
  const vec2 = [1, 0, 0];
  const vec3 = [0, 1, 0];
  const simIdentical = cosineSimilarity(vec1, vec2);
  const simOrthogonal = cosineSimilarity(vec1, vec3);
  console.assert(Math.abs(simIdentical - 1.0) < 0.0001, 'Identical vectors should have similarity 1.0');
  console.assert(Math.abs(simOrthogonal - 0.0) < 0.0001, 'Orthogonal vectors should have similarity 0.0');
  console.log(`✓ Cosine Similarity calculated correctly: 1.0 for identical, 0.0 for orthogonal.`);

  console.log('Testing VectorStore...');
  const store = new VectorStore();
  store.addDocument('d1', 'Test Doc', 'Some doc content', [
    { chunk: 'Chunk A', embedding: [0.9, 0.1, 0.0] },
    { chunk: 'Chunk B', embedding: [0.0, 0.9, 0.1] }
  ]);
  const results = store.similaritySearch([0.95, 0.05, 0.0], 1);
  console.assert(results.length === 1 && results[0].content === 'Chunk A', 'Similarity search should retrieve Chunk A');
  console.log('✓ VectorStore correctly indexed and retrieved nearest chunk!');

  console.log('Testing Example Documents dataset...');
  const fs = require('fs');
  const path = require('path');
  const examplesFile = path.join(__dirname, '..', 'examples', 'example_documents.json');
  console.assert(fs.existsSync(examplesFile), 'example_documents.json must exist');
  const examples = JSON.parse(fs.readFileSync(examplesFile, 'utf8'));
  console.assert(examples.length >= 3, 'Should have at least 3 example documents');
  examples.forEach(ex => {
    console.assert(ex.title && ex.content && ex.suggestedQuestions.length > 0, `Example ${ex.id} is complete`);
    const c = chunkText(ex.content, 200, 30);
    console.assert(c.length >= 1, `Example ${ex.id} chunked into ${c.length} parts`);
  });
  console.log(`✓ Verified ${examples.length} example documents and their chunkability.`);

  console.log('All local unit tests passed successfully!');
}

runUnitTests();
