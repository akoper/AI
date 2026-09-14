import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, RagConfig } from './config.js';
import {
  Document,
  DocumentMetadata,
  QueryOptions,
  RagResponse,
  Citation,
  ChatMessage,
  IngestionStats,
} from './types.js';
import { TextChunker } from './chunker.js';
import { EmbeddingService } from './embeddings.js';
import { VectorStore } from './vector-store.js';
import { DocumentLoader } from './document-loader.js';

export class RagAgent {
  private config: RagConfig;
  private chunker: TextChunker;
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private genAI: GoogleGenerativeAI | null = null;
  private conversationHistory: ChatMessage[] = [];

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

    if (this.config.apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.config.apiKey);
      } catch (err) {
        console.warn('Could not initialize GoogleGenerativeAI for RAG LLM:', err);
      }
    }
  }

  /**
   * Ingest a single Document object: chunks it, embeds chunks, and stores into VectorStore.
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

  /**
   * Ingest multiple Document objects.
   */
  public async addDocuments(docs: Document[]): Promise<number> {
    let totalChunks = 0;
    for (const doc of docs) {
      const count = await this.addDocument(doc);
      totalChunks += count;
    }
    return totalChunks;
  }

  /**
   * Ingest raw text directly.
   */
  public async ingestText(text: string, metadata: Partial<DocumentMetadata> = {}): Promise<number> {
    const doc = DocumentLoader.fromText(text, metadata);
    return this.addDocument(doc);
  }

  /**
   * Ingest a single file.
   */
  public async ingestFile(filePath: string, metadata: Partial<DocumentMetadata> = {}): Promise<number> {
    const doc = DocumentLoader.fromFile(filePath, metadata);
    return this.addDocument(doc);
  }

  /**
   * Ingest all supported files in a directory.
   */
  public async ingestDirectory(dirPath: string): Promise<number> {
    const docs = DocumentLoader.fromDirectory(dirPath);
    return this.addDocuments(docs);
  }

  /**
   * Query the knowledge base and generate an augmented, grounded response.
   */
  public async query(question: string, options: QueryOptions = {}): Promise<RagResponse> {
    const startTime = Date.now();
    const topK = options.topK ?? this.config.topK;
    const similarityThreshold = options.similarityThreshold ?? this.config.similarityThreshold;

    // 1. Vector Search for relevant chunks
    const queryVector = await this.embeddingService.embedText(question);
    const searchResults = this.vectorStore.search(queryVector, topK, similarityThreshold, options.filter);

    // 2. Prepare Citations
    const citations: Citation[] = searchResults.map((r) => ({
      source: r.chunk.metadata.source,
      chunkId: r.chunk.id,
      snippet: r.chunk.content.substring(0, 160).replace(/\s+/g, ' ') + (r.chunk.content.length > 160 ? '...' : ''),
      score: Math.round(r.score * 1000) / 1000,
      chunkIndex: r.chunk.chunkIndex,
    }));

    // Calculate approximate confidence
    const confidence =
      searchResults.length > 0
        ? Math.min(1, Math.round((searchResults.reduce((acc, cur) => acc + cur.score, 0) / searchResults.length) * 100) / 100)
        : 0;

    // 3. Generate Answer
    let answer = '';
    const usedModel = this.config.llmModel;

    if (searchResults.length === 0) {
      // Out of domain or no relevant context in knowledge base
      if (this.genAI) {
        answer = await this.generateGeneralAnswer(question, options);
      } else {
        answer = `I could not find any relevant information in the knowledge base regarding "${question}". Please upload or index relevant documents.`;
      }
    } else {
      // Build Grounded RAG Context
      const contextBlocks = searchResults
        .map((r, i) => `[Source ${i + 1}: ${r.chunk.metadata.title || r.chunk.metadata.source} (Relevance: ${(r.score * 100).toFixed(1)}%)]\n${r.chunk.content}`)
        .join('\n\n---\n\n');

      const systemInstruction =
        options.systemPrompt ||
        `You are an expert AI RAG (Retrieval-Augmented Generation) agent.
Your primary task is to answer the user's question accurately and concisely using ONLY the provided Knowledge Context.
Rules:
1. Base your answer strictly on the facts present in the Knowledge Context.
2. Cite the sources where appropriate using [Source X] notation.
3. If the answer cannot be determined from the Knowledge Context, clearly state what information is missing.
4. Maintain a professional, helpful, and concise tone.`;

      const prompt = `Knowledge Context:
---------------------
${contextBlocks}
---------------------

User Question: ${question}

Please provide a well-structured answer with citations to the sources above.`;

      if (this.genAI) {
        try {
          const model = this.genAI.getGenerativeModel({
            model: usedModel,
            systemInstruction: systemInstruction,
          });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options.temperature ?? 0.2,
            },
          });

          answer = result.response.text();
        } catch (error: any) {
          console.warn(`LLM generation error: ${error?.message || error}. Generating local summary response.`);
          answer = this.generateFallbackRagAnswer(question, searchResults);
        }
      } else {
        answer = this.generateFallbackRagAnswer(question, searchResults);
      }
    }

    const latencyMs = Date.now() - startTime;
    return {
      query: question,
      answer,
      citations,
      retrievedChunksCount: searchResults.length,
      confidence,
      usedModel,
      latencyMs,
    };
  }

  /**
   * Conversational query retaining dialogue history.
   */
  public async chat(message: string, options: QueryOptions = {}): Promise<RagResponse> {
    this.conversationHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    const response = await this.query(message, options);
    this.conversationHistory.push({ role: 'assistant', content: response.answer, timestamp: new Date().toISOString() });
    return response;
  }

  public getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  public clearHistory(): void {
    this.conversationHistory = [];
  }

  public getStats(): IngestionStats {
    return this.vectorStore.getStats();
  }

  public getChunks() {
    return this.vectorStore.getChunks();
  }

  public deleteDocument(docId: string): number {
    return this.vectorStore.deleteDocument(docId);
  }

  public clearKnowledge(): void {
    this.vectorStore.clear();
  }

  private async generateGeneralAnswer(question: string, options: QueryOptions): Promise<string> {
    if (!this.genAI) {
      return `No matching knowledge context found for: "${question}".`;
    }
    try {
      const model = this.genAI.getGenerativeModel({ model: this.config.llmModel });
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Note: The knowledge base does not contain specific documents on this topic. Please answer the question generally and clarify that this is general knowledge:\n\nQuestion: ${question}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.3,
        },
      });
      return result.response.text();
    } catch (err: any) {
      return `No matching knowledge found in vector database for "${question}". (${err?.message || ''})`;
    }
  }

  private generateFallbackRagAnswer(question: string, results: { chunk: any; score: number }[]): string {
    const topSnippet = results.map((r, i) => `[Source ${i + 1}: ${r.chunk.metadata.title || r.chunk.metadata.source}]\n${r.chunk.content}`).join('\n\n');
    return `Based on the retrieved context for "${question}":\n\n${topSnippet}`;
  }
}
