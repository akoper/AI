# Google Gemini RAG (Retrieval-Augmented Generation) Learning Lab

This application is an educational, interactive Node.js & Express application demonstrating how Retrieval-Augmented Generation (RAG) works end-to-end using Google's Gemini AI SDK (`@google/genai`).

---

## 🎓 The 5 Fundamental Stages of RAG

1. **Ingestion & Chunking (`services/chunker.js`)**:
   - Long documents are broken down into smaller segments (e.g. 250 characters with 40-character sliding overlap).
   - This ensures text segments are cohesive and fit within embedding model sweet spots.

2. **Vector Embeddings (`services/gemini.js`)**:
   - Each chunk is converted into high-dimensional numerical vectors using Google's `gemini-embedding-001` (or `gemini-embedding-2`).
   - Semantically related concepts map closer together in vector space.

3. **Vector Storage & Indexing (`services/vectorStore.js`)**:
   - The chunk vectors and metadata (document title, chunk id, text) are indexed in memory.

4. **Vector Retrieval & Cosine Similarity (`services/vectorStore.js` / `services/ragPipeline.js`)**:
   - When the user asks a question, the query itself is converted into an embedding.
   - The system computes **Cosine Similarity** ($\frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$) between the query vector and all stored document chunk vectors to retrieve the Top-K most relevant chunks.

5. **Prompt Augmentation & Grounded Generation (`services/gemini.js`)**:
   - The retrieved knowledge chunks are injected into a structured system prompt.
   - Gemini (`gemini-3.8-flash`) generates a factual answer strictly grounded in the retrieved sources with source citations, preventing hallucinations.

---

## 🚀 Getting Started

### 1. Configuration
Create a `.env` file in the project root (optional if entering key directly into the UI):
```env
PORT=3000
GOOGLE_GEMINI_KEY=your_gemini_api_key_here
```

### 2. Start the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Using the Interactive Learning Lab
1. **API Key**: If not set in `.env`, enter your Gemini API key in the top navigation bar.
2. **Seed Tutorial Docs**: Click **"🌱 Seed Sample Docs"** to vectorize sample knowledge regarding Gemini and RAG architectures.
3. **Preset Example Templates**: Choose from realistic example templates in the **"📋 Preset Example"** dropdown (e.g. *Quantum Computing*, *Apollo 11 Lunar Mission*, *Acme Corp Remote Work Policy*).
4. **Interactive Suggested Questions**: Clicking any suggested question auto-fills the question box.
5. **Add Your Own Docs**: Use the Ingestion panel to chunk and vectorize any custom text or articles.
6. **Run RAG Queries**: Ask questions in the query box and click **"🚀 Run RAG"**.
7. **Inspect the Pipeline**: Expand each step in the **Step-by-Step Pipeline Inspector** to see the exact vector previews, cosine similarity scores, system instructions, and augmented prompt sent to Gemini!

---

## 📁 Included Example Documents (`examples/`)

- **`acme_corp_remote_work_policy.md`**: Enterprise HR and remote work guidelines (reimbursement stipend, core hours, international policies).
- **`apollo_11_mission.md`**: Historical aerospace mission report (landing coordinates, crew roles, sample collection).
- **`quantum_computing_overview.md`**: Technical explanation of qubits, superposition, entanglement, and quantum decoherence.
- **`example_documents.json`**: Structured dataset containing all examples with suggested test queries for automated testing and UI ingestion.
