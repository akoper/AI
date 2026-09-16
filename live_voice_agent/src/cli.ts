import readline from 'readline';
import { googleAdkAgent } from './google-adk.js';
import { VoiceProcessor } from './voice-processor.js';
import { config, validateConfig } from './config.js';
import { VoiceChatMessage } from './types.js';

validateConfig();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history: VoiceChatMessage[] = [];

console.log('====================================================');
console.log(`🎙️  Live Voice Agent CLI (${config.agentName})`);
console.log(`🤖  Model: ${config.modelName}`);
console.log('⚡  Google ADK & Real-Time Voice Understanding');
console.log('====================================================');
console.log('Commands:');
console.log('  Type anything to test voice text understanding');
console.log('  /tone           -> Generate and test synthetic PCM audio buffer');
console.log('  /tools          -> Test built-in agent voice tools');
console.log('  /exit           -> Quit');
console.log('----------------------------------------------------');

function prompt() {
  rl.question('\n🗣️  User > ', async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    if (trimmed === '/exit' || trimmed === 'exit') {
      console.log('👋 Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (trimmed === '/tone') {
      console.log('🎵 Generating 1-second 440Hz test audio tone buffer...');
      const pcmTone = VoiceProcessor.generateTestTone(440, 1000, 16000);
      const isSpeech = VoiceProcessor.isSpeech(pcmTone, config.vadThreshold);
      const wav = VoiceProcessor.pcmToWav(pcmTone, 16000);
      console.log(`✅ Audio PCM Buffer created: ${pcmTone.length} bytes.`);
      console.log(`📊 Voice Activity Detection (VAD) RMS: ${VoiceProcessor.calculateRms(pcmTone).toFixed(4)} (Speech: ${isSpeech})`);
      console.log(`📦 WAV container created: ${wav.length} bytes.`);
      prompt();
      return;
    }

    if (trimmed === '/tools') {
      console.log('🛠️  Running automated voice tool tests...');
      const sampleQueries = [
        'What time is it in Tokyo right now?',
        'What is the weather like in Paris?',
        'Calculate 350 multiplied by 42 minus 150',
        'Save a voice note: Review Q3 machine learning architecture report',
        'List my saved notes',
      ];

      for (const query of sampleQueries) {
        console.log(`\n🗣️  Voice: "${query}"`);
        try {
          const result = await googleAdkAgent.respondToVoiceInput(query, history);
          console.log(`🤖  ${config.agentName}: ${result.reply}`);
          if (result.toolExecution) {
            console.log(`   [Tool Executed]: ${result.toolExecution.tool}`);
            console.log(`   [Tool Output]: ${JSON.stringify(result.toolExecution.output)}`);
          }
        } catch (err: any) {
          console.error(`   ❌ Error:`, err.message);
        }
      }
      prompt();
      return;
    }

    try {
      process.stdout.write(`🤖  ${config.agentName} is thinking...`);
      const result = await googleAdkAgent.respondToVoiceInput(trimmed, history, {
        onToolCall: (name, args) => {
          process.stdout.write(`\n   ⚙️ Calling tool '${name}' with args: ${JSON.stringify(args)}...\n`);
        },
      });

      // Clear the thinking line
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      console.log(`🤖  ${config.agentName}: ${result.reply}`);
      if (result.intent.intent) {
        console.log(`   🏷️  [Intent: ${result.intent.intent}]`);
      }

      history.push(
        { id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() },
        { id: `agent-${Date.now()}`, role: 'agent', content: result.reply, timestamp: Date.now() }
      );
    } catch (err: any) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.error(`❌ Error:`, err.message);
    }

    prompt();
  });
}

prompt();
