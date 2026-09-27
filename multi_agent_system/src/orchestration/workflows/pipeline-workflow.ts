import { BaseAgent } from '../../agents/base-agent.js';
import { Blackboard } from '../blackboard.js';
import { WorkflowTaskResult } from '../../types.js';

export async function executePipelineWorkflow(
  task: string,
  blackboard: Blackboard,
  agents: Map<string, BaseAgent>
): Promise<WorkflowTaskResult> {
  const pipelineOrder = ['Researcher', 'Coder', 'Analyst', 'Critic', 'Writer'];
  let previousOutput = `Initial Objective: ${task}`;

  for (let i = 0; i < pipelineOrder.length; i++) {
    const agentName = pipelineOrder[i];
    const agent = agents.get(agentName);
    if (!agent) continue;

    const subtaskId = blackboard.addSubtask(
      `Pipeline Stage ${i + 1}: ${agentName} Processing`,
      previousOutput.slice(0, 100),
      agentName,
      i > 0 ? [`sub_${i}`] : undefined
    ).id;

    blackboard.updateSubtaskStatus(subtaskId, 'in_progress');

    const prompt = `Pipeline Stage ${i + 1} of ${pipelineOrder.length}.
Task Objective: ${task}

Input from previous stage:
${previousOutput}

Please execute your specialized role (${agent.role}) to advance the solution.`;

    const msg = await agent.executeStep(prompt, blackboard);
    previousOutput = msg.content;
    blackboard.updateSubtaskStatus(subtaskId, 'completed', `Completed by ${agentName}`);
  }

  blackboard.completedAt = new Date().toISOString();
  const durationMs = new Date(blackboard.completedAt).getTime() - new Date(blackboard.startedAt).getTime();
  const lastMsg = blackboard.messages[blackboard.messages.length - 1];

  return {
    taskId: blackboard.taskId,
    task,
    workflowType: 'pipeline',
    status: 'completed',
    finalAnswer: lastMsg?.content || 'Pipeline processing completed.',
    summary: `Sequential pipeline executed through ${pipelineOrder.join(' ➔ ')}.`,
    agentsInvolved: Array.from(new Set(blackboard.messages.map((m) => m.sender).filter((s) => s !== 'user'))),
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
      totalRounds: 1,
    },
  };
}
