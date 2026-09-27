import readline from 'readline';
import { defaultCoordinator } from './orchestration/coordinator.js';
import { WorkflowType, WorkflowTraceEvent } from './types.js';
import { config, validateConfig } from './config.js';
import './tools/built-in-tools.js';

validateConfig();

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const AGENT_COLORS: Record<string, string> = {
  Supervisor: COLORS.blue,
  Researcher: COLORS.cyan,
  Coder: COLORS.green,
  Analyst: COLORS.yellow,
  Critic: COLORS.red,
  Writer: COLORS.magenta,
};

function formatEvent(evt: WorkflowTraceEvent): void {
  const time = new Date(evt.timestamp).toLocaleTimeString();
  const color = (evt.agent && AGENT_COLORS[evt.agent]) || COLORS.white;

  switch (evt.type) {
    case 'task_started':
      console.log(
        `\n${COLORS.bright}${COLORS.cyan}═══ TASK STARTED ═══${COLORS.reset} Workflow: [${evt.data.workflowType.toUpperCase()}]`
      );
      break;
    case 'agent_thought':
      console.log(
        `  ${COLORS.gray}[${time}] ${color}💭 ${evt.agent} thinking:${COLORS.reset} ${COLORS.dim}${evt.data.thought}${COLORS.reset}`
      );
      break;
    case 'tool_called':
      console.log(
        `  ${COLORS.gray}[${time}] ${color}⚡ ${evt.agent} called tool:${COLORS.reset} ${COLORS.bright}${evt.data.tool}${COLORS.reset} ${COLORS.dim}${JSON.stringify(evt.data.args)}${COLORS.reset}`
      );
      break;
    case 'tool_result':
      console.log(
        `  ${COLORS.gray}[${time}] ${color}↳ Tool result:${COLORS.reset} ${COLORS.dim}${typeof evt.data.result === 'object' ? JSON.stringify(evt.data.result).slice(0, 150) + '...' : String(evt.data.result).slice(0, 150)}${COLORS.reset}`
      );
      break;
    case 'subtask_created':
      console.log(
        `  ${COLORS.gray}[${time}] ${COLORS.yellow}📋 Subtask [${evt.data.subtask.id}]:${COLORS.reset} ${evt.data.subtask.title} (Assigned: ${evt.data.subtask.assignedAgent})`
      );
      break;
    case 'subtask_completed':
      console.log(
        `  ${COLORS.gray}[${time}] ${COLORS.green}✓ Subtask [${evt.data.subtask.id}] Completed${COLORS.reset}`
      );
      break;
    case 'agent_handoff':
      console.log(
        `  ${COLORS.gray}[${time}] ${COLORS.magenta}🔀 Handoff:${COLORS.reset} ${evt.data.from} ➔ ${evt.data.to}`
      );
      break;
    case 'artifact_created':
    case 'artifact_updated':
      console.log(
        `  ${COLORS.gray}[${time}] ${COLORS.cyan}📦 Shared Artifact [${evt.data.artifact.name}] (v${evt.data.artifact.version}) by ${evt.agent}${COLORS.reset}`
      );
      break;
    case 'agent_message':
      console.log(`\n${color}${COLORS.bright}▶ [${evt.agent}]:${COLORS.reset}`);
      console.log(`${evt.data.message.content}\n`);
      break;
    case 'task_completed':
      console.log(
        `${COLORS.bright}${COLORS.green}═══ TASK COMPLETED ═══${COLORS.reset} (Duration: ${evt.data.durationMs}ms)\n`
      );
      break;
  }
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  let workflow: WorkflowType = 'supervisor';

  const wfIndex = args.indexOf('--workflow');
  if (wfIndex !== -1 && args[wfIndex + 1]) {
    workflow = args[wfIndex + 1] as WorkflowType;
    args.splice(wfIndex, 2);
  }

  const initialTask = args.join(' ').trim();

  // Attach real-time event logger
  defaultCoordinator.on('task_event', formatEvent);

  console.log(`${COLORS.bright}${COLORS.cyan}
╔════════════════════════════════════════════════════════════╗
║         GOOGLE GEMINI MULTI-AGENT SYSTEM (CLI)             ║
╚════════════════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log(`🧠 Model: ${config.modelName}`);
  console.log(`🔄 Default Workflow: ${workflow}`);
  console.log(`👥 Active Agents: Supervisor, Researcher, Coder, Analyst, Critic, Writer\n`);

  if (initialTask) {
    console.log(`${COLORS.bright}Executing task:${COLORS.reset} ${initialTask}\n`);
    await defaultCoordinator.runTask({
      task: initialTask,
      workflowType: workflow,
    });
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question(
      `\n${COLORS.bright}${COLORS.yellow}Enter a complex task for the Gemini Multi-Agent System (or 'exit'):${COLORS.reset} `,
      async (input) => {
        const trimmed = input.trim();
        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          rl.close();
          process.exit(0);
        }

        if (!trimmed) {
          promptUser();
          return;
        }

        rl.question(
          `${COLORS.cyan}Select Workflow [1: Supervisor (default), 2: Pipeline, 3: Debate, 4: Handoff]:${COLORS.reset} `,
          async (wfChoice) => {
            let selectedWorkflow: WorkflowType = 'supervisor';
            if (wfChoice.trim() === '2') selectedWorkflow = 'pipeline';
            if (wfChoice.trim() === '3') selectedWorkflow = 'debate';
            if (wfChoice.trim() === '4') selectedWorkflow = 'handoff';

            await defaultCoordinator.runTask({
              task: trimmed,
              workflowType: selectedWorkflow,
            });

            promptUser();
          }
        );
      }
    );
  };

  promptUser();
}

if (process.argv[1] && process.argv[1].endsWith('cli.ts')) {
  runCli().catch(console.error);
}
