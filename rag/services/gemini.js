require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

/**
 * Service to interact with Google Gemini AI.
 * Handles:
 * 1. Text embedding generation (using gemini-embedding-001 / gemini-embedding-2)
 * 2. LLM response generation with context grounding (using gemini-3.8-flash)
 */

function getClient(apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.GOOGLE_GEMINI_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_KEY is not set. Please set it in your .env file or provide it in the web interface.');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate embedding vector for a given text.
 * Tries modern and legacy embedding models with automatic fallback.
 * @param {string} text
 * @param {string} [apiKey]
 * @returns {Promise<number[]>} Vector array of float numbers
 */
async function generateEmbedding(text, apiKey) {
  const ai = getClient(apiKey);
  // Active and verified Gemini embedding models
  const modelsToTry = [
    'gemini-embedding-001',
    'gemini-embedding-2',
    'gemini-embedding-2-preview'
  ];

  let lastError;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.embedContent({
        model: model,
        contents: text,
      });

      if (response) {
        if (response.embedding && response.embedding.values) {
          return response.embedding.values;
        }
        if (response.embeddings && response.embeddings[0] && response.embeddings[0].values) {
          return response.embeddings[0].values;
        }
        if (Array.isArray(response.values)) {
          return response.values;
        }
      }
    } catch (err) {
      lastError = err;
      const errMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      // If error is 404 / not found / unsupported method, try next model in fallback list
      if (errMsg.includes('not found') || errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('not supported') || errMsg.includes('deprecated')) {
        continue;
      }
      // For auth or permission errors, throw immediately
      throw err;
    }
  }

  throw lastError || new Error('Failed to generate embedding with available models');
}

/**
 * Generate answer using Gemini given user query and retrieved context chunks.
 * @param {string} query
 * @param {Array<{content: string, source: string, score: number}>} contextChunks
 * @param {string} [apiKey]
 */
async function generateAnswer(query, contextChunks, apiKey) {
  const ai = getClient(apiKey);

  const formattedContext = contextChunks
    .map((chunk, index) => `[Source #${index + 1}: ${chunk.source}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  const systemInstruction = `You are a knowledgeable and accurate AI assistant utilizing Retrieval-Augmented Generation (RAG).
Your goal is to answer the user's question accurately using ONLY the provided Reference Context.
Rules:
1. Base your answer strictly on the provided Context.
2. If the context does not contain enough information to answer the question, clearly state: "I don't have enough information in the provided context to answer that." Do not make up facts.
3. Cite the sources where relevant (e.g., "[Source #1]").
4. Be concise, well-structured, and clear.`;

  const prompt = `Reference Context:
${formattedContext ? formattedContext : 'No relevant documents found.'}

User Question:
${query}

Please provide your answer based on the Reference Context above.`;

  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash'
  ];

  let lastError;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, // Low temperature for high factual adherence
        }
      });

      return {
        answer: response.text,
        promptUsed: prompt,
        systemInstructionUsed: systemInstruction,
        modelUsed: model
      };
    } catch (err) {
      lastError = err;
      const errMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      // If model not found / deprecated / no longer available, fall back to next model
      if (
        errMsg.includes('not found') ||
        errMsg.includes('404') ||
        errMsg.includes('NOT_FOUND') ||
        errMsg.includes('not supported') ||
        errMsg.includes('no longer available') ||
        errMsg.includes('deprecated')
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to generate answer with available models');
}

module.exports = {
  generateEmbedding,
  generateAnswer,
  getClient
};
