# Google Gemini Multi-Agent System

An enterprise-grade, distributed **Multi-Agent System** built with **TypeScript**, **Google Gemini** (Gemini 2.5 / 2.0 / 1.5), **Google ADK (Agent Development Kit)**, and advanced orchestration patterns.

---

## Key Features

- **Google Gemini & Google ADK Core**: Native integration with Google Gemini models via `@google/adk`, featuring automatic tool declarations, streaming reasoning, and dynamic context control.
- **6 Specialized Expert Agents**:
  - **Supervisor Agent**: Deconstructs high-level objectives, schedules subtasks, and synthesizes final deliverables.
  - **Researcher Agent**: Performs web searches, documentation queries, and fact extractions.
  - **Coder Agent**: Engineers TypeScript/JavaScript/Python modules, interfaces, and executes algorithms.
  - **Analyst Agent**: Conducts statistical analysis, benchmark evaluations, and metric calculations.
  - **Critic Agent**: Performs adversarial quality audits, security scans, edge-case probing, and verification.
  - **Writer Agent**: Compiles executive summaries, structured documentation, and final reports.
- **4 Multi-Agent Coordination Workflows**:
  - **Supervisor / Hierarchical**: Orchestrator decomposes tasks, delegates to specialist agents, and aggregates results.
  - **Sequential Pipeline**: Multi-stage linear transformation pipeline where each agent advances previous outputs.
  - **Multi-Agent Debate & Consensus**: Proposer and Critic iterate across debate rounds with Arbiter synthesis.
  - **Autonomous Dynamic Handoff**: Agents dynamically route and pass execution control to peer specialists.
- **Shared Blackboard Architecture**: Centralized workspace for inter-agent communication, subtask state tracking, and versioned artifacts.
- **Real-Time Streaming**: Full WebSocket and SSE (Server-Sent Events) live streaming of agent thoughts, tool invocations, and handoffs.
- **Modern Web Dashboard**: Responsive UI for dispatching missions, inspecting topology, watching live reasoning feeds, and viewing generated artifacts.
- **Interactive CLI**: Color-coded terminal interface for executing tasks and monitoring agent workflows.
- **Zero-Configuration Fallback**: Works out-of-the-box with intelligent simulation fallback when no API key is set.

---

## Architecture Overview

```
                        +----------------------------+
                        |     User / Web UI / CLI    |
                        +--------------+-------------+
                                       |
                                       v
                     +----------------------------------+
                     |      MultiAgentCoordinator       |
                     +-----------------+----------------+
                                       |
                   +-------------------+-------------------+
                   |                   |                   |
                   v                   v                   v
            [ Supervisor ]      [ Pipeline ]       [ Debate/Handoff ]
                   |                   |                   |
+------------------+-------------------+-------------------+------------------+
|                              SHARED BLACKBOARD                              |
|  - Subtask Lifecycle   - Versioned Artifacts   - Event Stream Bus           |
+------------------+-------------------+-------------------+------------------+
                   |                   |                   |
    +--------------+---+        +------+-------+    +------+-------+
    | Researcher Agent |        | Coder Agent  |    | Critic Agent |
    +------------------+        +--------------+    +--------------+
    | Analyst Agent    |        | Writer Agent |    | Custom Agent |
    +------------------+        +--------------+    +--------------+
                   |                   |                   |
                   v                   v                   v
+-----------------------------------------------------------------------------+
|                           EXTENSIBLE TOOL REGISTRY                          |
|  * web_search               * code_interpreter        * data_analyzer       |
|  * artifact_manager         * design_pattern_retriever                      |
+-----------------------------------------------------------------------------+
```

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**

### 2. Installation
```powershell
cd multi_agent_system
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env` and provide your Google Gemini API key:
```powershell
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash
PORT=3005
```
*(Note: If `GEMINI_API_KEY` is omitted, the system runs in high-fidelity simulation mode for offline development and testing).*

### 4. Start the Web Dashboard & Server
```powershell
npm run dev
```
Open **http://localhost:3005** in your browser.

---

## Command Line Interface (CLI)

You can launch the interactive CLI or run direct tasks:

```powershell
# Interactive CLI
npm run cli

# Single command execution with specific workflow
npm run cli -- "Design a distributed cache system" --workflow supervisor
npm run cli -- "Audit rate limiting algorithms" --workflow debate
npm run cli -- "Create quantitative benchmarks" --workflow pipeline
```

---

## REST API & WebSocket Reference

### REST Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | System health, model name, agent and tool counts |
| `GET` | `/api/agents` | Specification and tool bindings for all registered agents |
| `GET` | `/api/tools` | Function declarations of all registered tools |
| `GET` | `/api/workflows` | Supported orchestration workflows |
| `POST` | `/api/tasks` | Dispatch a new multi-agent mission |
| `GET` | `/api/tasks` | List historical task executions |
| `GET` | `/api/tasks/:id` | Get complete execution result and artifacts |
| `GET` | `/api/tasks/:id/events`| Server-Sent Events (SSE) live event stream |

### WebSocket Endpoint
- **URL**: `ws://localhost:3005/ws/stream`
- **Events**: Receives real-time `task_started`, `agent_thought`, `tool_called`, `tool_result`, `agent_handoff`, `artifact_created`, and `task_completed` events.

---

## Testing

Run the automated test suite:
```powershell
npm test
```

Build the TypeScript project:
```powershell
npm run build
```

---

## Directory Structure

```
multi_agent_system/
├── src/
│   ├── agents/
│   │   ├── base-agent.ts          # Base Agent with ADK & fallback execution
│   │   └── specialized-agents.ts  # Supervisor, Researcher, Coder, Analyst, Critic, Writer
│   ├── orchestration/
│   │   ├── blackboard.ts          # Shared state, subtask, & artifact manager
│   │   ├── coordinator.ts         # Master Multi-Agent Coordinator
│   │   └── workflows/
│   │       ├── supervisor-workflow.ts
│   │       ├── pipeline-workflow.ts
│   │       ├── debate-workflow.ts
│   │       └── handoff-workflow.ts
│   ├── tools/
│   │   ├── registry.ts            # Tool registry & execution engine
│   │   └── built-in-tools.ts      # Web search, Code interpreter, Data analyzer, etc.
│   ├── config.ts                  # System configuration & environment setup
│   ├── types.ts                   # Core TypeScript type definitions
│   ├── server.ts                  # Express REST API & WebSocket server
│   └── cli.ts                     # Terminal CLI runner
├── public/
│   ├── index.html                 # Interactive Web UI Dashboard
│   ├── style.css                  # Dark-mode styling & responsive layout
│   └── app.js                     # Frontend WebSocket & state manager
├── tests/
│   └── agent.test.ts              # Comprehensive unit and integration test suite
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## License

ISC License.
