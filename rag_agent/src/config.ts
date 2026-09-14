import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env in current directory, project directory, and root directory
const cwd = process.cwd();
const possiblePaths = [
  path.resolve(cwd, '.env'),
  path.resolve(cwd, 'rag_agent', '.env'),
  path.resolve(cwd, '..', '.env'),
  path.resolve(cwd, '..', '..', '.env'),
];

for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Fallback default dotenv config
dotenv.config();

export interface RagConfig {
  apiKey: string;
  embeddingModel: string;
  llmModel: string;
  port: number;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  storagePath?: string;
}

export const config: RagConfig = {
  apiKey:
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    '',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
  llmModel: process.env.GEMINI_MODEL || process.env.LLM_MODEL || 'gemini-2.5-flash',
  port: parseInt(process.env.PORT || '3001', 10),
  chunkSize: parseInt(process.env.CHUNK_SIZE || '500', 10),
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '100', 10),
  topK: parseInt(process.env.TOP_K || '4', 10),
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.3'),
  storagePath: process.env.STORAGE_PATH || path.resolve(cwd, 'data', 'vector_store.json'),
};

export function validateConfig(): void {
  if (!config.apiKey) {
    console.warn(
      '⚠️ Warning: No Gemini API Key found in .env (checked GEMINI_API_KEY, GOOGLE_API_KEY). RAG Agent will operate in offline/mock embedding mode unless key is provided.'
    );
  }
}
