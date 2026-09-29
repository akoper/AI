const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { vectorStoreInstance } = require('../services/vectorStore');
const { ingestDocument, executeRAG } = require('../services/ragPipeline');
const { generateEmbedding } = require('../services/gemini');
const logger = require('../services/logger');

// Load example documents
let EXAMPLE_DOCS = [];
try {
  const examplesPath = path.join(__dirname, '..', 'examples', 'example_documents.json');
  if (fs.existsSync(examplesPath)) {
    EXAMPLE_DOCS = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
  }
} catch (e) {
  logger.warn('EXAMPLES', 'Failed to load examples JSON: ' + e.message);
}

// Sample knowledge base documents for educational starter
const SAMPLE_DOCS = [
  {
    id: 'doc_gemini_info',
    title: 'Google Gemini Architecture Overview',
    content: `Google Gemini is a family of multimodal large language models developed by Google AI. 
Gemini was designed from the ground up to be multimodal, meaning it can seamlessly understand, operate across, and combine different types of information including text, code, audio, image, and video.
The model lineup includes Gemini 1.5 Flash, Gemini 1.5 Pro, and Gemini 2.5 Flash, optimized for diverse latency and reasoning workloads. 
Gemini models support native long-context windows up to 1 million or 2 million tokens, enabling large-scale analysis of documents, video streams, and full audio files.`
  },
  {
    id: 'doc_rag_concepts',
    title: 'Understanding Retrieval-Augmented Generation (RAG)',
    content: `Retrieval-Augmented Generation (RAG) is an architectural pattern that improves Large Language Model (LLM) responses by grounding them on external knowledge.
The 5 foundational stages of RAG are:
1. Ingestion & Document Preprocessing: Collecting documents and standardizing text formats.
2. Chunking: Splitting long texts into smaller passages with optional sliding-window overlaps to preserve context.
3. Embedding Generation: Converting chunked texts into vector embeddings using models such as Google's gemini-embedding-001.
4. Vector Storage & Cosine Retrieval: Storing chunk vectors and retrieving the top-K semantically closest chunks to a user's prompt using cosine similarity.
5. Context Grounding & Generation: Constructing an augmented prompt combining retrieved chunks with the query, directing the LLM to answer factually based solely on the retrieved evidence.`
  },
  {
    id: 'doc_embeddings_explained',
    title: 'Vector Embeddings & Cosine Similarity in RAG',
    content: `Vector embeddings are numerical representations of concepts, words, or sentences in a continuous high-dimensional space (e.g. 768 dimensions for gemini-embedding-001).
In this space, semantically similar sentences are positioned close together even if they use completely different words.
Cosine similarity measures the cosine of the angle between two non-zero vectors. A score of 1.0 means identical directional semantics, while lower scores represent decreasing relevance.
In RAG, Cosine Similarity allows the retrieval engine to find documents relevant to the intent and meaning of the question rather than relying on exact keyword matching.`
  }
];

// GET /api/rag/examples - List all available example documents
router.get('/examples', (req, res) => {
  res.json({
    examples: EXAMPLE_DOCS
  });
});

// GET /api/rag/status - Check store status and sample data
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    totalDocuments: vectorStoreInstance.getDocuments().length,
    totalChunks: vectorStoreInstance.vectors.length,
    documents: vectorStoreInstance.getDocuments(),
    hasApiKey: !!(process.env.GOOGLE_GEMINI_KEY || process.env.GEMINI_API_KEY)
  });
});

// GET /api/rag/chunks - View all chunks & embeddings
router.get('/chunks', (req, res) => {
  res.json({
    chunks: vectorStoreInstance.getChunks()
  });
});

// POST /api/rag/seed - Seed with educational sample documents
router.post('/seed', async (req, res) => {
  try {
    logger.info('SEED', '🌱 Starting batch ingestion for sample tutorial documents...');
    const apiKey = req.body.apiKey;
    const results = [];
    for (const doc of SAMPLE_DOCS) {
      const resDoc = await ingestDocument(doc.id, doc.title, doc.content, { chunkSize: 250, overlap: 40 }, apiKey);
      results.push(resDoc);
    }
    logger.info('SEED', `✅ Successfully seeded ${results.length} sample documents into Vector Store.`);
    res.json({
      message: 'Knowledge base seeded successfully with sample RAG tutorials!',
      seededCount: results.length,
      documents: results
    });
  } catch (error) {
    logger.error('SEED', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rag/documents - Ingest custom document
router.post('/documents', async (req, res) => {
  try {
    const { title, content, chunkSize, overlap, apiKey } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const docId = 'doc_' + Date.now();
    logger.info('API', `📥 Received document ingest request: "${title}"`);
    const result = await ingestDocument(docId, title, content, {
      chunkSize: parseInt(chunkSize) || 280,
      overlap: parseInt(overlap) || 40
    }, apiKey);

    res.json({
      message: 'Document ingested and vectorized successfully',
      result
    });
  } catch (error) {
    logger.error('API:INGEST', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/rag/documents/:id - Delete document
router.delete('/documents/:id', (req, res) => {
  const { id } = req.params;
  vectorStoreInstance.removeDocument(id);
  logger.vectorStore(`🗑️ Removed document ID: ${id}`);
  res.json({ message: `Document ${id} removed successfully.` });
});

// DELETE /api/rag/clear - Reset vector store
router.post('/clear', (req, res) => {
  vectorStoreInstance.clear();
  logger.vectorStore('🧹 Vector store cleared and reset to empty state.');
  res.json({ message: 'Vector store cleared.' });
});

// POST /api/rag/search - Similarity search only (inspect step 4)
router.post('/search', async (req, res) => {
  try {
    const { query, topK, similarityThreshold, apiKey } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    logger.info('SEARCH', `Executing similarity search query: "${query}" (topK=${topK})`);
    const queryEmbedding = await generateEmbedding(query, apiKey);
    const results = vectorStoreInstance.similaritySearch(
      queryEmbedding,
      parseInt(topK) || 3,
      parseFloat(similarityThreshold) || 0.0
    );

    res.json({
      query,
      queryVectorPreview: queryEmbedding.slice(0, 8),
      results
    });
  } catch (error) {
    logger.error('API:SEARCH', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rag/query - Full End-to-End RAG execution
router.post('/query', async (req, res) => {
  try {
    const { query, topK, similarityThreshold, apiKey } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const ragResult = await executeRAG(
      query,
      {
        topK: parseInt(topK) || 3,
        similarityThreshold: parseFloat(similarityThreshold) || 0.0
      },
      apiKey
    );

    res.json(ragResult);
  } catch (error) {
    logger.error('API:QUERY', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
