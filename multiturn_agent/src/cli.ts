import readline from 'readline';
import { defaultAdkAgent } from './adk-agent.js';
import { defaultSessionManager } from './session-manager.js';
import { defaultToolRegistry } from './tools.js';
import { config } from './config.js';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

async function runCli() {
  console.clear();
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold} 🤖 Google ADK Multi-Turn Agent Interactive CLI ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.dim}Model: ${config.modelName} | Tool Calling: Enabled | Max Turns: ${config.maxHistoryTurns}${colors.reset}`);
  console.log(`${colors.dim}Type ${colors.yellow}/help${colors.dim} for commands, or just type your message to chat.${colors.reset}\n`);

  let currentSession = defaultSessionManager.createSession({
    title: 'CLI Multi-Turn Session',
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    const turnCount = Math.floor(currentSession.messages.length / 2) + 1;
    rl.question(`\n${colors.green}${colors.bold}[Turn ${turnCount}] You > ${colors.reset}`, async (input) => {
      const line = input.trim();
      if (!line) {
        promptUser();
        return;
      }

      // Handle Slash Commands
      if (line.startsWith('/')) {
        const parts = line.split(' ');
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ').trim();

        switch (cmd) {
          case '/help':
            console.log(`\n${colors.yellow}${colors.bold}Available Commands:${colors.reset}`);
            console.log(`  ${colors.cyan}/help${colors.reset}           - Show this help menu`);
            console.log(`  ${colors.cyan}/history${colors.reset}        - View full multi-turn conversation history`);
            console.log(`  ${colors.cyan}/memory${colors.reset}         - View current session facts, notes, and todos`);
            console.log(`  ${colors.cyan}/tools${colors.reset}          - List all registered agent tools`);
            console.log(`  ${colors.cyan}/fork [turn]${colors.reset}   - Fork current session at turn number`);
            console.log(`  ${colors.cyan}/sessions${colors.reset}       - List all conversation sessions`);
            console.log(`  ${colors.cyan}/new${colors.reset}            - Start a brand new session`);
            console.log(`  ${colors.cyan}/switch <id>${colors.reset}    - Switch to an existing session`);
            console.log(`  ${colors.cyan}/clear${colors.reset}          - Clear conversation history in this session`);
            console.log(`  ${colors.cyan}/model <name>${colors.reset}   - Switch model (e.g. gemini-2.5-flash)`);
            console.log(`  ${colors.cyan}/exit${colors.reset}           - Exit CLI`);
            break;

          case '/history':
            console.log(`\n${colors.yellow}${colors.bold}Session History (${currentSession.messages.length} messages):${colors.reset}`);
            if (currentSession.messages.length === 0) {
              console.log(`${colors.dim}No turns yet in this session.${colors.reset}`);
            } else {
              for (const msg of currentSession.messages) {
                const prefix = msg.role === 'user' ? `${colors.green}User (Turn ${msg.turnNumber})` : `${colors.magenta}Nexus (Turn ${msg.turnNumber})`;
                const text = msg.parts.map(p => p.text || (p.functionCall ? `[Call: ${p.functionCall.name}]` : `[Response: ${p.functionResponse?.name}]`)).join(' ');
                console.log(`\n${prefix}${colors.reset}: ${text}`);
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                  for (const tc of msg.toolCalls) {
                    console.log(`  ${colors.blue}⚙️ Tool: ${tc.name}(${JSON.stringify(tc.args)}) -> ${JSON.stringify(tc.result || tc.error)}${colors.reset}`);
                  }
                }
              }
            }
            break;

          case '/memory':
            console.log(`\n${colors.yellow}${colors.bold}Session Memory State:${colors.reset}`);
            console.log(`${colors.cyan}Facts:${colors.reset}`, currentSession.memory.facts);
            console.log(`${colors.cyan}Notes:${colors.reset}`, currentSession.memory.notes);
            console.log(`${colors.cyan}Todos:${colors.reset}`, currentSession.memory.todos);
            break;

          case '/tools':
            console.log(`\n${colors.yellow}${colors.bold}Registered Agent Tools:${colors.reset}`);
            for (const tool of defaultToolRegistry.getDeclarations()) {
              console.log(`  ${colors.cyan}• ${tool.name}${colors.reset}: ${tool.description}`);
            }
            break;

          case '/fork': {
            const turn = arg ? parseInt(arg, 10) : undefined;
            try {
              const forked = defaultSessionManager.forkSession(currentSession.id, turn);
              currentSession = forked;
              console.log(`\n${colors.green}✓ Forked session successfully to new ID: ${forked.id}${colors.reset}`);
            } catch (e: any) {
              console.log(`\n${colors.red}Failed to fork: ${e.message}${colors.reset}`);
            }
            break;
          }

          case '/sessions': {
            const sessions = defaultSessionManager.getAllSessions();
            console.log(`\n${colors.yellow}${colors.bold}All Saved Sessions (${sessions.length}):${colors.reset}`);
            for (const s of sessions) {
              const activeMark = s.id === currentSession.id ? `${colors.green}(active)${colors.reset}` : '';
              console.log(`  • [${s.id}] ${s.title} (${Math.ceil(s.messages.length / 2)} turns) ${activeMark}`);
            }
            break;
          }

          case '/new':
            currentSession = defaultSessionManager.createSession({
              title: `CLI Session ${Date.now()}`,
            });
            console.log(`\n${colors.green}✓ Started new multi-turn session: ${currentSession.id}${colors.reset}`);
            break;

          case '/switch': {
            const target = defaultSessionManager.getSession(arg);
            if (target) {
              currentSession = target;
              console.log(`\n${colors.green}✓ Switched to session: ${target.id} (${target.title})${colors.reset}`);
            } else {
              console.log(`\n${colors.red}Session "${arg}" not found.${colors.reset}`);
            }
            break;
          }

          case '/clear':
            defaultSessionManager.clearHistory(currentSession.id);
            console.log(`\n${colors.green}✓ Cleared conversation turns for session ${currentSession.id}.${colors.reset}`);
            break;

          case '/model':
            if (arg) {
              currentSession.model = arg;
              defaultSessionManager.updateSession(currentSession.id, { model: arg });
              console.log(`\n${colors.green}✓ Set session model to: ${arg}${colors.reset}`);
            } else {
              console.log(`\n${colors.yellow}Current model: ${currentSession.model}${colors.reset}`);
            }
            break;

          case '/exit':
          case '/quit':
            console.log(`\n${colors.cyan}Goodbye! 👋${colors.reset}`);
            rl.close();
            process.exit(0);

          default:
            console.log(`\n${colors.red}Unknown command: ${cmd}. Type /help for options.${colors.reset}`);
            break;
        }

        promptUser();
        return;
      }

      // Normal multi-turn message handling
      process.stdout.write(`\n${colors.magenta}${colors.bold}🤖 ${config.agentName} > ${colors.reset}`);

      let printedDelta = false;
      try {
        await defaultAdkAgent.interact(currentSession.id, line, {
          onToolCallStart: (toolName, args) => {
            console.log(`\n  ${colors.blue}⚙️ Calling Tool [${toolName}] with args: ${JSON.stringify(args)}${colors.reset}`);
          },
          onToolCallComplete: (toolName, result, dur) => {
            console.log(`  ${colors.blue}✓ Tool [${toolName}] returned in ${dur}ms: ${JSON.stringify(result)}${colors.reset}`);
            process.stdout.write(`\n${colors.magenta}${colors.bold}🤖 ${config.agentName} > ${colors.reset}`);
          },
          onDelta: (delta) => {
            printedDelta = true;
            process.stdout.write(delta);
          },
        });
        if (!printedDelta) {
          console.log();
        } else {
          console.log();
        }
      } catch (err: any) {
        console.log(`\n${colors.red}Error: ${err.message}${colors.reset}`);
      }

      promptUser();
    });
  };

  promptUser();
}

runCli();
