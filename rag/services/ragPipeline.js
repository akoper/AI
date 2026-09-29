const { chunkText } = require('./chunker');
const { generateEmbedding, generateAnswer } = require('./gemini');
const { vectorStoreInstance } = require('./vectorStore');
const logger = require('./logger');

/**
 * High-level RAG Pipeline Service
 * 
 * Demonstrates the 5 key phases of Retrieval-Augmented Generation:
 * 1. INGESTION & CHUNKING: Split raw document into smaller, meaningful segments.
 * 2. EMBEDDING: Convert text chunks into high-dimensional semantic vectors using Gemini.
 * 3. INDEXING: Store vector embeddings in a vector database/index.
 * 4. RETRIEVAL: Convert the user's question to a vector and find the nearest context chunks using Cosine Similarity.
 * 5. AUGMENTATION & GENERATION: Construct a prompt grounding the LLM in retrieved facts and generate an answer.
 */

async function ingestDocument(docId, title, text, options = {}, apiKey = null) {
  const chunkSize = options.chunkSize || 300;
  const overlap = options.overlap || 50;

  logger.ingest(`Processing document: "${title}" (ID: ${docId}, Length: ${text.length} chars)`);

  // Phase 1: Chunking
  const chunks = chunkText(text, chunkSize, overlap);
  logger.chunker(`Split "${title}" into ${chunks.length} chunks (chunkSize=${chunkSize}, overlap=${overlap})`);
  
  // Phase 2: Embeddings
  const chunksWithEmbeddings = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    logger.embed(`Generating embedding for chunk ${i + 1}/${chunks.length} ("${chunk.slice(0, 35)}...")...`);
    const embedding = await generateEmbedding(chunk, apiKey);
    chunksWithEmbeddings.push({
      chunk,
      embedding
    });
  }

  // Phase 3: Indexing into Vector Store
  vectorStoreInstance.addDocument(docId, title, text, chunksWithEmbeddings);
  logger.vectorStore(`Indexed document "${title}" with ${chunks.length} vector embeddings. Total in store: ${vectorStoreInstance.vectors.length}`);

  return {
    docId,
    title,
    totalLength: text.length,
    chunkCount: chunks.length,
    chunks: chunksWithEmbeddings.map((c, idx) => ({
      index: idx,
      content: c.chunk,
      vectorDim: c.embedding.length,
      embeddingPreview: c.embedding.slice(0, 5)
    }))
  };
}

async function executeRAG(query, options = {}, apiKey = null) {
  const topK = options.topK || 3;
  const similarityThreshold = options.similarityThreshold !== undefined ? options.similarityThreshold : 0.0;

  logger.ragSummary(`\n--- Starting RAG Query ---`);
  logger.ragSummary(`User Query: "${query}" (topK=${topK}, threshold=${similarityThreshold})`);

  const executionSteps = [];

  // Step 1: User Query Embedding
  const startTime = Date.now();
  logger.rag(1, `Vectorizing query using Gemini embedding model (gemini-embedding-001)...`);
  const queryEmbedding = await generateEmbedding(query, apiKey);
  logger.rag(1, `Query embedding generated (${queryEmbedding.length} dimensions)`);

  executionSteps.push({
    step: 1,
    name: 'Query Vectorization (Embedding)',
    description: `Google Gemini embedding model converted the user query into a ${queryEmbedding.length}-dimensional vector.`,
    details: {
      query,
      vectorLength: queryEmbedding.length,
      vectorPreview: queryEmbedding.slice(0, 8)
    }
  });

  // Step 2: Vector Search / Cosine Similarity
  logger.rag(2, `Searching vector store (${vectorStoreInstance.vectors.length} chunks) with Cosine Similarity...`);
  const retrievedChunks = vectorStoreInstance.similaritySearch(queryEmbedding, topK, similarityThreshold);
  logger.rag(2, `Retrieved ${retrievedChunks.length} chunks. ${retrievedChunks.length > 0 ? `Top score: ${retrievedChunks[0].score.toFixed(4)} (${retrievedChunks[0].source})` : 'No chunks met threshold.'}`);

  executionSteps.push({
    step: 2,
    name: 'Vector Similarity Retrieval',
    description: `Calculated Cosine Similarity against ${vectorStoreInstance.vectors.length} stored chunk vectors in memory.`,
    details: {
      totalStoredChunks: vectorStoreInstance.vectors.length,
      topK,
      retrievedCount: retrievedChunks.length,
      chunks: retrievedChunks
    }
  });

  // Step 3: Augment Prompt & Generate Answer with Gemini
  logger.rag(3, `Augmenting prompt with ${retrievedChunks.length} reference context chunk(s) and sending to Gemini...`);
  const generationResult = await generateAnswer(query, retrievedChunks, apiKey);
  const totalTimeMs = Date.now() - startTime;
  logger.rag(3, `Answer generated in ${totalTimeMs}ms (${generationResult.answer.length} chars) using ${generationResult.modelUsed || 'gemini-3.8-flash'}`);
  logger.ragSummary(`--- RAG Execution Finished in ${totalTimeMs}ms ---\n`);

  executionSteps.push({
    step: 3,
    name: 'Prompt Augmentation & Generation',
    description: `Supplied retrieved source chunks into Gemini (${generationResult.modelUsed || 'gemini-3.8-flash'}) system prompt to generate grounded answer.`,
    details: {
      systemInstruction: generationResult.systemInstructionUsed,
      finalPrompt: generationResult.promptUsed,
      answer: generationResult.answer
    }
  });

  return {
    query,
    answer: generationResult.answer,
    retrievedChunks,
    steps: executionSteps,
    metadata: {
      executionTimeMs: totalTimeMs,
      modelUsed: generationResult.modelUsed || 'gemini-3.8-flash',
      embeddingModelUsed: 'gemini-embedding-001'
    }
  };
}

module.exports = {
  ingestDocument,
  executeRAG
};
