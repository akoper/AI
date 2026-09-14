import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

export interface EmbeddingOptions {
  modelName?: string;
  apiKey?: string;
}

export class EmbeddingService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;
  private cache: Map<string, number[]> = new Map();

  constructor(options: EmbeddingOptions = {}) {
    const key = options.apiKey || config.apiKey;
    this.modelName = options.modelName || config.embeddingModel || 'text-embedding-004';

    if (key) {
      try {
        this.genAI = new GoogleGenerativeAI(key);
      } catch (err) {
        console.warn('Could not initialize GoogleGenerativeAI for embeddings:', err);
      }
    }
  }

  /**
   * Generates embedding vector for given text string.
   */
  public async embedText(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      return new Array(768).fill(0);
    }

    if (this.cache.has(trimmed)) {
      return this.cache.get(trimmed)!;
    }

    if (this.genAI) {
      const candidateModels = [
        this.modelName,
        'embedding-001',
        'models/embedding-001',
        'text-embedding-004',
      ];
      for (const modelCandidate of candidateModels) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelCandidate });
          const result = await model.embedContent(trimmed);
          if (result && result.embedding && result.embedding.values) {
            const vector = result.embedding.values;
            this.cache.set(trimmed, vector);
            return vector;
          }
        } catch {
          // try next candidate
        }
      }
    }

    // Fallback deterministic TF-IDF style / semantic token embedding for offline testing or without API key
    const fallbackVector = this.generateDeterministicEmbedding(trimmed);
    this.cache.set(trimmed, fallbackVector);
    return fallbackVector;
  }

  /**
   * Generates embedding vectors for an array of text chunks.
   */
  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const vector = await this.embedText(text);
      results.push(vector);
    }
    return results;
  }

  /**
   * Compute cosine similarity between two numerical vectors.
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(-1, Math.min(1, similarity));
  }

  /**
   * Generates deterministic high-dimensional embedding based on word frequencies and character n-grams.
   * Useful for offline execution, testing, or graceful degradation.
   */
  private generateDeterministicEmbedding(text: string, dimensions = 768): number[] {
    const vector = new Array(dimensions).fill(0);
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = normalized.split(/\s+/).filter(Boolean);

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      
      const idx = Math.abs(hash) % dimensions;
      vector[idx] += 1.0 / Math.sqrt(w + 1);

      // Character bigrams for subword match
      for (let i = 0; i < word.length - 1; i++) {
        const bg = word.substring(i, i + 2);
        let bgHash = bg.charCodeAt(0) * 31 + bg.charCodeAt(1);
        const bgIdx = Math.abs(bgHash) % dimensions;
        vector[bgIdx] += 0.5;
      }
    }

    // Normalize vector
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    if (norm > 0) {
      const sqrtNorm = Math.sqrt(norm);
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= sqrtNorm;
      }
    }

    return vector;
  }
}
