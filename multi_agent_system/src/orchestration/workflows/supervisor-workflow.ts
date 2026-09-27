import { BaseAgent } from '../../agents/base-agent.js';
import { Blackboard } from '../blackboard.js';
import { WorkflowTaskResult } from '../../types.js';

export async function executeSupervisorWorkflow(
  task: string,
  blackboard: Blackboard,
  agents: Map<string, BaseAgent>
): Promise<WorkflowTaskResult> {
  const supervisor = agents.get('Supervisor');
  const researcher = agents.get('Researcher');
  const coder = agents.get('Coder');
  const analyst = agents.get('Analyst');
  const critic = agents.get('Critic');
  const writer = agents.get('Writer');

  if (!supervisor) {
    throw new Error('SupervisorAgent is required for Supervisor workflow');
  }

  // 1. Supervisor initializes and plans
  const sub1 = blackboard.addSubtask('Decompose objective and plan specialist delegation', task, 'Supervisor');
  blackboard.updateSubtaskStatus(sub1.id, 'in_progress');
  await supervisor.executeStep(`Analyze the following task and initiate delegation plan:\n${task}`, blackboard);
  blackboard.updateSubtaskStatus(sub1.id, 'completed', 'Plan formulated');

  // 2. Researcher executes research subtask
  if (researcher) {
    const sub2 = blackboard.addSubtask('Gather domain knowledge, benchmarks, and standards', task, 'Researcher', [sub1.id]);
    blackboard.updateSubtaskStatus(sub2.id, 'in_progress');
    await researcher.executeStep(`Conduct thorough research and technical context analysis for:\n${task}`, blackboard);
    blackboard.updateSubtaskStatus(sub2.id, 'completed', 'Research brief saved to blackboard');
  }

  // 3. Coder implements technical solution
  if (coder) {
    const sub3 = blackboard.addSubtask('Implement TypeScript architecture and logic', task, 'Coder', [sub1.id]);
    blackboard.updateSubtaskStatus(sub3.id, 'in_progress');
    await coder.executeStep(`Implement the core code module, interfaces, and logic for:\n${task}`, blackboard);
    blackboard.updateSubtaskStatus(sub3.id, 'completed', 'Code module created');
  }

  // 4. Analyst benchmarks and quantifies
  if (analyst) {
    const sub4 = blackboard.addSubtask('Analyze metrics, performance, and quantitative stats', task, 'Analyst', [sub1.id]);
    blackboard.updateSubtaskStatus(sub4.id, 'in_progress');
    await analyst.executeStep(`Analyze quantitative factors, metrics, and statistical benchmarks for:\n${task}`, blackboard);
    blackboard.updateSubtaskStatus(sub4.id, 'completed', 'Analytics report generated');
  }

  // 5. Critic evaluates the collective artifacts
  if (critic) {
    const sub5 = blackboard.addSubtask('Peer review, security critique, and QA evaluation', task, 'Critic', [sub1.id]);
    blackboard.updateSubtaskStatus(sub5.id, 'in_progress');
    await critic.executeStep(`Critique the implementation, artifacts, and findings for:\n${task}`, blackboard);
    blackboard.updateSubtaskStatus(sub5.id, 'completed', 'Review completed with approval');
  }

  // 6. Writer formats the executive report
  if (writer) {
    const sub6 = blackboard.addSubtask('Synthesize executive documentation report', task, 'Writer', [sub1.id]);
    blackboard.updateSubtaskStatus(sub6.id, 'in_progress');
    await writer.executeStep(`Compile the complete documentation report for:\n${task}`, blackboard);
    blackboard.updateSubtaskStatus(sub6.id, 'completed', 'Final report compiled');
  }

  // 7. Supervisor synthesizes final response
  const sub7 = blackboard.addSubtask('Synthesize final coordinated deliverable', task, 'Supervisor');
  blackboard.updateSubtaskStatus(sub7.id, 'in_progress');
  const finalMsg = await supervisor.executeStep(`Synthesize final deliverable and summarize outcomes for:\n${task}`, blackboard);
  blackboard.updateSubtaskStatus(sub7.id, 'completed', 'Final synthesis completed');

  blackboard.completedAt = new Date().toISOString();
  const durationMs = new Date(blackboard.completedAt).getTime() - new Date(blackboard.startedAt).getTime();

  return {
    taskId: blackboard.taskId,
    task,
    workflowType: 'supervisor',
    status: 'completed',
    finalAnswer: finalMsg.content,
    summary: 'Supervisor workflow completed across all specialized Gemini agents.',
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
      totalRounds: blackboard.currentRound || 1,
    },
  };
}
