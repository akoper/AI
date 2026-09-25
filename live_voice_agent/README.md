# 🎙️ Live Voice Agent

A real-time, live voice understanding agent built with **TypeScript**, **Google ADK (`@google/adk`)**, and **Gemini 2.5 Flash**.

The agent listens to live streaming microphone audio, detects speech activity in real time, understands user speech, performs semantic intent recognition, calls integrated tools, and responds both visually and with voice synthesis (TTS).

---

## 🚀 Features

- **Live Voice Streaming & Processing**:
  - Continuous PCM / WAV audio streaming over WebSocket (`ws://localhost:3003/ws/live`).
  - Voice Activity Detection (VAD) with energy thresholding and automatic silence finalization.
  - Multi-sample rate support with 16kHz speech recognition optimization.
- **Google ADK (`@google/adk`) Agent Execution**:
  - Uses official Google Agent Development Kit (`@google/adk`) with `Agent`, `FunctionTool`, and `InMemoryRunner`.
  - Real-time speech-to-intent understanding, context memory, and spoken answer formatting.
- **Built-in Voice Tools (Agent Actions)**:
  - 🕒 `get_current_time`: Timezone-aware live time and date reporting.
  - ⛅ `get_weather`: Weather forecasts for cities worldwide.
  - 🧮 `calculate`: Safe mathematical evaluations and unit conversions.
  - 📝 `save_voice_note` & `list_voice_notes`: Dictated voice notes repository.
  - ⏰ `set_reminder`: Natural speech reminder scheduling.
- **Modern Interactive Web UI**:
  - Live circular microphone button with stateful pulsing animations.
  - HTML5 Canvas Real-Time Audio Frequency Spectrum Visualizer.
  - Live conversation stream with intent badges and tool execution highlights.
  - Text-to-Speech (TTS) audio output with voice selector.
  - Settings panel for persona and model selection.
- **CLI Interface**:
  - Terminal-based test runner, tone generator, tool suite execution, and voice text interaction.

---

## 📁 Project Structure

```
live_voice_agent/
├── .env                  # Environment configuration with Gemini API key
├── .env.example          # Example environment configuration
├── package.json          # Dependencies and npm scripts
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── config.ts         # Environment & app configuration
│   ├── types.ts          # TypeScript interfaces for WebSocket, intents, tools, & messages
│   ├── google-adk.ts     # Google ADK (@google/adk) Agent & InMemoryRunner integration
│   ├── voice-processor.ts# Audio chunking, PCM/WAV conversion, VAD energy calculation
│   ├── tools.ts          # Agent voice tools registry & execution handlers
│   ├── live-session.ts   # Live WebSocket streaming session management & speech chunker
│   ├── server.ts         # Express HTTP + WebSocket server
│   └── cli.ts            # Interactive CLI runner
├── public/
│   ├── index.html        # Web interface with microphone visualizer
│   ├── style.css         # Dark theme styling & animations
│   └── app.js            # Frontend Web Audio API streaming & WebSocket client
└── tests/
    └── agent.test.ts     # Test suite for voice processor, tools, and agent
```

---

## ⚙️ Quick Start

### 1. Installation

```bash
cd live_voice_agent
npm install
```

### 2. Configure Environment

Create or edit `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=3003
VOICE_AGENT_NAME=Aria
VOICE_AGENT_PERSONA=an intelligent, helpful, and concise live voice AI assistant that understands real-time speech and answers naturally.
```

### 3. Run Development Server

```bash
npm run dev
```

Open your browser at `http://localhost:3003`.

### 4. Run CLI Runner

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
| `GET` | `/api/status` | Health check, configured model, active live sessions |
| `POST` | `/api/voice/process-audio` | Direct audio upload (`base64`, `mimeType`) processing |
| `POST` | `/api/voice/understand` | Voice text query understanding & intent extraction |
| `POST` | `/api/chat` | Text chat fallback |
| `GET` | `/api/tools` | List registered tools and JSON schemas |
| `GET` | `/api/notes` | List saved voice notes |

### WebSocket Protocol (`/ws/live`)

- **Client Messages**:
  - `start_session`: Configures or restarts a voice session.
  - `audio_chunk`: Sends Base64 audio PCM/WAV chunks in real-time.
  - `stop_speech`: Signals that user finished speaking.
  - `text_input`: Sends fallback text messages.
- **Server Messages**:
  - `session_ready`: Session initialization confirmed.
  - `speech_started`: Voice Activity Detection detected user speech onset.
  - `transcription_final`: Speech transcript extracted from audio.
  - `agent_thinking`: Agent processing audio and planning response.
  - `tool_calling` / `tool_result`: Tool invocation events.
  - `agent_response_complete`: Completed response message with intent metadata.
