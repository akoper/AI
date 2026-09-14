import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { agent } from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static frontend
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

// API Status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(config.apiKey),
    model: config.modelName,
  });
});

// Process Dictation endpoint
app.post('/api/dictate', async (req: Request, res: Response) => {
  try {
    const { text, mode, tone } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required for dictation processing.' });
      return;
    }

    const polished = await agent.polishDictation(text, { mode, tone });
    res.json({ result: polished });
  } catch (error: any) {
    console.error('Dictation error:', error);
    res.status(500).json({ error: error.message || 'Failed to process dictation.' });
  }
});

// Talk to Agent endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    const reply = await agent.talkToAgent(message, history || []);
    res.json({ reply });
  } catch (error: any) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with agent.' });
  }
});

// Audio transcription endpoint
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 is required.' });
      return;
    }

    const transcript = await agent.transcribeAudio(audioBase64, mimeType || 'audio/webm');
    res.json({ transcript });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message || 'Failed to transcribe audio.' });
  }
});

// Fallback to index.html
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🎙️ Dictation Agent Server running at http://localhost:${PORT}`);
  console.log(`🔑 API Key Configured: ${Boolean(config.apiKey) ? 'Yes (Loaded from .env)' : 'No'}`);
  console.log(`🤖 Gemini Model: ${config.modelName}`);
});
