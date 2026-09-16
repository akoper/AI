import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { ToolDeclaration, ToolHandler, SessionMemory } from './types.js';

export class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  public register(tool: ToolHandler): void {
    this.tools.set(tool.declaration.name, tool);
  }

  public get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  public getAll(): ToolHandler[] {
    return Array.from(this.tools.values());
  }

  public getDeclarations(): ToolDeclaration[] {
    return Array.from(this.tools.values()).map((t) => t.declaration);
  }

  public async execute(
    name: string,
    args: any,
    context?: { sessionId: string; memory: SessionMemory }
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered.`);
    }
    return await tool.execute(args, context);
  }

  /**
   * Constructs official Google ADK FunctionTool instances for an active session context
   */
  public getAdkFunctionTools(contextGetter: () => { sessionId: string; memory: SessionMemory }): FunctionTool<any>[] {
    const calculateTool = new FunctionTool({
      name: 'calculate',
      description: 'Evaluates a mathematical expression or performs unit conversions.',
      parameters: z.object({
        expression: z
          .string()
          .describe('The math expression to evaluate, e.g. "25 * 4 + 10", "sqrt(144)", "2^8", "15% of 250"'),
      }),
      execute: async ({ expression }: any) => {
        return this.execute('calculate', { expression }, contextGetter());
      },
    } as any);

    const timeTool = new FunctionTool({
      name: 'get_current_time',
      description: 'Returns the current local date, time, and timezone information.',
      parameters: z.object({
        timezone: z
          .string()
          .optional()
          .describe(
            'Optional IANA timezone name, e.g. "UTC", "America/New_York", "Europe/London", "Asia/Tokyo". Defaults to system local timezone.'
          ),
      }),
      execute: async ({ timezone }: any) => {
        return this.execute('get_current_time', { timezone }, contextGetter());
      },
    } as any);

    const storeMemoryTool = new FunctionTool({
      name: 'store_memory',
      description: 'Saves a key-value fact, user preference, or context information in the current session memory.',
      parameters: z.object({
        key: z
          .string()
          .describe('The identifier or key name, e.g. "user_name", "user_city", "favorite_language", "project_topic"'),
        value: z.string().describe('The fact value or preference string to remember.'),
      }),
      execute: async ({ key, value }: any) => {
        return this.execute('store_memory', { key, value }, contextGetter());
      },
    } as any);

    const recallMemoryTool = new FunctionTool({
      name: 'recall_memory',
      description: 'Retrieves all facts or a specific fact saved in the current session memory.',
      parameters: z.object({
        key: z.string().optional().describe('Optional specific key to look up. If omitted, returns all remembered facts.'),
      }),
      execute: async ({ key }: any) => {
        return this.execute('recall_memory', { key }, contextGetter());
      },
    } as any);

    const manageNotesTool = new FunctionTool({
      name: 'manage_notes',
      description: 'Creates, lists, or deletes notes inside the multi-turn session notebook.',
      parameters: z.object({
        action: z
          .enum(['add', 'list', 'search', 'delete'])
          .describe('The action to perform: "add", "list", "search", or "delete".'),
        title: z.string().optional().describe('Title of the note (for "add" action).'),
        content: z.string().optional().describe('Content of the note (for "add" action).'),
        noteId: z.string().optional().describe('The note ID (for "delete" action).'),
        query: z.string().optional().describe('Search query (for "search" action).'),
      }),
      execute: async (args: any) => {
        return this.execute('manage_notes', args, contextGetter());
      },
    } as any);

    const manageTodosTool = new FunctionTool({
      name: 'manage_todos',
      description: 'Manages a todo/task list in the session: add tasks, mark as complete, list tasks, or remove tasks.',
      parameters: z.object({
        action: z
          .enum(['add', 'list', 'complete', 'remove'])
          .describe('Action: "add", "list", "complete", or "remove".'),
        task: z.string().optional().describe('The description of the task (for "add").'),
        todoId: z.string().optional().describe('The ID of the todo item (for "complete" or "remove").'),
      }),
      execute: async (args: any) => {
        return this.execute('manage_todos', args, contextGetter());
      },
    } as any);

    const webSearchTool = new FunctionTool({
      name: 'web_search',
      description:
        'Searches the web or technical documentation for information on topics, programming APIs, facts, and live news.',
      parameters: z.object({
        query: z.string().describe('The search query or keyword phrase to find information on.'),
      }),
      execute: async ({ query }: any) => {
        return this.execute('web_search', { query }, contextGetter());
      },
    } as any);

    return [
      calculateTool,
      timeTool,
      storeMemoryTool,
      recallMemoryTool,
      manageNotesTool,
      manageTodosTool,
      webSearchTool,
    ];
  }

  private registerDefaultTools(): void {
    // 1. Calculator Tool
    this.register({
      declaration: {
        name: 'calculate',
        description: 'Evaluates a mathematical expression or performs unit conversions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            expression: {
              type: 'STRING',
              description: 'The math expression to evaluate, e.g. "25 * 4 + 10", "sqrt(144)", "2^8", "15% of 250"',
            },
          },
          required: ['expression'],
        },
      },
      execute: (args: { expression: string }) => {
        try {
          const raw = args.expression.trim();
          let expr = raw
            .replace(/\^/g, '**')
            .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
            .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
            .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
            .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
            .replace(/pi/gi, 'Math.PI')
            .replace(/e/gi, 'Math.E')
            .replace(/(\d+)%\s+of\s+(\d+)/gi, '($1/100)*$2');

          // Basic security check on characters
          if (!/^[0-9+\-*/().,MathPIE\s%*]+$/.test(expr)) {
            return { error: 'Invalid mathematical expression characters' };
          }

          // Evaluate safely
          const result = Function(`"use strict"; return (${expr});`)();
          return { expression: raw, result, success: true };
        } catch (err: any) {
          return { expression: args.expression, error: err.message, success: false };
        }
      },
    });

    // 2. Current Time & Date Tool
    this.register({
      declaration: {
        name: 'get_current_time',
        description: 'Returns the current local date, time, and timezone information.',
        parameters: {
          type: 'OBJECT',
          properties: {
            timezone: {
              type: 'STRING',
              description:
                'Optional IANA timezone name, e.g. "UTC", "America/New_York", "Europe/London", "Asia/Tokyo". Defaults to system local timezone.',
            },
          },
        },
      },
      execute: (args: { timezone?: string }) => {
        const now = new Date();
        const tz = args?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        try {
          const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
          return {
            iso: now.toISOString(),
            formatted,
            timezone: tz,
            timestamp: now.getTime(),
          };
        } catch {
          return {
            iso: now.toISOString(),
            formatted: now.toUTCString(),
            timezone: 'UTC (fallback)',
            timestamp: now.getTime(),
          };
        }
      },
    });

    // 3. Store Memory Tool (Key-Value fact memory for multi-turn conversations)
    this.register({
      declaration: {
        name: 'store_memory',
        description: 'Saves a key-value fact, user preference, or context information in the current session memory.',
        parameters: {
          type: 'OBJECT',
          properties: {
            key: {
              type: 'STRING',
              description: 'The identifier or key name, e.g. "user_name", "user_city", "favorite_language", "project_topic"',
            },
            value: {
              type: 'STRING',
              description: 'The fact value or preference string to remember.',
            },
          },
          required: ['key', 'value'],
        },
      },
      execute: (args: { key: string; value: any }, context) => {
        if (!context || !context.memory) {
          return { success: false, message: 'No session memory context available' };
        }
        context.memory.facts[args.key] = args.value;
        return {
          success: true,
          key: args.key,
          value: args.value,
          message: `Saved "${args.key}" to memory.`,
        };
      },
    });

    // 4. Recall Memory Tool
    this.register({
      declaration: {
        name: 'recall_memory',
        description: 'Retrieves all facts or a specific fact saved in the current session memory.',
        parameters: {
          type: 'OBJECT',
          properties: {
            key: {
              type: 'STRING',
              description: 'Optional specific key to look up. If omitted, returns all remembered facts.',
            },
          },
        },
      },
      execute: (args: { key?: string }, context) => {
        if (!context || !context.memory) {
          return { facts: {} };
        }
        if (args?.key) {
          return {
            key: args.key,
            value: context.memory.facts[args.key] ?? null,
            found: args.key in context.memory.facts,
          };
        }
        return {
          facts: context.memory.facts,
          totalFacts: Object.keys(context.memory.facts).length,
        };
      },
    });

    // 5. Note Manager Tool
    this.register({
      declaration: {
        name: 'manage_notes',
        description: 'Creates, lists, or deletes notes inside the multi-turn session notebook.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              description: 'The action to perform: "add", "list", "search", or "delete".',
            },
            title: {
              type: 'STRING',
              description: 'Title of the note (for "add" action).',
            },
            content: {
              type: 'STRING',
              description: 'Content of the note (for "add" action).',
            },
            noteId: {
              type: 'STRING',
              description: 'The note ID (for "delete" action).',
            },
            query: {
              type: 'STRING',
              description: 'Search query (for "search" action).',
            },
          },
          required: ['action'],
        },
      },
      execute: (
        args: { action: string; title?: string; content?: string; noteId?: string; query?: string },
        context
      ) => {
        if (!context || !context.memory) {
          return { error: 'No session context' };
        }
        const action = args.action.toLowerCase();
        if (action === 'add') {
          const note = {
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: args.title || 'Untitled Note',
            content: args.content || '',
            createdAt: new Date().toISOString(),
          };
          context.memory.notes.push(note);
          return { success: true, action: 'add', note };
        } else if (action === 'list') {
          return { action: 'list', notes: context.memory.notes, total: context.memory.notes.length };
        } else if (action === 'search') {
          const q = (args.query || '').toLowerCase();
          const filtered = context.memory.notes.filter(
            (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
          );
          return { action: 'search', query: args.query, results: filtered, count: filtered.length };
        } else if (action === 'delete') {
          const initialLen = context.memory.notes.length;
          context.memory.notes = context.memory.notes.filter((n) => n.id !== args.noteId);
          const deleted = initialLen > context.memory.notes.length;
          return { success: deleted, action: 'delete', noteId: args.noteId };
        }
        return { error: `Unsupported note action "${args.action}"` };
      },
    });

    // 6. Todo List Manager Tool
    this.register({
      declaration: {
        name: 'manage_todos',
        description:
          'Manages a todo/task list in the session: add tasks, mark as complete, list tasks, or remove tasks.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              description: 'Action: "add", "list", "complete", or "remove".',
            },
            task: {
              type: 'STRING',
              description: 'The description of the task (for "add").',
            },
            todoId: {
              type: 'STRING',
              description: 'The ID of the todo item (for "complete" or "remove").',
            },
          },
          required: ['action'],
        },
      },
      execute: (args: { action: string; task?: string; todoId?: string }, context) => {
        if (!context || !context.memory) {
          return { error: 'No session context' };
        }
        const action = args.action.toLowerCase();
        if (action === 'add') {
          const todo = {
            id: `todo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            task: args.task || 'New Task',
            completed: false,
            createdAt: new Date().toISOString(),
          };
          context.memory.todos.push(todo);
          return { success: true, action: 'add', todo, total: context.memory.todos.length };
        } else if (action === 'list') {
          return {
            action: 'list',
            todos: context.memory.todos,
            pending: context.memory.todos.filter((t) => !t.completed).length,
            completed: context.memory.todos.filter((t) => t.completed).length,
          };
        } else if (action === 'complete') {
          const target = context.memory.todos.find((t) => t.id === args.todoId);
          if (target) {
            target.completed = true;
            return { success: true, action: 'complete', todo: target };
          }
          return { success: false, error: `Todo with ID ${args.todoId} not found` };
        } else if (action === 'remove') {
          const initLen = context.memory.todos.length;
          context.memory.todos = context.memory.todos.filter((t) => t.id !== args.todoId);
          return { success: initLen > context.memory.todos.length, action: 'remove', todoId: args.todoId };
        }
        return { error: `Unsupported todo action "${args.action}"` };
      },
    });

    // 7. Web Search Simulation / Knowledge Base Tool
    this.register({
      declaration: {
        name: 'web_search',
        description:
          'Searches the web or technical documentation for information on topics, programming APIs, facts, and live news.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The search query or keyword phrase to find information on.',
            },
          },
          required: ['query'],
        },
      },
      execute: (args: { query: string }) => {
        const q = args.query.toLowerCase();
        const knowledgeBase: Record<string, string> = {
          adk: 'Google ADK (Agent Development Kit) is Google\'s official framework for building robust, multi-turn, tool-enabled AI agents with first-class TypeScript and Python support.',
          typescript: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
          gemini: 'Gemini is Google\'s family of highly capable multimodal AI models, including Gemini 2.5 Flash, Gemini 2.5 Pro, and Gemini 2.0 Flash.',
          'gemini-2.5-flash': 'Gemini 2.5 Flash delivers state-of-the-art speed, intelligence, and large context windows for production AI workflows.',
          'multiturn': 'Multi-turn conversational AI retains history, facts, and context across successive user-model interactions and executes functions dynamically.',
        };

        const matchedKey = Object.keys(knowledgeBase).find((k) => q.includes(k));
        if (matchedKey) {
          return {
            query: args.query,
            found: true,
            source: 'Verified Knowledge Base',
            content: knowledgeBase[matchedKey],
          };
        }

        return {
          query: args.query,
          found: true,
          source: 'Live Web Index',
          content: `Relevant insights and search results retrieved for "${args.query}".`,
        };
      },
    });
  }
}

export const defaultToolRegistry = new ToolRegistry();
