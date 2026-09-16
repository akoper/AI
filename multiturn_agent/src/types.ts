export type MessageRole = 'user' | 'model' | 'system' | 'function';

export interface FunctionCallPart {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponsePart {
  name: string;
  response: Record<string, any>;
}

export interface MessageContentPart {
  text?: string;
  functionCall?: FunctionCallPart;
  functionResponse?: FunctionResponsePart;
}

export interface ToolCallExecution {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: any;
  error?: string;
  durationMs?: number;
  timestamp: string;
}

export interface TurnMessage {
  id: string;
  role: MessageRole;
  parts: MessageContentPart[];
  timestamp: string;
  turnNumber: number;
  toolCalls?: ToolCallExecution[];
  tokenEstimate?: number;
}

export interface SessionMemory {
  facts: Record<string, any>;
  notes: Array<{ id: string; title: string; content: string; createdAt: string }>;
  todos: Array<{ id: string; task: string; completed: boolean; createdAt: string }>;
}

export interface MultiTurnSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  systemInstruction?: string;
  temperature?: number;
  messages: TurnMessage[];
  memory: SessionMemory;
  parentSessionId?: string;
  forkedAtTurn?: number;
}

export interface ToolParameterSchema {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
  items?: ToolParameterSchema;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT' | 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolHandler {
  declaration: ToolDeclaration;
  execute: (args: any, context?: { sessionId: string; memory: SessionMemory }) => Promise<any> | any;
}

export interface AgentTurnResult {
  sessionId: string;
  turnNumber: number;
  userMessage: TurnMessage;
  agentMessage: TurnMessage;
  toolExecutions: ToolCallExecution[];
  totalTurns: number;
}

export interface StreamCallbacks {
  onDelta?: (delta: string, fullText: string) => void;
  onToolCallStart?: (toolName: string, args: any) => void;
  onToolCallComplete?: (toolName: string, result: any, durationMs: number) => void;
  onTurnComplete?: (result: AgentTurnResult) => void;
  onError?: (error: Error) => void;
}

export interface WebSocketClientMessage {
  type: 'init' | 'send_message' | 'clear_session' | 'fork_session' | 'ping';
  sessionId?: string;
  text?: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  forkTurn?: number;
}

export interface WebSocketServerMessage {
  type: 'session_init' | 'stream_delta' | 'tool_call_start' | 'tool_call_result' | 'turn_complete' | 'session_cleared' | 'session_forked' | 'error' | 'pong';
  sessionId?: string;
  data?: any;
  error?: string;
}
