import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config.js';
import { defaultAdkAgent } from './adk-agent.js';
import { defaultSessionManager } from './session-manager.js';
import { defaultToolRegistry } from './tools.js';
import { WebSocketClientMessage, WebSocketServerMessage } from './types.js';

validateConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/chat' });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // REST API Endpoints

  // 1. Status & Health
  app.get('/api/status', (req, res) => {
    const sessions = defaultSessionManager.getAllSessions();
    const tools = defaultToolRegistry.getDeclarations();
    res.json({
      status: 'online',
      agent: config.agentName,
      role: config.agentRole,
      model: config.modelName,
      hasApiKey: !!config.apiKey,
      activeSessionsCount: sessions.length,
      availableTools: tools.map(t => t.name),
    });
  });

  // 2. List all Sessions
  app.get('/api/sessions', (req, res) => {
    const sessions = defaultSessionManager.getAllSessions().map(s => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      model: s.model,
      turnsCount: Math.ceil(s.messages.length / 2),
      messagesCount: s.messages.length,
      parentSessionId: s.parentSessionId,
      forkedAtTurn: s.forkedAtTurn,
    }));
    res.json({ sessions });
  });

  // 3. Create Session
  app.post('/api/sessions', (req, res) => {
    const { title, model, systemInstruction, temperature } = req.body;
    const session = defaultSessionManager.createSession({
      title,
      model,
      systemInstruction,
      temperature,
    });
    res.status(201).json({ session });
  });

  // 4. Get Session Details
  app.get('/api/sessions/:id', (req, res) => {
    const session = defaultSessionManager.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ session });
  });

  // 5. Update Session Settings
  app.put('/api/sessions/:id', (req, res) => {
    const session = defaultSessionManager.updateSession(req.params.id, req.body);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ session });
  });

  // 6. Delete Session
  app.delete('/api/sessions/:id', (req, res) => {
    const deleted = defaultSessionManager.deleteSession(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, id: req.params.id });
  });

  // 7. Send Multi-Turn Message (supports SSE streaming or synchronous JSON)
  app.post('/api/sessions/:id/message', async (req, res) => {
    const sessionId = req.params.id;
    const { message, stream } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message string is required' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        await defaultAdkAgent.interact(sessionId, message, {
          onDelta: (delta, fullText) => {
            res.write(`data: ${JSON.stringify({ type: 'delta', delta, fullText })}\n\n`);
          },
          onToolCallStart: (toolName, args) => {
            res.write(`data: ${JSON.stringify({ type: 'tool_start', toolName, args })}\n\n`);
          },
          onToolCallComplete: (toolName, result, durationMs) => {
            res.write(`data: ${JSON.stringify({ type: 'tool_complete', toolName, result, durationMs })}\n\n`);
          },
          onTurnComplete: (turnResult) => {
            res.write(`data: ${JSON.stringify({ type: 'turn_complete', result: turnResult })}\n\n`);
            res.end();
          },
        });
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      }
    } else {
      try {
        const turnResult = await defaultAdkAgent.interact(sessionId, message);
        res.json({ result: turnResult });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // 8. Fork Session
  app.post('/api/sessions/:id/fork', (req, res) => {
    const { atTurn } = req.body;
    try {
      const forked = defaultSessionManager.forkSession(req.params.id, atTurn !== undefined ? parseInt(atTurn, 10) : undefined);
      res.status(201).json({ session: forked });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 9. Clear Session Conversation History
  app.post('/api/sessions/:id/clear', (req, res) => {
    const session = defaultSessionManager.clearHistory(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, session });
  });

  // 10. Export Session JSON
  app.get('/api/sessions/:id/export', (req, res) => {
    const session = defaultSessionManager.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="session-${session.id}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(session, null, 2));
  });

  // 11. List Registered Tools
  app.get('/api/tools', (req, res) => {
    res.json({ tools: defaultToolRegistry.getDeclarations() });
  });

  // 12. View Session Memory
  app.get('/api/memory/:sessionId', (req, res) => {
    const session = defaultSessionManager.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ memory: session.memory });
  });

  // WebSocket Server Handling
  wss.on('connection', (ws: WebSocket) => {
    let currentSessionId: string | null = null;

    const send = (msg: WebSocketServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', async (raw: string) => {
      try {
        const payload: WebSocketClientMessage = JSON.parse(raw.toString());

        switch (payload.type) {
          case 'init': {
            const session = defaultSessionManager.getOrCreateSession(payload.sessionId);
            currentSessionId = session.id;
            if (payload.systemInstruction || payload.model || payload.temperature !== undefined) {
              defaultSessionManager.updateSession(session.id, {
                systemInstruction: payload.systemInstruction,
                model: payload.model,
                temperature: payload.temperature,
              });
            }
            send({
              type: 'session_init',
              sessionId: session.id,
              data: session,
            });
            break;
          }

          case 'send_message': {
            const sid = payload.sessionId || currentSessionId;
            if (!sid) {
              send({ type: 'error', error: 'No active session ID provided' });
              return;
            }
            if (!payload.text) {
              send({ type: 'error', error: 'Message text cannot be empty' });
              return;
            }

            try {
              await defaultAdkAgent.interact(sid, payload.text, {
                onDelta: (delta, fullText) => {
                  send({
                    type: 'stream_delta',
                    sessionId: sid,
                    data: { delta, fullText },
                  });
                },
                onToolCallStart: (toolName, args) => {
                  send({
                    type: 'tool_call_start',
                    sessionId: sid,
                    data: { toolName, args },
                  });
                },
                onToolCallComplete: (toolName, result, durationMs) => {
                  send({
                    type: 'tool_call_result',
                    sessionId: sid,
                    data: { toolName, result, durationMs },
                  });
                },
                onTurnComplete: (result) => {
                  send({
                    type: 'turn_complete',
                    sessionId: sid,
                    data: result,
                  });
                },
              });
            } catch (err: any) {
              send({ type: 'error', sessionId: sid, error: err.message });
            }
            break;
          }

          case 'clear_session': {
            const sid = payload.sessionId || currentSessionId;
            if (sid) {
              const session = defaultSessionManager.clearHistory(sid);
              send({ type: 'session_cleared', sessionId: sid, data: session });
            }
            break;
          }

          case 'fork_session': {
            const sid = payload.sessionId || currentSessionId;
            if (sid) {
              const forked = defaultSessionManager.forkSession(sid, payload.forkTurn);
              currentSessionId = forked.id;
              send({ type: 'session_forked', sessionId: forked.id, data: forked });
            }
            break;
          }

          case 'ping': {
            send({ type: 'pong' });
            break;
          }
        }
      } catch (err: any) {
        send({ type: 'error', error: `Invalid WebSocket payload: ${err.message}` });
      }
    });
  });

  return { app, server, wss };
}

// Start server only if executed directly as main script
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isMainModule) {
  const { server } = createServer();
  const PORT = config.port;
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🤖 Google ADK Multi-Turn Agent Server Running`);
    console.log(`📡 HTTP & WebSocket: http://localhost:${PORT}`);
    console.log(`🧠 Model: ${config.modelName}`);
    console.log(`🛠️ Auto Tool Calling: ${config.enableAutoToolCalling}`);
    console.log(`💬 Open your browser at http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}
