import { BaseAgent } from '../../agents/base-agent.js';
import { Blackboard } from '../blackboard.js';
import { WorkflowTaskResult } from '../../types.js';

export async function executeDebateWorkflow(
  task: string,
  blackboard: Blackboard,
  agents: Map<string, BaseAgent>,
  maxRounds: number = 3
): Promise<WorkflowTaskResult> {
  const proposer = agents.get('Coder') || agents.get('Researcher');
  const critic = agents.get('Critic');
  const arbiter = agents.get('Supervisor');

  if (!proposer || !critic || !arbiter) {
    throw new Error('Debate workflow requires Proposer (Coder/Researcher), Critic, and Arbiter (Supervisor)');
  }

  let currentProposal = '';
  let consensusReached = false;
  let round = 0;

  while (round < maxRounds && !consensusReached) {
    round++;
    blackboard.incrementRound();

    // 1. Proposer stage
    const subtaskProp = blackboard.addSubtask(
      `Round ${round}: ${round === 1 ? 'Initial Proposal' : 'Refined Proposal'} by ${proposer.name}`,
      `Debate on: ${task}`,
      proposer.name
    );
    blackboard.updateSubtaskStatus(subtaskProp.id, 'in_progress');

    const propPrompt =
      round === 1
        ? `You are the Lead Proposer. Provide an initial solution/proposal for:\n${task}`
        : `You are the Lead Proposer. Refine your proposal addressing the Critic's feedback:\n${currentProposal}`;

    const propMsg = await proposer.executeStep(propPrompt, blackboard);
    currentProposal = propMsg.content;
    blackboard.updateSubtaskStatus(subtaskProp.id, 'completed', 'Proposal delivered');

    // 2. Critic stage
    const subtaskCrit = blackboard.addSubtask(
      `Round ${round}: Scrutiny & Critique by Critic`,
      `Review proposal for round ${round}`,
      critic.name,
      [subtaskProp.id]
    );
    blackboard.updateSubtaskStatus(subtaskCrit.id, 'in_progress');

    const critPrompt = `You are the Adversarial QA Critic. Challenge and scrutinize this proposal for flaws, security, and edge cases:\n${currentProposal}`;
    const critMsg = await critic.executeStep(critPrompt, blackboard);
    blackboard.updateSubtaskStatus(subtaskCrit.id, 'completed', 'Critique submitted');

    // 3. Arbiter / Consensus evaluation
    const subtaskArb = blackboard.addSubtask(
      `Round ${round}: Arbiter Consensus Check by Supervisor`,
      `Evaluate agreement between Proposer and Critic`,
      arbiter.name,
      [subtaskCrit.id]
    );
    blackboard.updateSubtaskStatus(subtaskArb.id, 'in_progress');

    const arbPrompt = `You are the Lead Arbiter. Evaluate the debate between ${proposer.name} and ${critic.name}.
Proposal:
${propMsg.content.slice(0, 400)}

Critique:
${critMsg.content.slice(0, 400)}

Round ${round} of ${maxRounds}.
If round >= ${maxRounds} or proposal is strong, synthesize the final agreed consensus.`;

    const arbMsg = await arbiter.executeStep(arbPrompt, blackboard);
    blackboard.updateSubtaskStatus(subtaskArb.id, 'completed', 'Arbiter verdict given');

    if (round >= maxRounds || critMsg.content.includes('APPROVED')) {
      consensusReached = true;
    }
  }

  blackboard.completedAt = new Date().toISOString();
  const durationMs = new Date(blackboard.completedAt).getTime() - new Date(blackboard.startedAt).getTime();
  const lastMsg = blackboard.messages[blackboard.messages.length - 1];

  return {
    taskId: blackboard.taskId,
    task,
    workflowType: 'debate',
    status: 'completed',
    finalAnswer: lastMsg?.content || 'Debate completed.',
    summary: `Multi-agent debate concluded after ${round} rounds with consensus reached.`,
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
      totalRounds: round,
    },
  };
}
