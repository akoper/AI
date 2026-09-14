export interface DocumentMetadata {
  source: string;
  title?: string;
  author?: string;
  tags?: string[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  chunkIndex: number;
  totalChunks: number;
  metadata: DocumentMetadata;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface QueryOptions {
  topK?: number;
  similarityThreshold?: number;
  filter?: (metadata: DocumentMetadata) => boolean;
  includeSources?: boolean;
  systemPrompt?: string;
  temperature?: number;
}

export interface Citation {
  source: string;
  chunkId: string;
  snippet: string;
  score: number;
  chunkIndex: number;
}

export interface RagResponse {
  query: string;
  answer: string;
  citations: Citation[];
  retrievedChunksCount: number;
  confidence: number;
  usedModel: string;
  latencyMs: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface IngestionStats {
  documentsCount: number;
  chunksCount: number;
  totalCharacters: number;
}
