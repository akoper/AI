/**
 * Vector Store implementation in memory (with disk persistence option if needed).
 * Computes Cosine Similarity between vector embeddings.
 */

// Cosine similarity formula: dot(A, B) / (norm(A) * norm(B))
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class VectorStore {
  constructor() {
    /**
     * @type {Array<{
     *   id: string,
     *   docId: string,
     *   source: string,
     *   content: string,
     *   embedding: number[],
     *   createdAt: Date
     * }>}
     */
    this.vectors = [];
    /**
     * @type {Array<{id: string, title: string, content: string, chunkCount: number, createdAt: Date}>}
     */
    this.documents = [];
  }

  addDocument(docId, title, content, chunksWithEmbeddings) {
    // Remove previous version if exists
    this.removeDocument(docId);

    this.documents.push({
      id: docId,
      title,
      content,
      chunkCount: chunksWithEmbeddings.length,
      createdAt: new Date()
    });

    for (let i = 0; i < chunksWithEmbeddings.length; i++) {
      const item = chunksWithEmbeddings[i];
      this.vectors.push({
        id: `${docId}_chunk_${i}`,
        docId,
        source: title,
        chunkIndex: i,
        content: item.chunk,
        embedding: item.embedding,
        createdAt: new Date()
      });
    }
  }

  removeDocument(docId) {
    this.documents = this.documents.filter(d => d.id !== docId);
    this.vectors = this.vectors.filter(v => v.docId !== docId);
  }

  getDocuments() {
    return this.documents;
  }

  getChunks() {
    return this.vectors.map(v => ({
      id: v.id,
      docId: v.docId,
      source: v.source,
      chunkIndex: v.chunkIndex,
      content: v.content,
      embeddingLength: v.embedding ? v.embedding.length : 0,
      embeddingPreview: v.embedding ? v.embedding.slice(0, 5) : []
    }));
  }

  /**
   * Search for top-K most similar chunks to query embedding.
   * @param {number[]} queryEmbedding
   * @param {number} topK
   * @param {number} similarityThreshold
   */
  similaritySearch(queryEmbedding, topK = 3, similarityThreshold = 0.0) {
    if (this.vectors.length === 0) return [];

    const scored = this.vectors.map(vec => {
      const score = cosineSimilarity(queryEmbedding, vec.embedding);
      return {
        id: vec.id,
        docId: vec.docId,
        source: vec.source,
        chunkIndex: vec.chunkIndex,
        content: vec.content,
        score: score,
        embeddingPreview: vec.embedding.slice(0, 5)
      };
    });

    // Sort descending by similarity score
    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(item => item.score >= similarityThreshold)
      .slice(0, topK);
  }

  clear() {
    this.vectors = [];
    this.documents = [];
  }
}

// Singleton instance for the demo app
const vectorStoreInstance = new VectorStore();

module.exports = {
  VectorStore,
  vectorStoreInstance,
  cosineSimilarity
};
