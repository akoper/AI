import { EventEmitter } from 'events';
import { BaseAgent } from '../agents/base-agent.js';
import {
  SupervisorAgent,
  ResearcherAgent,
  CoderAgent,
  AnalystAgent,
  CriticAgent,
  WriterAgent,
} from '../agents/specialized-agents.js';
import { Blackboard } from './blackboard.js';
import {
  WorkflowTaskRequest,
  WorkflowTaskResult,
  WorkflowType,
  AgentConfigSpec,
} from '../types.js';
import { executeSupervisorWorkflow } from './workflows/supervisor-workflow.js';
import { executePipelineWorkflow } from './workflows/pipeline-workflow.js';
import { executeDebateWorkflow } from './workflows/debate-workflow.js';
import { executeHandoffWorkflow } from './workflows/handoff-workflow.js';
import { defaultToolRegistry, ToolRegistry } from '../tools/registry.js';
import { config } from '../config.js';

export class MultiAgentCoordinator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private activeTasks: Map<string, Blackboard> = new Map();
  private completedResults: Map<string, WorkflowTaskResult> = new Map();
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry = defaultToolRegistry) {
    super();
    this.toolRegistry = toolRegistry;
    this.registerDefaultAgents();
  }

  private registerDefaultAgents(): void {
    this.registerAgent(new SupervisorAgent());
    this.registerAgent(new ResearcherAgent());
    this.registerAgent(new CoderAgent());
    this.registerAgent(new AnalystAgent());
    this.registerAgent(new CriticAgent());
    this.registerAgent(new WriterAgent());
  }

  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
  }

  public getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  public getAgentSpecs(): AgentConfigSpec[] {
    return this.getAllAgents().map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      systemPrompt: a.systemPrompt,
      model: a.model,
      temperature: a.temperature,
      tools: a.tools,
      color: a.color,
      avatar: a.avatar,
    }));
  }

  public async runTask(request: WorkflowTaskRequest): Promise<WorkflowTaskResult> {
    const taskId = request.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const workflowType: WorkflowType = request.workflowType || config.defaultWorkflow || 'supervisor';
    const maxRounds = request.maxRounds || config.maxRounds;

    const blackboard = new Blackboard(taskId, request.task, workflowType, maxRounds);
    this.activeTasks.set(taskId, blackboard);

    // Forward blackboard events to coordinator event emitter
    blackboard.on('event', (evt) => {
      this.emit('task_event', evt);
    });

    blackboard.emitEvent('task_started', {
      task: request.task,
      workflowType,
      maxRounds,
      availableAgents: Array.from(this.agents.keys()),
    });

    try {
      let result: WorkflowTaskResult;

      switch (workflowType) {
        case 'pipeline':
          result = await executePipelineWorkflow(request.task, blackboard, this.agents);
          break;
        case 'debate':
          result = await executeDebateWorkflow(request.task, blackboard, this.agents, maxRounds);
          break;
        case 'handoff':
          result = await executeHandoffWorkflow(request.task, blackboard, this.agents, maxRounds);
          break;
        case 'supervisor':
        default:
          result = await executeSupervisorWorkflow(request.task, blackboard, this.agents);
          break;
      }

      this.completedResults.set(taskId, result);
      this.activeTasks.delete(taskId);

      blackboard.emitEvent('task_completed', {
        taskId,
        status: result.status,
        durationMs: result.durationMs,
        finalAnswer: result.finalAnswer,
      });

      return result;
    } catch (err: any) {
      blackboard.emitEvent('task_error', {
        taskId,
        error: err.message || String(err),
      });

      const failedResult: WorkflowTaskResult = {
        taskId,
        task: request.task,
        workflowType,
        status: 'failed',
        finalAnswer: `Task execution failed: ${err.message || String(err)}`,
        summary: 'Error encountered during multi-agent execution.',
        agentsInvolved: Array.from(new Set(blackboard.messages.map((m) => m.sender))),
        subtasks: blackboard.subtasks,
        artifacts: blackboard.getAllArtifacts(),
        messages: blackboard.messages,
        events: blackboard.events,
        startedAt: blackboard.startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(blackboard.startedAt).getTime(),
        metrics: {
          totalMessages: blackboard.messages.length,
          totalToolCalls: blackboard.messages.reduce((acc, m) => acc + (m.toolCalls?.length || 0), 0),
          totalRounds: blackboard.currentRound || 1,
        },
      };

      this.completedResults.set(taskId, failedResult);
      this.activeTasks.delete(taskId);
      return failedResult;
    }
  }

  public getTaskResult(taskId: string): WorkflowTaskResult | undefined {
    return this.completedResults.get(taskId);
  }

  public getAllTaskResults(): WorkflowTaskResult[] {
    return Array.from(this.completedResults.values());
  }

  public getActiveTask(taskId: string): Blackboard | undefined {
    return this.activeTasks.get(taskId);
  }
}

export const defaultCoordinator = new MultiAgentCoordinator();
