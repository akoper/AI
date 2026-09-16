import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config.js';
import { googleAdkAgent } from './google-adk.js';
import { tools, getAllVoiceNotes } from './tools.js';
import { LiveVoiceSession } from './live-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

validateConfig();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static frontend
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Active Live Voice Sessions
const activeSessions = new Map<string, LiveVoiceSession>();

// Initialize WebSocket server for real-time live voice streaming
const wss = new WebSocketServer({ server, path: '/ws/live' });

wss.on('connection', (ws: WebSocket, req) => {
  console.log(`🎙️ Client connected to Live Voice Stream from ${req.socket.remoteAddress}`);
  const session = new LiveVoiceSession(ws);
  activeSessions.set(session.id, session);

  ws.on('close', () => {
    console.log(`🔌 Client disconnected from session ${session.id}`);
    activeSessions.delete(session.id);
  });
});

// Health & Status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agentName: config.agentName,
    hasApiKey: Boolean(config.apiKey),
    model: config.modelName,
    activeSessionsCount: activeSessions.size,
    tools: tools.map((t) => t.name),
  });
});

// Process audio file / recording
app.post('/api/voice/process-audio', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, history } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 is required.' });
      return;
    }

    const result = await googleAdkAgent.processLiveAudio(
      audioBase64,
      mimeType || 'audio/wav',
      history || []
    );

    res.json(result);
  } catch (error: any) {
    console.error('Audio processing error:', error);
    res.status(500).json({ error: error.message || 'Failed to process voice audio.' });
  }
});

// Text understanding endpoint
app.post('/api/voice/understand', async (req: Request, res: Response) => {
  try {
    const { text, history } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text query is required.' });
      return;
    }

    const result = await googleAdkAgent.respondToVoiceInput(text, history || []);
    res.json(result);
  } catch (error: any) {
    console.error('Understanding error:', error);
    res.status(500).json({ error: error.message || 'Failed to understand voice intent.' });
  }
});

// Chat fallback
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    const result = await googleAdkAgent.respondToVoiceInput(message, history || []);
    res.json({ reply: result.reply, intent: result.intent });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to chat.' });
  }
});

// List available tools
app.get('/api/tools', (_req: Request, res: Response) => {
  res.json({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  });
});

// List saved voice notes
app.get('/api/notes', (_req: Request, res: Response) => {
  res.json({
    notes: getAllVoiceNotes(),
  });
});

// Fallback to index.html
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🎙️ Live Voice Agent (${config.agentName}) running at http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Live Voice Stream at ws://localhost:${PORT}/ws/live`);
  console.log(`🔑 API Key Configured: ${Boolean(config.apiKey) ? 'Yes (Loaded from .env)' : 'No'}`);
  console.log(`🤖 Gemini Model: ${config.modelName}`);
});

export { app, server };
