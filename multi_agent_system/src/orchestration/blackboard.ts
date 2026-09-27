import { EventEmitter } from 'events';
import {
  AgentMessage,
  ExecutionContext,
  SharedArtifact,
  SubTask,
  WorkflowTraceEvent,
  WorkflowType,
} from '../types.js';

export class Blackboard extends EventEmitter {
  public taskId: string;
  public workflowType: WorkflowType;
  public taskDescription: string;
  public state: Record<string, any> = {};
  public artifacts: Map<string, SharedArtifact> = new Map();
  public subtasks: SubTask[] = [];
  public messages: AgentMessage[] = [];
  public events: WorkflowTraceEvent[] = [];
  public currentRound: number = 0;
  public maxRounds: number = 10;
  public startedAt: string;
  public completedAt?: string;

  constructor(taskId: string, taskDescription: string, workflowType: WorkflowType = 'supervisor', maxRounds: number = 10) {
    super();
    this.taskId = taskId;
    this.taskDescription = taskDescription;
    this.workflowType = workflowType;
    this.maxRounds = maxRounds;
    this.startedAt = new Date().toISOString();
  }

  public getContext(): ExecutionContext {
    return {
      taskId: this.taskId,
      workflowType: this.workflowType,
      blackboard: this.state,
      artifacts: this.artifacts,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      messages: this.messages,
    };
  }

  public emitEvent(
    type: WorkflowTraceEvent['type'],
    data: any,
    agent?: string,
    targetAgent?: string
  ): WorkflowTraceEvent {
    const event: WorkflowTraceEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      taskId: this.taskId,
      timestamp: new Date().toISOString(),
      type,
      agent,
      targetAgent,
      data,
    };

    this.events.push(event);
    this.emit('event', event);
    return event;
  }

  public addMessage(
    sender: string,
    role: AgentMessage['role'],
    content: string,
    thought?: string,
    recipient: string = 'all',
    toolCalls?: any[],
    metadata?: Record<string, any>
  ): AgentMessage {
    const msg: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender,
      recipient,
      role,
      content,
      thought,
      timestamp: new Date().toISOString(),
      toolCalls,
      metadata,
    };

    this.messages.push(msg);

    if (thought) {
      this.emitEvent('agent_thought', { thought }, sender);
    }

    this.emitEvent('agent_message', { message: msg }, sender, recipient);
    return msg;
  }

  public addSubtask(title: string, description: string, assignedAgent: string, dependsOn?: string[]): SubTask {
    const subtask: SubTask = {
      id: `sub_${this.subtasks.length + 1}`,
      title,
      description,
      assignedAgent,
      status: 'pending',
      dependsOn,
      createdAt: new Date().toISOString(),
    };
    this.subtasks.push(subtask);
    this.emitEvent('subtask_created', { subtask }, assignedAgent);
    return subtask;
  }

  public updateSubtaskStatus(subtaskId: string, status: SubTask['status'], result?: string): SubTask | undefined {
    const subtask = this.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return undefined;

    subtask.status = status;
    if (result !== undefined) {
      subtask.result = result;
    }
    if (status === 'completed' || status === 'failed') {
      subtask.completedAt = new Date().toISOString();
    }

    const eventType =
      status === 'in_progress'
        ? 'subtask_started'
        : status === 'completed'
        ? 'subtask_completed'
        : 'subtask_started';

    this.emitEvent(eventType, { subtask }, subtask.assignedAgent);
    return subtask;
  }

  public saveArtifact(
    name: string,
    content: string,
    type: SharedArtifact['type'],
    agentName: string
  ): SharedArtifact {
    const existing = this.artifacts.get(name);
    const version = existing ? existing.version + 1 : 1;
    const isNew = !existing;

    const artifact: SharedArtifact = {
      id: existing?.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      type,
      content,
      createdBy: existing?.createdBy || agentName,
      updatedBy: agentName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version,
    };

    this.artifacts.set(name, artifact);
    this.emitEvent(
      isNew ? 'artifact_created' : 'artifact_updated',
      { artifact },
      agentName
    );
    return artifact;
  }

  public getArtifact(name: string): SharedArtifact | undefined {
    return this.artifacts.get(name);
  }

  public getAllArtifacts(): SharedArtifact[] {
    return Array.from(this.artifacts.values());
  }

  public setValue(key: string, value: any): void {
    this.state[key] = value;
  }

  public getValue<T = any>(key: string): T | undefined {
    return this.state[key];
  }

  public incrementRound(): number {
    this.currentRound += 1;
    this.emitEvent('debate_round', { round: this.currentRound, maxRounds: this.maxRounds });
    return this.currentRound;
  }
}
