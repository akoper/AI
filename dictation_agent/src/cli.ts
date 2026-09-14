import readline from 'readline';
import { agent } from './agent.js';
import { config } from './config.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('====================================================');
  console.log('  🎙️  Google AI Voice Dictation & Chat Agent (CLI)');
  console.log('====================================================');
  console.log(`Model: ${config.modelName}`);
  console.log(`API Key: ${config.apiKey ? '✓ Loaded from .env' : '✗ Missing'}`);
  console.log('Type your speech or text input. Type "exit" to quit.\n');

  const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  while (true) {
    const userInput = await prompt('\n🗣️  Speak/Type: ');
    if (!userInput.trim()) continue;
    if (userInput.toLowerCase().trim() === 'exit' || userInput.toLowerCase().trim() === 'quit') {
      console.log('Goodbye!');
      rl.close();
      break;
    }

    try {
      console.log('🤖 Agent thinking...');
      const reply = await agent.talkToAgent(userInput, history);
      console.log('\n💬 Agent Response:');
      console.log('----------------------------------------------------');
      console.log(reply);
      console.log('----------------------------------------------------');

      history.push({ role: 'user', parts: [{ text: userInput }] });
      history.push({ role: 'model', parts: [{ text: reply }] });
    } catch (err: any) {
      console.error('Error:', err.message || err);
    }
  }
}

main().catch(console.error);
