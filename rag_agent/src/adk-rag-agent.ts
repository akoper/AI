import { Agent, FunctionTool, InMemoryRunner } from '@google/adk';
import { z } from 'zod';
import { config, RagConfig } from './config.js';
import {
  Document,
  DocumentMetadata,
  QueryOptions,
  RagResponse,
  Citation,
  IngestionStats,
} from './types.js';
import { TextChunker } from './chunker.js';
import { EmbeddingService } from './embeddings.js';
import { VectorStore } from './vector-store.js';
import { DocumentLoader } from './document-loader.js';

export interface AdkRagToolsOptions {
  vectorStore: VectorStore;
  embeddingService: EmbeddingService;
  chunker?: TextChunker;
  defaultTopK?: number;
  defaultSimilarityThreshold?: number;
}

/**
 * Creates the official Google ADK search_knowledge_base function tool.
 */
export function createKnowledgeSearchTool(options: AdkRagToolsOptions): FunctionTool<any> {
  const { vectorStore, embeddingService, defaultTopK = 4, defaultSimilarityThreshold = 0.25 } = options;

  return new FunctionTool({
    name: 'search_knowledge_base',
    description:
      'Search the indexed vector knowledge base for relevant documents, factual excerpts, and context matching a query. Always consult this tool when answering questions about stored knowledge.',
    parameters: z.object({
      query: z.string().describe('The search query or concept to look up in the vector knowledge base'),
      topK: z
        .number()
        .optional()
        .describe(`Number of top matching chunks to retrieve (default: ${defaultTopK})`),
      minScore: z
        .number()
        .optional()
        .describe(`Minimum similarity score between 0.0 and 1.0 (default: ${defaultSimilarityThreshold})`),
    }),
    execute: async ({ query, topK, minScore }) => {
      const limit = topK ?? defaultTopK;
      const threshold = minScore ?? defaultSimilarityThreshold;

      const queryVector = await embeddingService.embedText(query);
      const matches = vectorStore.search(queryVector, limit, threshold);

      if (matches.length === 0) {
        return {
          found: false,
          count: 0,
          message: 'No matching documents found in knowledge base with sufficient similarity.',
          results: [],
        };
      }

      return {
        found: true,
        count: matches.length,
        results: matches.map((m) => ({
          source: m.chunk.metadata.source || 'Unknown Source',
          title: m.chunk.metadata.title,
          chunkId: m.chunk.id,
          chunkIndex: m.chunk.chunkIndex,
          totalChunks: m.chunk.totalChunks,
          similarityScore: parseFloat(m.score.toFixed(4)),
          content: m.chunk.content,
        })),
      };
    },
  });
}

/**
 * Creates the official Google ADK ingest_document function tool.
 */
export function createIngestDocumentTool(options: AdkRagToolsOptions): FunctionTool<any> {
  const { vectorStore, embeddingService, chunker = new TextChunker() } = options;

  return new FunctionTool({
    name: 'ingest_document',
    description: 'Ingest a new text document or note into the vector knowledge base for future retrieval.',
    parameters: z.object({
      content: z.string().describe('The full text content of the document to index'),
      source: z.string().describe('The name, filename, or URL identifier of the document'),
      title: z.string().optional().describe('Optional human-readable title for the document'),
    }),
    execute: async ({ content, source, title }) => {
      const doc: Document = {
        id: `adk_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        content,
        metadata: {
          source,
          title: title || source,
          createdAt: new Date().toISOString(),
        },
      };

      const chunks = chunker.chunkDocument(doc);
      if (chunks.length === 0) {
        return { success: false, chunksAdded: 0, message: 'Document content was empty.' };
      }

      const texts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(texts);
      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = embeddings[i];
      }

      vectorStore.addChunks(chunks);
      return {
        success: true,
        source,
        title: title || source,
        chunksAdded: chunks.length,
        message: `Successfully indexed ${chunks.length} chunks from "${source}".`,
      };
    },
  });
}

/**
 * Creates the official Google ADK get_knowledge_base_stats function tool.
 */
export function createKnowledgeStatsTool(options: AdkRagToolsOptions): FunctionTool<any> {
  const { vectorStore } = options;

  return new FunctionTool({
    name: 'get_knowledge_base_stats',
    description: 'Retrieve statistical overview of the vector knowledge base (number of documents, chunks, characters).',
    parameters: z.object({}),
    execute: async () => {
      const stats = vectorStore.getStats();
      const chunks = vectorStore.getChunks();
      const sources = Array.from(new Set(chunks.map((c) => c.metadata.source))).filter(Boolean);

      return {
        ...stats,
        indexedSources: sources,
      };
    },
  });
}

/**
 * High-level AI Agent utilizing the official Google Agent Development Kit (@google/adk)
 * with Retrieval-Augmented Generation capabilities.
 */
export class AdkRagAgent {
  private config: RagConfig;
  private chunker: TextChunker;
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private adkAgent: Agent;
  private runner: InMemoryRunner;

  constructor(customConfig?: Partial<RagConfig>) {
    this.config = { ...config, ...customConfig };
    this.chunker = new TextChunker({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });
    this.embeddingService = new EmbeddingService({
      apiKey: this.config.apiKey,
      modelName: this.config.embeddingModel,
    });
    this.vectorStore = new VectorStore(this.config.storagePath);

    // Initialize ADK Tools
    const toolOptions: AdkRagToolsOptions = {
      vectorStore: this.vectorStore,
      embeddingService: this.embeddingService,
      chunker: this.chunker,
      defaultTopK: this.config.topK,
      defaultSimilarityThreshold: this.config.similarityThreshold,
    };

    const searchTool = createKnowledgeSearchTool(toolOptions);
    const ingestTool = createIngestDocumentTool(toolOptions);
    const statsTool = createKnowledgeStatsTool(toolOptions);

    // Initialize Google ADK Agent (LlmAgent)
    this.adkAgent = new Agent({
      name: 'google_adk_rag_agent',
      model: this.config.llmModel,
      instruction: `You are an expert, truthful AI assistant powered by the Google Agent Development Kit (ADK) and Retrieval-Augmented Generation (RAG).
Your job is to answer user queries accurately by retrieving knowledge using the search_knowledge_base tool.
Follow these guidelines:
1. When asked a factual or specific question, search the knowledge base using search_knowledge_base to find grounded context.
2. Formulate your answer primarily based on the retrieved facts.
3. Always cite the document source (e.g. "[Source: filename]") when providing retrieved information.
4. If the retrieved context does not contain the answer, state honestly that the information is not present in the indexed knowledge base.
5. You can also ingest new documents when requested using the ingest_document tool, or check status using get_knowledge_base_stats.`,
      tools: [searchTool, ingestTool, statsTool],
    });

    // Initialize Google ADK InMemoryRunner
    this.runner = new InMemoryRunner({
      agent: this.adkAgent,
      appName: 'google-adk-rag-service',
    });
  }

  public getAgent(): Agent {
    return this.adkAgent;
  }

  public getRunner(): InMemoryRunner {
    return this.runner;
  }

  public getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  public getEmbeddingService(): EmbeddingService {
    return this.embeddingService;
  }

  /**
   * Ingest a single Document object.
   */
  public async addDocument(doc: Document): Promise<number> {
    const chunks = this.chunker.chunkDocument(doc);
    if (chunks.length === 0) return 0;

    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingService.embedBatch(texts);

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }

    this.vectorStore.addChunks(chunks);
    return chunks.length;
  }

  public async addDocuments(docs: Document[]): Promise<number> {
    let total = 0;
    for (const doc of docs) {
      total += await this.addDocument(doc);
    }
    return total;
  }

  public async ingestText(text: string, metadata: Partial<DocumentMetadata> = {}): Promise<number> {
    const doc = DocumentLoader.fromText(text, metadata);
    return this.addDocument(doc);
  }

  public async ingestFile(filePath: string, metadata: Partial<DocumentMetadata> = {}): Promise<number> {
    const doc = DocumentLoader.fromFile(filePath, metadata);
    return this.addDocument(doc);
  }

  public async ingestDirectory(dirPath: string): Promise<number> {
    const docs = DocumentLoader.fromDirectory(dirPath);
    return this.addDocuments(docs);
  }

  /**
   * Execute a RAG query through the Google ADK Agent and InMemoryRunner.
   */
  public async query(question: string, options: QueryOptions = {}): Promise<RagResponse> {
    const startTime = Date.now();
    const citations: Citation[] = [];
    let answerText = '';
    let retrievedChunksCount = 0;

    try {
      const events = this.runner.runEphemeral({
        userId: 'rag_user',
        newMessage: {
          parts: [{ text: question }],
        },
      });

      for await (const event of events) {
        // Collect tool response citations
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            // Check for tool response
            if ((part as any).functionResponse) {
              const fnResp = (part as any).functionResponse;
              if (fnResp.name === 'search_knowledge_base' && fnResp.response?.results) {
                const results = fnResp.response.results as Array<{
                  source: string;
                  chunkId: string;
                  similarityScore: number;
                  chunkIndex: number;
                  content: string;
                }>;
                retrievedChunksCount = results.length;
                for (const res of results) {
                  citations.push({
                    source: res.source,
                    chunkId: res.chunkId,
                    snippet: res.content.substring(0, 150) + (res.content.length > 150 ? '...' : ''),
                    score: res.similarityScore,
                    chunkIndex: res.chunkIndex,
                  });
                }
              }
            }

            // Check for final model text answer
            if (event.author === 'google_adk_rag_agent' && (part as any).text) {
              answerText = (part as any).text;
            }
          }
        }
      }

      // Fallback if model answered without explicit tool or in offline fallback mode
      if (!answerText) {
        // Perform direct vector search fallback
        const queryVector = await this.embeddingService.embedText(question);
        const matches = this.vectorStore.search(
          queryVector,
          options.topK ?? this.config.topK,
          options.similarityThreshold ?? this.config.similarityThreshold
        );
        retrievedChunksCount = matches.length;
        for (const m of matches) {
          citations.push({
            source: m.chunk.metadata.source,
            chunkId: m.chunk.id,
            snippet: m.chunk.content.substring(0, 150) + '...',
            score: m.score,
            chunkIndex: m.chunk.chunkIndex,
          });
        }
        answerText = matches.length > 0
          ? `According to ${matches[0].chunk.metadata.source}: ${matches[0].chunk.content}`
          : 'No relevant information found in the knowledge base.';
      }

      const latencyMs = Date.now() - startTime;
      const confidence =
        citations.length > 0
          ? Math.min(1.0, citations.reduce((acc, c) => acc + c.score, 0) / citations.length + 0.1)
          : 0.0;

      return {
        query: question,
        answer: answerText,
        citations,
        retrievedChunksCount,
        confidence: parseFloat(confidence.toFixed(2)),
        usedModel: `Google ADK (${this.config.llmModel})`,
        latencyMs,
      };
    } catch (err) {
      console.error('Error executing ADK RAG query:', err);
      // Resilient fallback to direct vector search
      const queryVector = await this.embeddingService.embedText(question);
      const matches = this.vectorStore.search(queryVector, this.config.topK, this.config.similarityThreshold);
      return {
        query: question,
        answer: matches.length > 0
          ? `[Fallback Result] ${matches[0].chunk.content}`
          : 'Unable to retrieve answer from knowledge base.',
        citations: matches.map((m) => ({
          source: m.chunk.metadata.source,
          chunkId: m.chunk.id,
          snippet: m.chunk.content.substring(0, 150) + '...',
          score: m.score,
          chunkIndex: m.chunk.chunkIndex,
        })),
        retrievedChunksCount: matches.length,
        confidence: matches.length > 0 ? 0.75 : 0.0,
        usedModel: `Google ADK Fallback (${this.config.llmModel})`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run multi-turn conversation with ADK session management.
   */
  public async chat(sessionId: string, message: string, userId: string = 'user_default'): Promise<{
    answer: string;
    citations: Citation[];
    latencyMs: number;
  }> {
    const startTime = Date.now();
    const citations: Citation[] = [];
    let answerText = '';

    const events = this.runner.runAsync({
      userId,
      sessionId,
      newMessage: {
        parts: [{ text: message }],
      },
    });

    for await (const event of events) {
      if (event.content && event.content.parts) {
        for (const part of event.content.parts) {
          if ((part as any).functionResponse) {
            const fnResp = (part as any).functionResponse;
            if (fnResp.name === 'search_knowledge_base' && fnResp.response?.results) {
              const results = fnResp.response.results;
              for (const res of results) {
                citations.push({
                  source: res.source,
                  chunkId: res.chunkId,
                  snippet: res.content.substring(0, 150),
                  score: res.similarityScore,
                  chunkIndex: res.chunkIndex,
                });
              }
            }
          }

          if (event.author === 'google_adk_rag_agent' && (part as any).text) {
            answerText = (part as any).text;
          }
        }
      }
    }

    return {
      answer: answerText || 'I processed your request using Google ADK.',
      citations,
      latencyMs: Date.now() - startTime,
    };
  }

  public getStats(): IngestionStats {
    return this.vectorStore.getStats();
  }

  public clearKnowledgeBase(): void {
    this.vectorStore.clear();
  }
}
