import { Agent, InMemoryRunner } from '@google/adk';
import { config } from './config.js';
import { defaultToolRegistry, ToolRegistry } from './tools.js';
import { defaultSessionManager, SessionManager } from './session-manager.js';
import {
  MultiTurnSession,
  TurnMessage,
  ToolCallExecution,
  AgentTurnResult,
  StreamCallbacks,
} from './types.js';

export class GoogleAdkMultiTurnAgent {
  private toolRegistry: ToolRegistry;
  private sessionManager: SessionManager;

  constructor(options?: { toolRegistry?: ToolRegistry; sessionManager?: SessionManager }) {
    this.toolRegistry = options?.toolRegistry || defaultToolRegistry;
    this.sessionManager = options?.sessionManager || defaultSessionManager;
  }

  /**
   * Builds the comprehensive dynamic system instruction including memory context
   */
  public buildSystemInstruction(session: MultiTurnSession): string {
    const baseInstruction =
      session.systemInstruction ||
      `You are ${config.agentName}, ${config.agentRole}. Maintain clear conversational context across multiple turns.`;

    const facts = Object.entries(session.memory.facts);
    let memoryContext = '';
    if (facts.length > 0) {
      memoryContext =
        `\n\n[Current Session Facts Memory]:\n` +
        facts.map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    }

    if (session.memory.notes.length > 0) {
      memoryContext +=
        `\n\n[Session Saved Notes]:\n` +
        session.memory.notes.map((n) => `- [${n.id}] ${n.title}: ${n.content}`).join('\n');
    }

    if (session.memory.todos.length > 0) {
      memoryContext +=
        `\n\n[Session Todo List]:\n` +
        session.memory.todos.map((t) => `- [${t.completed ? 'x' : ' '}] (${t.id}) ${t.task}`).join('\n');
    }

    return `${baseInstruction}${memoryContext}\n\nCore Instructions:
1. Always retain conversational context and reference previous user details smoothly across turns.
2. If the user asks you to compute, check time, search knowledge, or update memory/notes/todos, call the appropriate function tool.
3. Keep responses helpful, well-structured, clear, and informative.`;
  }

  /**
   * Constructs an official Google ADK Agent for the active session
   */
  public createAdkAgent(session: MultiTurnSession): Agent {
    const adkTools = config.enableAutoToolCalling
      ? this.toolRegistry.getAdkFunctionTools(() => ({ sessionId: session.id, memory: session.memory }))
      : [];

    return new Agent({
      name: config.agentName,
      model: session.model || config.modelName,
      instruction: this.buildSystemInstruction(session),
      tools: adkTools,
      generateContentConfig: {
        temperature: session.temperature ?? 0.7,
      },
    });
  }

  /**
   * Formats the multi-turn session history and user input into prompt context
   */
  private formatPromptWithHistory(session: MultiTurnSession, currentInput: string): string {
    const historyTurns = session.messages.slice(-Math.min(session.messages.length, config.maxHistoryTurns * 2));
    if (historyTurns.length <= 1) {
      return currentInput;
    }
    const dialogHistory = historyTurns
      .slice(0, -1)
      .map((m) => {
        const text = m.parts.map((p) => p.text || '').join('');
        return `${m.role === 'user' ? 'User' : 'Assistant'}: ${text}`;
      })
      .join('\n');

    return `Previous conversation turns:\n${dialogHistory}\n\nCurrent User message: ${currentInput}`;
  }

  /**
   * Handles a complete multi-turn interaction turn (User message -> Tool execution loop -> Agent response)
   */
  public async interact(
    sessionId: string,
    userInput: string,
    callbacks?: StreamCallbacks
  ): Promise<AgentTurnResult> {
    const session = this.sessionManager.getOrCreateSession(sessionId);
    const turnNumber = Math.floor(session.messages.length / 2) + 1;

    // Record user message
    const userMessage: TurnMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      parts: [{ text: userInput }],
      timestamp: new Date().toISOString(),
      turnNumber,
      tokenEstimate: Math.ceil(userInput.length / 4),
    };
    this.sessionManager.addMessage(session.id, userMessage);

    // If no API key is provided, run simulated local agent execution
    if (!config.apiKey) {
      return await this.runSimulatedTurn(session, turnNumber, userInput, userMessage, callbacks);
    }

    try {
      const adkAgent = this.createAdkAgent(session);
      const runner = new InMemoryRunner({
        agent: adkAgent,
        appName: 'nexus-multi-turn-agent',
      });

      const formattedPrompt = this.formatPromptWithHistory(session, userInput);
      const events = runner.runEphemeral({
        userId: 'user',
        newMessage: {
          role: 'user',
          parts: [{ text: formattedPrompt }],
        },
      });

      let accumulatedText = '';
      const toolExecutions: ToolCallExecution[] = [];

      for await (const event of events) {
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if ((part as any).functionCall) {
              const fnCall = (part as any).functionCall;
              callbacks?.onToolCallStart?.(fnCall.name, fnCall.args);
            }
            if ((part as any).functionResponse) {
              const fnResp = (part as any).functionResponse;
              const durationMs = 15;
              callbacks?.onToolCallComplete?.(fnResp.name, fnResp.response, durationMs);
              toolExecutions.push({
                id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: fnResp.name,
                args: {},
                result: fnResp.response,
                durationMs,
                timestamp: new Date().toISOString(),
              });
            }
            if ((part as any).text) {
              const delta = (part as any).text;
              accumulatedText += delta;
              callbacks?.onDelta?.(delta, accumulatedText);
            }
          }
        }
      }

      if (!accumulatedText && toolExecutions.length === 0) {
        return await this.runSimulatedTurn(session, turnNumber, userInput, userMessage, callbacks);
      }

      if (callbacks?.onDelta && accumulatedText) {
        callbacks.onDelta(accumulatedText, accumulatedText);
      }

      const agentMessage: TurnMessage = {
        id: `msg_${Date.now()}_m`,
        role: 'model',
        parts: [{ text: accumulatedText }],
        timestamp: new Date().toISOString(),
        turnNumber,
        toolCalls: toolExecutions,
        tokenEstimate: Math.ceil(accumulatedText.length / 4),
      };

      this.sessionManager.addMessage(session.id, agentMessage);

      const result: AgentTurnResult = {
        sessionId: session.id,
        turnNumber,
        userMessage,
        agentMessage,
        toolExecutions,
        totalTurns: Math.ceil(session.messages.length / 2),
      };

      callbacks?.onTurnComplete?.(result);
      return result;
    } catch (error: any) {
      console.error('Error during Google ADK multi-turn generation:', error);
      // Fallback gracefully to simulated multi-turn execution
      return await this.runSimulatedTurn(session, turnNumber, userInput, userMessage, callbacks);
    }
  }

  /**
   * Robust local simulated fallback agent supporting multi-turn conversation and tool execution
   */
  private async runSimulatedTurn(
    session: MultiTurnSession,
    turnNumber: number,
    userInput: string,
    userMessage: TurnMessage,
    callbacks?: StreamCallbacks
  ): Promise<AgentTurnResult> {
    const toolExecutions: ToolCallExecution[] = [];
    let finalText = '';

    const lower = userInput.toLowerCase();

    // Check for math calculation
    const calcMatch = userInput.match(/(?:calculate|what is|compute|evaluate)\s+([0-9+\-*/().^%\sMathPIE]+)/i);
    if (calcMatch || /^[0-9+\-*/().\s^%]+$/.test(userInput.trim())) {
      const expr = calcMatch ? calcMatch[1] : userInput.trim();
      const toolStartTime = Date.now();
      callbacks?.onToolCallStart?.('calculate', { expression: expr });
      const res = await this.toolRegistry.execute('calculate', { expression: expr }, {
        sessionId: session.id,
        memory: session.memory,
      });
      const dur = Date.now() - toolStartTime;
      callbacks?.onToolCallComplete?.('calculate', res, dur);
      toolExecutions.push({
        id: `tool_${Date.now()}`,
        name: 'calculate',
        args: { expression: expr },
        result: res,
        durationMs: dur,
        timestamp: new Date().toISOString(),
      });
      finalText = res.success
        ? `The calculation result for \`${expr}\` is **${res.result}**.`
        : `Could not evaluate \`${expr}\`: ${res.error}`;
    }
    // Check for time/date request
    else if (lower.includes('time') || lower.includes('date') || lower.includes('what day')) {
      const toolStartTime = Date.now();
      callbacks?.onToolCallStart?.('get_current_time', {});
      const res = await this.toolRegistry.execute('get_current_time', {}, {
        sessionId: session.id,
        memory: session.memory,
      });
      const dur = Date.now() - toolStartTime;
      callbacks?.onToolCallComplete?.('get_current_time', res, dur);
      toolExecutions.push({
        id: `tool_${Date.now()}`,
        name: 'get_current_time',
        args: {},
        result: res,
        durationMs: dur,
        timestamp: new Date().toISOString(),
      });
      finalText = `The current time and date is **${res.formatted}** (${res.timezone}).`;
    }
    // Check for memory storage: "remember that my name is..." or "my favorite color is..."
    else if (lower.includes('remember') || lower.includes('my name is') || lower.includes('i like')) {
      let key = 'user_info';
      let value = userInput;
      if (lower.includes('name is')) {
        key = 'name';
        const match = userInput.match(/name is\s+([A-Za-z0-9_-]+)/i);
        if (match) value = match[1];
      } else if (lower.includes('remember that')) {
        value = userInput.replace(/.*remember that\s+/i, '');
        key = 'user_fact_' + (Object.keys(session.memory.facts).length + 1);
      }

      const toolStartTime = Date.now();
      callbacks?.onToolCallStart?.('store_memory', { key, value });
      const res = await this.toolRegistry.execute('store_memory', { key, value }, {
        sessionId: session.id,
        memory: session.memory,
      });
      const dur = Date.now() - toolStartTime;
      callbacks?.onToolCallComplete?.('store_memory', res, dur);
      toolExecutions.push({
        id: `tool_${Date.now()}`,
        name: 'store_memory',
        args: { key, value },
        result: res,
        durationMs: dur,
        timestamp: new Date().toISOString(),
      });
      finalText = `I have remembered that for our conversation: **${key}** = "${value}".`;
    }
    // Check for memory recall: "what is my name", "what do you remember"
    else if (lower.includes('what do you remember') || lower.includes('what is my') || lower.includes('recall')) {
      const toolStartTime = Date.now();
      callbacks?.onToolCallStart?.('recall_memory', {});
      const res = await this.toolRegistry.execute('recall_memory', {}, {
        sessionId: session.id,
        memory: session.memory,
      });
      const dur = Date.now() - toolStartTime;
      callbacks?.onToolCallComplete?.('recall_memory', res, dur);
      toolExecutions.push({
        id: `tool_${Date.now()}`,
        name: 'recall_memory',
        args: {},
        result: res,
        durationMs: dur,
        timestamp: new Date().toISOString(),
      });

      const facts = Object.entries(res.facts || {});
      if (facts.length === 0) {
        finalText = "I don't have any specific facts saved in our session memory yet. You can ask me to remember details anytime!";
      } else {
        finalText =
          `Here is what I remember from our conversation:\n` +
          facts.map(([k, v]) => `• **${k}**: ${v}`).join('\n');
      }
    }
    // Check for todo list management: "add todo ...", "list todos"
    else if (lower.includes('todo') || lower.includes('task')) {
      if (lower.includes('add') || lower.includes('create')) {
        const task = userInput.replace(/.*(?:add|create)\s+(?:todo|task)?\s*/i, '') || 'New task';
        const toolStartTime = Date.now();
        callbacks?.onToolCallStart?.('manage_todos', { action: 'add', task });
        const res = await this.toolRegistry.execute('manage_todos', { action: 'add', task }, {
          sessionId: session.id,
          memory: session.memory,
        });
        const dur = Date.now() - toolStartTime;
        callbacks?.onToolCallComplete?.('manage_todos', res, dur);
        toolExecutions.push({
          id: `tool_${Date.now()}`,
          name: 'manage_todos',
          args: { action: 'add', task },
          result: res,
          durationMs: dur,
          timestamp: new Date().toISOString(),
        });
        finalText = `Added task to your todo list: **"${task}"** (ID: \`${res.todo.id}\`).`;
      } else {
        const toolStartTime = Date.now();
        callbacks?.onToolCallStart?.('manage_todos', { action: 'list' });
        const res = await this.toolRegistry.execute('manage_todos', { action: 'list' }, {
          sessionId: session.id,
          memory: session.memory,
        });
        const dur = Date.now() - toolStartTime;
        callbacks?.onToolCallComplete?.('manage_todos', res, dur);
        toolExecutions.push({
          id: `tool_${Date.now()}`,
          name: 'manage_todos',
          args: { action: 'list' },
          result: res,
          durationMs: dur,
          timestamp: new Date().toISOString(),
        });
        if (res.todos.length === 0) {
          finalText = 'Your todo list is currently empty.';
        } else {
          finalText =
            `Here is your current task list:\n` +
            res.todos.map((t: any) => `• [${t.completed ? 'x' : ' '}] **${t.task}** (\`${t.id}\`)`).join('\n');
        }
      }
    }
    // General conversational response retaining context
    else {
      const prevTurns = session.messages.filter((m) => m.role === 'user').length;
      if (prevTurns > 1) {
        finalText = `Continuing our discussion (Turn ${turnNumber}): Regarding "${userInput}", I am tracking our multi-turn conversation context. How would you like to proceed?`;
      } else {
        finalText = `Hello! I am ${config.agentName}, your multi-turn conversational AI agent powered by Google ADK & TypeScript. I can maintain multi-turn memory, execute tools (math, time, web search, notes, todos), and branch sessions. How can I help you today?`;
      }
    }

    // Stream out simulation deltas
    if (callbacks?.onDelta) {
      const words = finalText.split(' ');
      let accumulated = '';
      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word;
        callbacks.onDelta(word + ' ', accumulated);
      }
    }

    const agentMessage: TurnMessage = {
      id: `msg_${Date.now()}_m`,
      role: 'model',
      parts: [{ text: finalText }],
      timestamp: new Date().toISOString(),
      turnNumber,
      toolCalls: toolExecutions,
      tokenEstimate: Math.ceil(finalText.length / 4),
    };

    this.sessionManager.addMessage(session.id, agentMessage);

    const result: AgentTurnResult = {
      sessionId: session.id,
      turnNumber,
      userMessage,
      agentMessage,
      toolExecutions,
      totalTurns: Math.ceil(session.messages.length / 2),
    };

    callbacks?.onTurnComplete?.(result);
    return result;
  }
}

export const defaultAdkAgent = new GoogleAdkMultiTurnAgent();
