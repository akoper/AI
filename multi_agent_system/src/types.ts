/**
 * Core type definitions for Multi-Agent System with Google Gemini
 */

export type AgentRole =
  | 'supervisor'
  | 'researcher'
  | 'coder'
  | 'analyst'
  | 'critic'
  | 'writer'
  | 'custom';

export type WorkflowType =
  | 'supervisor'   // Hierarchical: Supervisor plans, delegates subtasks, aggregates
  | 'pipeline'     // Sequential: Multi-stage pipeline passing context along
  | 'debate'       // Consensus: Proposer and Critic debate until consensus
  | 'handoff';     // Autonomous: Agents pass control dynamically to best specialist

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
  items?: ToolParameterSchema;
}

export interface AgentToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
}

export interface AgentTool<TInput = any, TOutput = any> {
  declaration: AgentToolDeclaration;
  execute: (args: TInput, context?: ExecutionContext) => Promise<TOutput> | TOutput;
}

export interface AgentMessage {
  id: string;
  sender: string;       // Agent ID or Name, or 'user' or 'system'
  recipient?: string;    // Target Agent ID or 'all'
  role: 'user' | 'model' | 'system' | 'tool';
  content: string;
  thought?: string;     // Internal agent reasoning / chain of thought
  timestamp: string;
  toolCalls?: ToolCallTrace[];
  metadata?: Record<string, any>;
}

export interface ToolCallTrace {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  durationMs?: number;
  error?: string;
}

export interface AgentConfigSpec {
  id: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  tools: string[]; // Tool names available to this agent
  color?: string;  // Hex or UI theme color
  avatar?: string; // Emoji or icon
}

export interface SharedArtifact {
  id: string;
  name: string;
  type: 'code' | 'report' | 'data' | 'json' | 'plan' | 'text';
  content: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SubTask {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  dependsOn?: string[];
  createdAt: string;
  completedAt?: string;
}

export interface ExecutionContext {
  taskId: string;
  workflowType: WorkflowType;
  blackboard: Record<string, any>;
  artifacts: Map<string, SharedArtifact>;
  currentRound: number;
  maxRounds: number;
  messages: AgentMessage[];
}

export interface WorkflowTraceEvent {
  id: string;
  taskId: string;
  timestamp: string;
  type:
    | 'task_started'
    | 'subtask_created'
    | 'subtask_started'
    | 'subtask_completed'
    | 'agent_thought'
    | 'agent_message'
    | 'agent_handoff'
    | 'tool_called'
    | 'tool_result'
    | 'artifact_created'
    | 'artifact_updated'
    | 'debate_round'
    | 'task_completed'
    | 'task_error';
  agent?: string;
  targetAgent?: string;
  data: any;
}

export interface WorkflowTaskRequest {
  id?: string;
  task: string;
  workflowType?: WorkflowType;
  customAgents?: AgentConfigSpec[];
  maxRounds?: number;
  options?: {
    model?: string;
    temperature?: number;
    initialContext?: Record<string, any>;
    specificAgents?: string[];
  };
}

export interface WorkflowTaskResult {
  taskId: string;
  task: string;
  workflowType: WorkflowType;
  status: ExecutionStatus;
  finalAnswer: string;
  summary: string;
  agentsInvolved: string[];
  subtasks: SubTask[];
  artifacts: SharedArtifact[];
  messages: AgentMessage[];
  events: WorkflowTraceEvent[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  metrics: {
    totalMessages: number;
    totalToolCalls: number;
    totalRounds: number;
  };
}

export interface WebSocketMessage {
  type: 'start_task' | 'stop_task' | 'event' | 'task_result' | 'error' | 'status_request' | 'status_response';
  payload?: any;
}
