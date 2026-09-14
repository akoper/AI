import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config.js';
import { RagAgent } from './rag-agent.js';
import { AdkRagAgent } from './adk-rag-agent.js';
import { DocumentLoader } from './document-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

validateConfig();

const app = express();
const agent = new RagAgent();
const adkAgent = new AdkRagAgent();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files directory
const publicDir = path.resolve(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Ingest sample data if vector store is empty
const sampleDataDir = path.resolve(__dirname, '..', 'data', 'knowledge');
if (fs.existsSync(sampleDataDir) && agent.getStats().chunksCount === 0) {
  agent.ingestDirectory(sampleDataDir).then((count) => {
    console.log(`📚 Initialized knowledge base with ${count} chunks from sample documents.`);
  }).catch((err) => {
    console.warn('Could not load sample data:', err);
  });
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    framework: 'Google ADK (@google/adk)',
    model: config.llmModel,
    embeddingModel: config.embeddingModel,
    stats: agent.getStats(),
  });
});

app.post('/api/adk/query', async (req, res) => {
  try {
    const { query, topK, similarityThreshold } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Field "query" is required' });
    }

    const response = await adkAgent.query(query, {
      topK: topK ? parseInt(topK, 10) : undefined,
      similarityThreshold: similarityThreshold ? parseFloat(similarityThreshold) : undefined,
    });

    res.json(response);
  } catch (error: any) {
    console.error('ADK Query error:', error);
    res.status(500).json({ error: error?.message || 'Failed to process ADK query' });
  }
});

app.post('/api/adk/chat', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" is required' });
    }

    const sessId = sessionId || `session_${Date.now()}`;
    const response = await adkAgent.chat(sessId, message, userId || 'user_default');

    res.json({
      sessionId: sessId,
      ...response,
    });
  } catch (error: any) {
    console.error('ADK Chat error:', error);
    res.status(500).json({ error: error?.message || 'Failed to process ADK chat message' });
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const { query, topK, similarityThreshold, temperature } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Field "query" is required' });
    }

    const response = await agent.query(query, {
      topK: topK ? parseInt(topK, 10) : undefined,
      similarityThreshold: similarityThreshold ? parseFloat(similarityThreshold) : undefined,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
    });

    res.json(response);
  } catch (error: any) {
    console.error('Query error:', error);
    res.status(500).json({ error: error?.message || 'Failed to process query' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, topK, similarityThreshold, temperature } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" is required' });
    }

    const response = await agent.chat(message, {
      topK: topK ? parseInt(topK, 10) : undefined,
      similarityThreshold: similarityThreshold ? parseFloat(similarityThreshold) : undefined,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
    });

    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error?.message || 'Failed to process chat message' });
  }
});

app.get('/api/history', (req, res) => {
  res.json({ history: agent.getHistory() });
});

app.delete('/api/history', (req, res) => {
  agent.clearHistory();
  res.json({ success: true, message: 'Chat history cleared' });
});

app.get('/api/documents', (req, res) => {
  const stats = agent.getStats();
  const chunks = agent.getChunks().map((c) => ({
    id: c.id,
    documentId: c.documentId,
    title: c.metadata.title,
    source: c.metadata.source,
    chunkIndex: c.chunkIndex,
    totalChunks: c.totalChunks,
    snippet: c.content.substring(0, 150) + (c.content.length > 150 ? '...' : ''),
  }));

  res.json({ stats, chunks });
});

app.post('/api/documents/text', async (req, res) => {
  try {
    const { text, title, source } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" is required' });
    }

    const chunksCount = await agent.ingestText(text, {
      title: title || 'Custom Document',
      source: source || 'User Input',
    });

    res.json({
      success: true,
      message: `Document ingested successfully into ${chunksCount} chunks`,
      chunksCount,
      stats: agent.getStats(),
    });
  } catch (error: any) {
    console.error('Ingest text error:', error);
    res.status(500).json({ error: error?.message || 'Failed to ingest text' });
  }
});

app.post('/api/documents/file', async (req, res) => {
  try {
    const { filePath, title } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Field "filePath" is required' });
    }

    const chunksCount = await agent.ingestFile(filePath, {
      title: title || path.basename(filePath),
    });

    res.json({
      success: true,
      message: `File ingested successfully into ${chunksCount} chunks`,
      chunksCount,
      stats: agent.getStats(),
    });
  } catch (error: any) {
    console.error('Ingest file error:', error);
    res.status(500).json({ error: error?.message || 'Failed to ingest file' });
  }
});

app.delete('/api/documents/:id', (req, res) => {
  const docId = req.params.id;
  const deleted = agent.deleteDocument(docId);
  res.json({ success: true, deletedChunks: deleted, stats: agent.getStats() });
});

app.delete('/api/documents', (req, res) => {
  agent.clearKnowledge();
  res.json({ success: true, message: 'All documents cleared from knowledge base', stats: agent.getStats() });
});

const PORT = config.port;
export const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🤖 Gemini RAG AI Agent Server running at http://localhost:${PORT}`);
  console.log(`📁 Vector Store: ${config.storagePath}`);
  console.log(`🧠 Embedding Model: ${config.embeddingModel} | LLM: ${config.llmModel}`);
  console.log('====================================================');
});

export { app, agent, adkAgent };
