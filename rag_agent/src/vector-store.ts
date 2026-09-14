import fs from 'fs';
import path from 'path';
import { DocumentChunk, SearchResult, DocumentMetadata } from './types.js';
import { EmbeddingService } from './embeddings.js';

export class VectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    if (this.filePath && fs.existsSync(this.filePath)) {
      this.loadFromFile(this.filePath);
    }
  }

  public addChunk(chunk: DocumentChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  public addChunks(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
    if (this.filePath) {
      this.saveToFile(this.filePath);
    }
  }

  public search(
    queryEmbedding: number[],
    topK: number = 4,
    minScore: number = 0.1,
    filter?: (meta: DocumentMetadata) => boolean
  ): SearchResult[] {
    const scored: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;
      if (filter && !filter(chunk.metadata)) continue;

      const score = EmbeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minScore) {
        scored.push({ chunk, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  public getChunks(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  public getChunksByDocumentId(documentId: string): DocumentChunk[] {
    return Array.from(this.chunks.values()).filter((c) => c.documentId === documentId);
  }

  public deleteDocument(documentId: string): number {
    let deleted = 0;
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
        deleted++;
      }
    }
    if (this.filePath && deleted > 0) {
      this.saveToFile(this.filePath);
    }
    return deleted;
  }

  public clear(): void {
    this.chunks.clear();
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath);
      } catch {
        // ignore
      }
    }
  }

  public getStats() {
    const docIds = new Set<string>();
    let totalCharacters = 0;

    for (const chunk of this.chunks.values()) {
      docIds.add(chunk.documentId);
      totalCharacters += chunk.content.length;
    }

    return {
      documentsCount: docIds.size,
      chunksCount: this.chunks.size,
      totalCharacters,
    };
  }

  public saveToFile(targetPath: string): void {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.chunks.values()), null, 2);
      fs.writeFileSync(targetPath, data, 'utf-8');
    } catch (err) {
      console.warn(`Failed to persist vector store to ${targetPath}:`, err);
    }
  }

  public loadFromFile(targetPath: string): boolean {
    try {
      if (!fs.existsSync(targetPath)) return false;
      const data = fs.readFileSync(targetPath, 'utf-8');
      const loaded: DocumentChunk[] = JSON.parse(data);
      this.chunks.clear();
      for (const chunk of loaded) {
        this.chunks.set(chunk.id, chunk);
      }
      return true;
    } catch (err) {
      console.warn(`Failed to load vector store from ${targetPath}:`, err);
      return false;
    }
  }
}
