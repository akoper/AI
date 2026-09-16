import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { SessionManager } from '../src/session-manager.js';
import { ToolRegistry } from '../src/tools.js';
import { GoogleAdkMultiTurnAgent } from '../src/adk-agent.js';
import { createServer } from '../src/server.js';

describe('Google ADK Multi-Turn Agent Test Suite', () => {
  describe('SessionManager Tests', () => {
    it('should create and retrieve a new multi-turn session', () => {
      const sm = new SessionManager();
      const session = sm.createSession({ title: 'Test Session', model: 'gemini-2.5-flash' });

      assert.ok(session.id);
      assert.strictEqual(session.title, 'Test Session');
      assert.strictEqual(session.messages.length, 0);

      const retrieved = sm.getSession(session.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved?.id, session.id);
    });

    it('should record multi-turn conversation turns correctly', () => {
      const sm = new SessionManager();
      const session = sm.createSession({ title: 'Turn Test' });

      sm.addMessage(session.id, {
        id: 'msg_1',
        role: 'user',
        parts: [{ text: 'Hello, what is Google ADK?' }],
        timestamp: new Date().toISOString(),
        turnNumber: 1,
      });

      sm.addMessage(session.id, {
        id: 'msg_2',
        role: 'model',
        parts: [{ text: 'Google ADK is the Agent Development Kit.' }],
        timestamp: new Date().toISOString(),
        turnNumber: 1,
      });

      sm.addMessage(session.id, {
        id: 'msg_3',
        role: 'user',
        parts: [{ text: 'Can it handle multiple turns?' }],
        timestamp: new Date().toISOString(),
        turnNumber: 2,
      });

      const updated = sm.getSession(session.id);
      assert.strictEqual(updated?.messages.length, 3);
      assert.strictEqual(updated?.messages[2].turnNumber, 2);
    });

    it('should fork a multi-turn conversation at a specific turn', () => {
      const sm = new SessionManager();
      const session = sm.createSession({ title: 'Original Branch' });

      sm.addMessage(session.id, {
        id: 'm1',
        role: 'user',
        parts: [{ text: 'Turn 1 User' }],
        timestamp: new Date().toISOString(),
        turnNumber: 1,
      });
      sm.addMessage(session.id, {
        id: 'm2',
        role: 'model',
        parts: [{ text: 'Turn 1 Model' }],
        timestamp: new Date().toISOString(),
        turnNumber: 1,
      });
      sm.addMessage(session.id, {
        id: 'm3',
        role: 'user',
        parts: [{ text: 'Turn 2 User' }],
        timestamp: new Date().toISOString(),
        turnNumber: 2,
      });

      const forked = sm.forkSession(session.id, 1);
      assert.ok(forked.id !== session.id);
      assert.strictEqual(forked.parentSessionId, session.id);
      assert.strictEqual(forked.forkedAtTurn, 1);
      assert.strictEqual(forked.messages.length, 2); // only messages up to turn 1
    });

    it('should clear conversation history while preserving session configuration', () => {
      const sm = new SessionManager();
      const session = sm.createSession({ title: 'Clear Me' });
      sm.addMessage(session.id, {
        id: 'm1',
        role: 'user',
        parts: [{ text: 'Hi' }],
        timestamp: new Date().toISOString(),
        turnNumber: 1,
      });

      assert.strictEqual(sm.getSession(session.id)?.messages.length, 1);
      sm.clearHistory(session.id);
      assert.strictEqual(sm.getSession(session.id)?.messages.length, 0);
    });
  });

  describe('Tool Registry & Multi-Turn Tools Tests', () => {
    const registry = new ToolRegistry();
    const memory = { facts: {}, notes: [], todos: [] };
    const context = { sessionId: 'test_session', memory };

    it('should execute calculator tool accurately', async () => {
      const res = await registry.execute('calculate', { expression: '25 * 4 + (100 / 2)' }, context);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.result, 150);
    });

    it('should evaluate math percentage expressions', async () => {
      const res = await registry.execute('calculate', { expression: '20% of 500' }, context);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.result, 100);
    });

    it('should store and recall facts in multi-turn memory', async () => {
      const storeRes = await registry.execute('store_memory', { key: 'favorite_ai_framework', value: 'Google ADK' }, context);
      assert.strictEqual(storeRes.success, true);
      assert.strictEqual(context.memory.facts['favorite_ai_framework'], 'Google ADK');

      const recallRes = await registry.execute('recall_memory', { key: 'favorite_ai_framework' }, context);
      assert.strictEqual(recallRes.found, true);
      assert.strictEqual(recallRes.value, 'Google ADK');
    });

    it('should manage multi-turn notebook (add, search, list, delete)', async () => {
      const addRes = await registry.execute('manage_notes', { action: 'add', title: 'Meeting Notes', content: 'Discuss Google ADK architecture' }, context);
      assert.strictEqual(addRes.success, true);
      assert.ok(addRes.note.id);

      const listRes = await registry.execute('manage_notes', { action: 'list' }, context);
      assert.strictEqual(listRes.total >= 1, true);

      const searchRes = await registry.execute('manage_notes', { action: 'search', query: 'architecture' }, context);
      assert.strictEqual(searchRes.count, 1);

      const delRes = await registry.execute('manage_notes', { action: 'delete', noteId: addRes.note.id }, context);
      assert.strictEqual(delRes.success, true);
    });

    it('should manage multi-turn todo list (add, complete, list)', async () => {
      const addRes = await registry.execute('manage_todos', { action: 'add', task: 'Deploy multi-turn agent' }, context);
      assert.strictEqual(addRes.success, true);
      assert.strictEqual(addRes.todo.completed, false);

      const completeRes = await registry.execute('manage_todos', { action: 'complete', todoId: addRes.todo.id }, context);
      assert.strictEqual(completeRes.success, true);
      assert.strictEqual(completeRes.todo.completed, true);
    });

    it('should return timezone aware current time', async () => {
      const res = await registry.execute('get_current_time', { timezone: 'UTC' }, context);
      assert.ok(res.iso);
      assert.strictEqual(res.timezone, 'UTC');
    });

    it('should construct valid Google ADK FunctionTool instances with Zod schemas', async () => {
      const adkTools = registry.getAdkFunctionTools(() => context);
      assert.strictEqual(adkTools.length, 7);
      const toolNames = adkTools.map(t => t.name);
      assert.ok(toolNames.includes('calculate'));
      assert.ok(toolNames.includes('get_current_time'));
      assert.ok(toolNames.includes('store_memory'));
      assert.ok(toolNames.includes('recall_memory'));
      assert.ok(toolNames.includes('manage_notes'));
      assert.ok(toolNames.includes('manage_todos'));
      assert.ok(toolNames.includes('web_search'));
    });
  });

  describe('Google ADK Multi-Turn Agent Interaction Tests', () => {
    it('should execute multi-turn conversation and maintain context across turns', async () => {
      const sm = new SessionManager();
      const tr = new ToolRegistry();
      const agent = new GoogleAdkMultiTurnAgent({ sessionManager: sm, toolRegistry: tr });

      const session = sm.createSession({ title: 'Context Retention Test' });

      // Turn 1: User asks agent to remember a detail
      const turn1Result = await agent.interact(session.id, 'Remember that my name is Alice');
      assert.strictEqual(turn1Result.turnNumber, 1);
      assert.ok(turn1Result.agentMessage.parts[0].text);

      // Verify fact was stored in session memory or response acknowledges it
      const s1 = sm.getSession(session.id);
      const hasAliceInMemory = Object.values(s1?.memory.facts || {}).some(v => String(v).includes('Alice'));
      assert.ok(hasAliceInMemory || turn1Result.agentMessage.parts[0].text.includes('Alice'));

      // Turn 2: User asks agent to calculate something
      const turn2Result = await agent.interact(session.id, 'Calculate 45 * 2 + 10');
      assert.strictEqual(turn2Result.turnNumber, 2);
      assert.ok(turn2Result.agentMessage.parts[0].text?.includes('100'));

      // Turn 3: User asks agent to recall memory
      const turn3Result = await agent.interact(session.id, 'What do you remember from our conversation?');
      assert.strictEqual(turn3Result.turnNumber, 3);
      assert.ok(turn3Result.agentMessage.parts[0].text);
    });

    it('should stream deltas during multi-turn interaction', async () => {
      const sm = new SessionManager();
      const tr = new ToolRegistry();
      const agent = new GoogleAdkMultiTurnAgent({ sessionManager: sm, toolRegistry: tr });
      const session = sm.createSession();

      const deltas: string[] = [];
      await agent.interact(session.id, 'Hello agent', {
        onDelta: (delta) => {
          deltas.push(delta);
        },
      });

      assert.ok(deltas.length > 0);
    });
  });

  describe('HTTP REST API Integration Tests', () => {
    let server: http.Server;
    const PORT = 3099;

    before(async () => {
      const appInstance = createServer();
      server = appInstance.server.listen(PORT);
    });

    after(() => {
      server?.close();
    });

    it('GET /api/status should return agent status', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/status`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.status, 'online');
      assert.ok(body.availableTools.length > 0);
    });

    it('POST /api/sessions and POST /api/sessions/:id/message should handle multi-turn HTTP dialog', async () => {
      // 1. Create session
      const createRes = await fetch(`http://localhost:${PORT}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'HTTP Chat' }),
      });
      assert.strictEqual(createRes.status, 201);
      const createData = await createRes.json();
      const sessionId = createData.session.id;

      // 2. Send Turn 1
      const turn1Res = await fetch(`http://localhost:${PORT}/api/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Calculate 12 * 12' }),
      });
      assert.strictEqual(turn1Res.status, 200);
      const turn1Data = await turn1Res.json();
      assert.strictEqual(turn1Data.result.turnNumber, 1);
      assert.ok(turn1Data.result.agentMessage.parts[0].text.includes('144'));

      // 3. Send Turn 2
      const turn2Res = await fetch(`http://localhost:${PORT}/api/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Add todo: Write documentation' }),
      });
      assert.strictEqual(turn2Res.status, 200);
      const turn2Data = await turn2Res.json();
      assert.strictEqual(turn2Data.result.turnNumber, 2);

      // 4. Verify session details
      const detailRes = await fetch(`http://localhost:${PORT}/api/sessions/${sessionId}`);
      assert.strictEqual(detailRes.status, 200);
      const detailData = await detailRes.json();
      assert.strictEqual(detailData.session.messages.length, 4); // 2 user + 2 model
      assert.strictEqual(detailData.session.memory.todos.length, 1);
    });

    it('POST /api/sessions/:id/fork should create a branched session', async () => {
      const createRes = await fetch(`http://localhost:${PORT}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Fork Source' }),
      });
      const { session } = await createRes.json();

      const forkRes = await fetch(`http://localhost:${PORT}/api/sessions/${session.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(forkRes.status, 201);
      const forkData = await forkRes.json();
      assert.strictEqual(forkData.session.parentSessionId, session.id);
    });
  });
});
