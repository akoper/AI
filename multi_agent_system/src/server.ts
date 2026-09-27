import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config.js';
import { defaultCoordinator } from './orchestration/coordinator.js';
import { defaultToolRegistry } from './tools/registry.js';
import './tools/built-in-tools.js'; // Ensure tools are registered
import { WorkflowTaskRequest, WorkflowTraceEvent } from './types.js';

validateConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/stream' });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Broadcast trace events to all active WebSocket clients
  defaultCoordinator.on('task_event', (evt: WorkflowTraceEvent) => {
    const payload = JSON.stringify({ type: 'event', payload: evt });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  // REST API Endpoints

  // 1. Health & Status
  app.get('/api/status', (req, res) => {
    const agents = defaultCoordinator.getAllAgents();
    const tools = defaultToolRegistry.getAllTools();
    res.json({
      status: 'online',
      model: config.modelName,
      hasApiKey: !!config.apiKey,
      defaultWorkflow: config.defaultWorkflow,
      agentsCount: agents.length,
      toolsCount: tools.length,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Agents List
  app.get('/api/agents', (req, res) => {
    res.json({ agents: defaultCoordinator.getAgentSpecs() });
  });

  // 3. Tools List
  app.get('/api/tools', (req, res) => {
    res.json({ tools: defaultToolRegistry.getDeclarations() });
  });

  // 4. Workflows List
  app.get('/api/workflows', (req, res) => {
    res.json({
      workflows: [
        {
          id: 'supervisor',
          name: 'Supervisor / Hierarchical',
          description:
            'A central Supervisor agent plans, assigns subtasks to specialists (Researcher, Coder, Analyst, Critic, Writer), tracks blackboard state, and synthesizes the final solution.',
          recommendedFor: 'Complex multi-faceted tasks requiring task decomposition and parallel specialist contributions.',
        },
        {
          id: 'pipeline',
          name: 'Sequential Pipeline',
          description:
            'A linear stage-by-stage pipeline where each specialist transforms and advances the previous agent’s output (Researcher ➔ Coder ➔ Analyst ➔ Critic ➔ Writer).',
          recommendedFor: 'Step-by-step artifact development and transformation workflows.',
        },
        {
          id: 'debate',
          name: 'Multi-Agent Debate & Consensus',
          description:
            'A Proposer and Adversarial Critic debate across iterative rounds with an Arbiter evaluating consensus and refining the deliverable.',
          recommendedFor: 'High-accuracy requirements, algorithm audits, and critical decision making.',
        },
        {
          id: 'handoff',
          name: 'Autonomous Dynamic Handoff',
          description:
            'Specialist agents dynamically decide the next best peer to transfer control to until the mission is accomplished.',
          recommendedFor: 'Decentralized problem solving and conversational peer delegation.',
        },
      ],
    });
  });

  // 5. Submit Task Execution
  app.post('/api/tasks', async (req, res) => {
    const { task, workflowType, maxRounds, options } = req.body as WorkflowTaskRequest;

    if (!task || typeof task !== 'string') {
      return res.status(400).json({ error: 'Valid task description string is required.' });
    }

    try {
      const result = await defaultCoordinator.runTask({
        task,
        workflowType,
        maxRounds,
        options,
      });

      res.status(200).json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal execution error' });
    }
  });

  // 6. List Tasks History
  app.get('/api/tasks', (req, res) => {
    const tasks = defaultCoordinator.getAllTaskResults().map((t) => ({
      taskId: t.taskId,
      task: t.task,
      workflowType: t.workflowType,
      status: t.status,
      durationMs: t.durationMs,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      agentsInvolved: t.agentsInvolved,
      artifactsCount: t.artifacts.length,
      messagesCount: t.messages.length,
    }));
    res.json({ tasks });
  });

  // 7. Get Task by ID
  app.get('/api/tasks/:id', (req, res) => {
    const taskResult = defaultCoordinator.getTaskResult(req.params.id);
    if (!taskResult) {
      const active = defaultCoordinator.getActiveTask(req.params.id);
      if (active) {
        return res.json({
          status: 'running',
          taskId: active.taskId,
          subtasks: active.subtasks,
          messages: active.messages,
          artifacts: active.getAllArtifacts(),
          events: active.events,
        });
      }
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ task: taskResult });
  });

  // 8. Server-Sent Events (SSE) Stream
  app.get('/api/tasks/:id/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const listener = (evt: WorkflowTraceEvent) => {
      if (evt.taskId === req.params.id) {
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
      }
    };

    defaultCoordinator.on('task_event', listener);

    req.on('close', () => {
      defaultCoordinator.off('task_event', listener);
    });
  });

  // WebSocket Server Connection Handler
  wss.on('connection', (ws: WebSocket) => {
    ws.send(
      JSON.stringify({
        type: 'status_response',
        payload: {
          connected: true,
          model: config.modelName,
          timestamp: new Date().toISOString(),
        },
      })
    );

    ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'start_task') {
          const req = msg.payload as WorkflowTaskRequest;
          const result = await defaultCoordinator.runTask(req);
          ws.send(JSON.stringify({ type: 'task_result', payload: result }));
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', payload: err.message || String(err) }));
      }
    });
  });

  return { app, server, wss };
}

// Start standalone server when executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  const { server } = createServer();
  server.listen(config.port, () => {
    console.log(`🚀 Multi-Agent System Server is running on http://localhost:${config.port}`);
    console.log(`📊 Web Dashboard available at http://localhost:${config.port}`);
    console.log(`⚡ WebSocket Stream at ws://localhost:${config.port}/ws/stream`);
  });
}
