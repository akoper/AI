# 🤖 Google ADK Multi-Turn Conversational Agent

A state-of-the-art multi-turn conversational AI agent built with **TypeScript**, **Google ADK (`@google/adk`)**, and **Gemini 2.5 Flash**.

The agent maintains coherent multi-turn conversational memory, executes dynamic function-calling tools across dialog turns, supports conversation session branching/forking, prunes and manages context windows, and offers both a modern Web UI with real-time WebSocket streaming and an interactive CLI runner.

---

## 🚀 Features

- **Multi-Turn Context & Memory Management**:
  - Full conversation turn tracking with system instructions and user/model histories.
  - Persistent session memory for key-value facts, user preferences, notes, and todos across turns.
  - Context window management and history pruning when conversations scale.
  - Session branching/forking (`/fork`) to explore alternate conversation paths from any turn.
- **Google ADK Function Calling & Agent Execution**:
  - Powered by official Google ADK (`@google/adk`) `Agent`, `FunctionTool`, and `InMemoryRunner` with **Gemini 2.5 Flash** / **Gemini 2.5 Pro** / **Gemini 2.0 Flash**.
  - Dynamic tool calling loop with multi-step reasoning:
    - 🧮 `calculate`: Safe mathematical evaluations and percentage/formula parsing.
    - 🕒 `get_current_time`: Timezone-aware date and time information.
    - 🧠 `store_memory` & `recall_memory`: Session fact persistence and recall.
    - 📝 `manage_notes`: Notebook manager (add, list, search, delete).
    - 📋 `manage_todos`: Multi-turn task manager (add, list, complete, remove).
    - 🌐 `web_search`: Knowledge base and technical query search.
- **Dual Real-Time Interfaces**:
  - **Modern Interactive Web UI**:
    - Dark mode glassmorphism UI with multi-session sidebar.
    - Real-time WebSocket streaming with live tool invocation indicator and turn badges.
    - Markdown rendering with syntax highlighting.
    - Session settings modal (model switcher, temperature slider, system prompt customizer).
  - **Interactive Terminal CLI**:
    - REPL multi-turn interface with colored streaming output.
    - Slash command suite: `/help`, `/history`, `/memory`, `/tools`, `/fork`, `/sessions`, `/new`, `/switch`, `/clear`, `/model`, `/exit`.
- **Full REST & WebSocket API**:
  - REST endpoints for sessions CRUD, turn messaging, SSE streaming, and memory access.
  - WebSocket interface at `/ws/chat` for streaming deltas and tool lifecycle events.

---

## 📁 Project Structure

```
multiturn_agent/
├── .env                  # Environment configuration with Gemini API key
├── .env.example          # Example environment configuration
├── package.json          # Dependencies, scripts, and metadata
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── config.ts         # Configuration loader and validator
│   ├── types.ts          # TypeScript type definitions for turns, tools, and sessions
│   ├── tools.ts          # Multi-turn tool definitions & execution registry
│   ├── session-manager.ts# Conversation sessions storage, branching & memory manager
│   ├── adk-agent.ts      # Core Google ADK / Gemini Multi-Turn Agent
│   ├── server.ts         # Express HTTP REST API & WebSocket server
│   └── cli.ts            # Interactive terminal CLI REPL
├── public/
│   ├── index.html        # Modern Web UI structure
│   ├── style.css         # Dark theme styling and animations
│   └── app.js            # Frontend WebSocket client and markdown renderer
├── tests/
│   └── agent.test.ts     # Automated test suite (Session, Tools, Agent, REST)
└── data/
    └── sessions.json     # Saved conversation sessions
```

---

## ⚙️ Quick Start

### 1. Installation

```bash
cd multiturn_agent
npm install
```

### 2. Configure Environment

Create or edit `.env`:

```env
# Google Gen AI / ADK API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model for Multi-Turn Agent
GEMINI_MODEL=gemini-2.5-flash

# Server Port
PORT=3004

# Agent Identity & Behavior
AGENT_NAME=Nexus
AGENT_ROLE=an advanced multi-turn conversational AI assistant with memory and dynamic tool execution
MAX_HISTORY_TURNS=50
ENABLE_AUTO_TOOL_CALLING=true
```

### 3. Run Development Server

```bash
npm run dev
```

Open your browser at `http://localhost:3004`.

### 4. Run Interactive CLI

```bash
npm run cli
```

### 5. Run Test Suite

```bash
npm test
```

### 6. Build for Production

```bash
npm run build
npm start
```

---

## 📡 API & WebSocket Specification

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Health check, configured model, active sessions count |
| `GET` | `/api/sessions` | List all conversation sessions |
| `POST` | `/api/sessions` | Create a new multi-turn session |
| `GET` | `/api/sessions/:id` | Get session details and full turn history |
| `PUT` | `/api/sessions/:id` | Update session settings (model, system prompt, temperature) |
| `DELETE` | `/api/sessions/:id` | Delete a conversation session |
| `POST` | `/api/sessions/:id/message` | Send message turn (`{ message: string, stream?: boolean }`) |
| `POST` | `/api/sessions/:id/fork` | Fork conversation at turn number (`{ atTurn?: number }`) |
| `POST` | `/api/sessions/:id/clear` | Clear message turns while preserving session settings |
| `GET` | `/api/sessions/:id/export` | Export session JSON file |
| `GET` | `/api/tools` | List registered tools and JSON schemas |
| `GET` | `/api/memory/:sessionId` | View session memory (facts, notes, todos) |

### WebSocket Protocol (`/ws/chat`)

- **Client Messages**:
  - `init`: `{ type: "init", sessionId: string }`
  - `send_message`: `{ type: "send_message", sessionId: string, text: string }`
  - `clear_session`: `{ type: "clear_session", sessionId: string }`
  - `fork_session`: `{ type: "fork_session", sessionId: string, forkTurn?: number }`
  - `ping`: `{ type: "ping" }`
- **Server Messages**:
  - `session_init`: Session data loaded.
  - `stream_delta`: Streaming text delta from agent.
  - `tool_call_start`: Tool execution initiated (`{ toolName, args }`).
  - `tool_call_result`: Tool execution result (`{ toolName, result, durationMs }`).
  - `turn_complete`: Full turn execution completed with message metadata.
  - `session_forked`: Session branched into a new ID.
  - `error`: Error details.
