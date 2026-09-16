import fs from 'fs';
import path from 'path';
import { MultiTurnSession, TurnMessage, SessionMemory } from './types.js';
import { config } from './config.js';

export class SessionManager {
  private sessions: Map<string, MultiTurnSession> = new Map();
  private storagePath: string;

  constructor(storageDir?: string) {
    const baseDir = storageDir || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch {}
    }
    this.storagePath = path.join(baseDir, 'sessions.json');
    this.loadFromDisk();
  }

  public createSession(options?: {
    id?: string;
    title?: string;
    model?: string;
    systemInstruction?: string;
    temperature?: number;
  }): MultiTurnSession {
    const id = options?.id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const session: MultiTurnSession = {
      id,
      title: options?.title || 'New Multi-turn Chat',
      createdAt: now,
      updatedAt: now,
      model: options?.model || config.modelName,
      systemInstruction: options?.systemInstruction || `You are ${config.agentName}, ${config.agentRole}. Maintain clear conversational context across turns. If the user asks you to remember or look up facts, calculate expressions, or manage tasks, execute the appropriate tools.`,
      temperature: options?.temperature ?? 0.7,
      messages: [],
      memory: {
        facts: {},
        notes: [],
        todos: [],
      },
    };

    this.sessions.set(id, session);
    this.saveToDisk();
    return session;
  }

  public getSession(id: string): MultiTurnSession | undefined {
    return this.sessions.get(id);
  }

  public getOrCreateSession(id?: string): MultiTurnSession {
    if (id && this.sessions.has(id)) {
      return this.sessions.get(id)!;
    }
    return this.createSession({ id });
  }

  public getAllSessions(): MultiTurnSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public deleteSession(id: string): boolean {
    const deleted = this.sessions.delete(id);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  public addMessage(sessionId: string, message: TurnMessage): MultiTurnSession {
    const session = this.getOrCreateSession(sessionId);
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Auto update title based on first user message if title is default
    if (session.messages.length === 1 && message.role === 'user') {
      const firstText = message.parts.find(p => p.text)?.text || '';
      if (firstText && (session.title === 'New Multi-turn Chat' || !session.title)) {
        session.title = firstText.slice(0, 40) + (firstText.length > 40 ? '...' : '');
      }
    }

    // Prune history if exceeds max turns
    if (session.messages.length > config.maxHistoryTurns * 2) {
      // Keep earliest turn or system context if any, trim oldest turns
      const excess = session.messages.length - config.maxHistoryTurns * 2;
      session.messages.splice(0, excess);
    }

    this.saveToDisk();
    return session;
  }

  public clearHistory(sessionId: string): MultiTurnSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.messages = [];
    session.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return session;
  }

  public forkSession(sessionId: string, atTurnNumber?: number): MultiTurnSession {
    const original = this.sessions.get(sessionId);
    if (!original) {
      throw new Error(`Cannot fork non-existent session "${sessionId}"`);
    }

    const forkedId = `session_fork_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cutoffIndex = atTurnNumber !== undefined
      ? original.messages.findIndex(m => m.turnNumber > atTurnNumber)
      : original.messages.length;

    const messagesSlice = cutoffIndex === -1 ? [...original.messages] : original.messages.slice(0, cutoffIndex);

    const forked: MultiTurnSession = {
      id: forkedId,
      title: `Fork of ${original.title} (Turn ${atTurnNumber ?? original.messages.length})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: original.model,
      systemInstruction: original.systemInstruction,
      temperature: original.temperature,
      messages: JSON.parse(JSON.stringify(messagesSlice)),
      memory: JSON.parse(JSON.stringify(original.memory)),
      parentSessionId: original.id,
      forkedAtTurn: atTurnNumber,
    };

    this.sessions.set(forkedId, forked);
    this.saveToDisk();
    return forked;
  }

  public updateSession(
    sessionId: string,
    updates: Partial<Pick<MultiTurnSession, 'title' | 'model' | 'systemInstruction' | 'temperature'>>
  ): MultiTurnSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (updates.title !== undefined) session.title = updates.title;
    if (updates.model !== undefined) session.model = updates.model;
    if (updates.systemInstruction !== undefined) session.systemInstruction = updates.systemInstruction;
    if (updates.temperature !== undefined) session.temperature = updates.temperature;
    session.updatedAt = new Date().toISOString();

    this.saveToDisk();
    return session;
  }

  private saveToDisk(): void {
    try {
      const data = JSON.stringify(Array.from(this.sessions.values()), null, 2);
      fs.writeFileSync(this.storagePath, data, 'utf-8');
    } catch (err) {
      // Ignore disk write errors in readonly environments
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const list: MultiTurnSession[] = JSON.parse(raw);
        for (const s of list) {
          this.sessions.set(s.id, s);
        }
      }
    } catch {
      // Ignore disk read errors
    }
  }
}

export const defaultSessionManager = new SessionManager();
