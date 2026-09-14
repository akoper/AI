# Autonomous AI Agents and RAG Architectures

## Core Architecture of AI Agents
An autonomous AI agent typically consists of four foundational subsystems:
1. **Planning**: Goal decomposition, self-reflection, tree-of-thought exploration, and dynamic sub-task routing.
2. **Memory**:
   - Short-term Memory: In-context learning and conversational history within the prompt window.
   - Long-term Memory: External vector databases facilitating semantic retrieval over past experiences and vast documentation (RAG).
3. **Tool Calling & Action Execution**: Ability to invoke external APIs, execute shell commands, query SQL databases, and calculate deterministic results.
4. **Perception**: Multi-modal input handling including audio transcription, computer vision, and structured text streams.

## RAG (Retrieval-Augmented Generation) Pipeline
RAG augments Large Language Models by injecting external knowledge directly into prompts:
1. **Document Ingestion**: Parsing diverse formats (PDF, Markdown, HTML, JSON).
2. **Chunking Strategy**: Splitting text using semantic boundaries (paragraphs, headings) with overlapping context windows (e.g. 500 chars with 100 char overlap).
3. **Embedding Generation**: Converting text chunks into dense vector representations (e.g., using Google `text-embedding-004`).
4. **Vector Retrieval**: Performing approximate nearest neighbor or cosine similarity search against user queries.
5. **Grounded Generation**: Prompting the LLM with retrieved relevant context to synthesize hallucination-free responses with explicit citations.
