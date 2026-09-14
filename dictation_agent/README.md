# Voice Dictation Agent (TypeScript & Google GenAI)

An intelligent voice dictation and conversation agent built in TypeScript using Google Generative AI SDK (Gemini). It allows you to speak naturally to dictate text, have the agent polish or summarize your words, hold intelligent voice conversations, and click a button to have any text or agent response read back to you aloud.

---

## ✨ Features

- **🗣️ Live Speech Dictation**: Talk directly into your microphone with real-time speech-to-text transcription.
- **🔊 Read Back to Me Button**: Dedicated audio playback button to read your dictated text or agent answers aloud using customizable voices, pitch, and speed.
- **🤖 Google GenAI Gemini Agent**:
  - **Talk to Agent**: Intelligent voice companion answering your questions and executing tasks.
  - **Clean & Polish**: Removes verbal fillers (*"um"*, *"uh"*, *"like"*), fixes grammar, punctuation, and phrasing.
  - **Bullet Points & Summaries**: Formats long dictations into crisp bullet points or summaries.
  - **Email Drafter**: Converts spoken thoughts into professional email drafts.
- **🔑 Automatic `.env` Loading**: Seamlessly picks up `GEMINI_API_KEY` or `GOOGLE_API_KEY` from the project's `.env` file.
- **⚡ Modern UI & CLI**: Beautiful responsive web interface + command-line CLI mode.

---

## 🚀 Quick Start

### 1. Configure `.env`
Ensure your `.env` file in the project root or in `dictation_agent/.env` contains your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### 2. Install Dependencies & Build

```bash
cd dictation_agent
npm install
npm run build
```

### 3. Run the Web Server

```bash
npm start
```
Or for live development:
```bash
npm run dev
```

Open your browser at **`http://localhost:3000`**.

---

## 🎙️ How to Use

1. **Dictate**: Click the 🎤 **Microphone** button and start speaking. Your speech will be transcribed into the text area in real-time. Click again to stop.
2. **Read Back**: Click the 🔊 **"Read Back to Me"** button to hear your dictated text read aloud with synthesized speech.
3. **Talk to Agent**: Click **"🤖 Talk to Agent"** to ask questions, brainstorm, or chat with Gemini.
4. **Polish Dictation**: Click **"✨ Clean & Polish"** to clean up verbal fillers and improve sentence clarity.
5. **Auto-read Toggle**: Enable *"Auto-read agent responses back immediately"* in voice settings for hands-free listening.

---

## 💻 CLI Mode

You can also run the agent directly in your terminal:

```bash
npm run cli
```
