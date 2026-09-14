# 🤖 Gemini RAG AI Agent (TypeScript & Google ADK)

An intelligent, autonomous AI Agent with **Retrieval-Augmented Generation (RAG)** built with **TypeScript**, powered by **Google Agent Development Kit (`@google/adk`)** and **Google Gemini API** (`gemini-2.5-flash` and `text-embedding-004`).

---

## 🌟 Key Features

- **🚀 Google ADK Integration (`@google/adk`)**:
  - Implements official Google ADK `Agent` (`LlmAgent`) and `InMemoryRunner`.
  - Native ADK `FunctionTool` implementations (`search_knowledge_base`, `ingest_document`, `get_knowledge_base_stats`).
  - Multi-turn conversation sessions with ADK session management and event streaming.
- **🧠 End-to-End RAG Architecture**:
  - Semantic vector search with cosine similarity scoring.
  - Recursive text chunking with configurable chunk sizes & overlap.
  - Multi-document ingestion (Text, Markdown, JSON, CSV).
  - Grounded prompt synthesis with automatic citation badges and source attribution.
- **⚡ Dual Mode Execution**:
  - **Interactive CLI**: Command-line terminal chat interface with mode toggling (`/mode` between Google ADK and Direct) and commands (`/add`, `/file`, `/stats`, `/clear`).
  - **Modern Web Studio**: Full-featured web interface with live chat, knowledge base stats, citation inspector, and chunk explorer.
- **🔑 Seamless Environment Key Loading**: Automatically detects `GEMINI_API_KEY` or `GOOGLE_API_KEY` from current or parent directories.
- **💾 Flexible Vector Storage**: In-memory vector index with optional JSON disk persistence.
- **🧪 Comprehensive Test Suite**: 30 automated unit & integration tests covering ADK tools, ADK runner queries, chunking, cosine math, and vector store CRUD.

---

## 📁 Project Structure

```
rag_agent/
├── data/
│   ├── knowledge/               # Sample knowledge documents (Markdown, TXT)
│   │   ├── quantum_computing.md
│   │   └── autonomous_agents.md
│   └── vector_store.json        # Persistent vector index
├── public/                      # Web Studio Frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/                         # TypeScript Source Code
│   ├── config.ts                # Environment & configuration loader
│   ├── types.ts                 # Type definitions & interfaces
│   ├── chunker.ts               # Recursive text chunker & splitter
│   ├── embeddings.ts            # Google Gemini embedding service
│   ├── vector-store.ts          # Vector store & cosine similarity search
│   ├── document-loader.ts       # Document & directory loaders
│   ├── adk-rag-agent.ts         # Google ADK RAG Agent & Function Tools
│   ├── rag-agent.ts             # Direct RAG Agent engine
│   ├── index.ts                 # Module exports
│   ├── server.ts                # Express REST API & Web server
│   └── cli.ts                   # Interactive CLI chat (supports Google ADK)
├── tests/                       # Automated unit & integration tests
│   └── rag.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd rag_agent
npm install
```

### 2. Configure Environment Key
The agent automatically loads `GEMINI_API_KEY` from `.env` or parent `.env`.

### 3. Run Automated Tests
```bash
npm test
```

### 4. Launch Interactive CLI
```bash
npm run cli
```

CLI Commands:
- `/mode` — Toggle between Google ADK and Direct mode
- `/stats` — Show knowledge base statistics
- `/add <text>` — Ingest raw text directly
- `/file <path>` — Ingest a local file
- `/clear` — Clear conversation history
- `/exit` — Exit CLI

### 5. Launch Web Studio
```bash
npm run dev
# or build and start
npm run build
npm start
```
Open **http://localhost:3001** in your browser.

---

## 🔌 REST API Endpoints

### Google ADK Endpoints
- `POST /api/adk/query` — Query knowledge base via Google ADK Agent (`@google/adk`):
  ```json
  {
    "query": "Who is leading the quantum computing initiative?",
    "topK": 4,
    "similarityThreshold": 0.25
  }
  ```
- `POST /api/adk/chat` — Multi-turn conversation with Google ADK session runner:
  ```json
  {
    "message": "Tell me more about their architecture.",
    "sessionId": "session_123"
  }
  ```

### Direct RAG & Management Endpoints
- `POST /api/query` — Direct RAG query
- `POST /api/chat` — Direct multi-turn conversational query
- `POST /api/documents/text` — Ingest raw text document
- `POST /api/documents/file` — Ingest document file by path
- `GET /api/documents` — List indexed chunks & stats
- `DELETE /api/documents/:id` — Delete a document
- `DELETE /api/documents` — Clear entire knowledge base
- `GET /api/health` — Agent status, framework, and model info
