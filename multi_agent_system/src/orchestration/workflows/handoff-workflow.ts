import { BaseAgent } from '../../agents/base-agent.js';
import { Blackboard } from '../blackboard.js';
import { WorkflowTaskResult } from '../../types.js';

export async function executeHandoffWorkflow(
  task: string,
  blackboard: Blackboard,
  agents: Map<string, BaseAgent>,
  maxHandoffs: number = 5
): Promise<WorkflowTaskResult> {
  let currentAgentName = 'Researcher';
  let handoffCount = 0;
  const visitedAgents = new Set<string>();

  const handoffSchedule: Record<string, string> = {
    Researcher: 'Coder',
    Coder: 'Analyst',
    Analyst: 'Critic',
    Critic: 'Writer',
    Writer: 'DONE',
  };

  while (currentAgentName !== 'DONE' && handoffCount < maxHandoffs) {
    handoffCount++;
    const agent = agents.get(currentAgentName);
    if (!agent) break;

    visitedAgents.add(currentAgentName);

    const subtask = blackboard.addSubtask(
      `Autonomous Turn ${handoffCount}: ${currentAgentName}`,
      `Handling dynamic delegation step for: ${task}`,
      currentAgentName
    );
    blackboard.updateSubtaskStatus(subtask.id, 'in_progress');

    const nextTarget = handoffSchedule[currentAgentName] || 'DONE';

    const prompt = `Task: ${task}
You have been handed control of this task.
Execute your domain specialty. Upon completion, delegate to ${nextTarget !== 'DONE' ? nextTarget : 'Finalization'}.`;

    const msg = await agent.executeStep(prompt, blackboard, { targetRecipient: nextTarget });
    blackboard.updateSubtaskStatus(subtask.id, 'completed', `Completed by ${currentAgentName}`);

    if (nextTarget !== 'DONE') {
      blackboard.emitEvent('agent_handoff', { from: currentAgentName, to: nextTarget }, currentAgentName, nextTarget);
    }

    currentAgentName = nextTarget;
  }

  blackboard.completedAt = new Date().toISOString();
  const durationMs = new Date(blackboard.completedAt).getTime() - new Date(blackboard.startedAt).getTime();
  const lastMsg = blackboard.messages[blackboard.messages.length - 1];

  return {
    taskId: blackboard.taskId,
    task,
    workflowType: 'handoff',
    status: 'completed',
    finalAnswer: lastMsg?.content || 'Autonomous handoff workflow concluded.',
    summary: `Dynamic handoff completed across ${visitedAgents.size} specialized agents.`,
    agentsInvolved: Array.from(visitedAgents),
    subtasks: blackboard.subtasks,
    artifacts: blackboard.getAllArtifacts(),
    messages: blackboard.messages,
    events: blackboard.events,
    startedAt: blackboard.startedAt,
    completedAt: blackboard.completedAt,
    durationMs,
    metrics: {
      totalMessages: blackboard.messages.length,
      totalToolCalls: blackboard.messages.reduce((acc, m) => acc + (m.toolCalls?.length || 0), 0),
      totalRounds: handoffCount,
    },
  };
}
