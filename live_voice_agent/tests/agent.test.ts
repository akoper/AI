import { VoiceProcessor } from '../src/voice-processor.js';
import { tools, executeTool, getAllVoiceNotes } from '../src/tools.js';
import { googleAdkAgent } from '../src/google-adk.js';
import { config } from '../src/config.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Live Voice Agent Test Suite\n');

  // Test Suite 1: Voice Processor & Audio Operations
  console.log('1. VoiceProcessor & Audio Processing');
  {
    // Test 1.1: Audio tone generation
    const tone16k = VoiceProcessor.generateTestTone(440, 500, 16000);
    assert(tone16k.length === 16000, 'generateTestTone generates correct byte buffer length');

    // Test 1.2: RMS Calculation
    const rms = VoiceProcessor.calculateRms(tone16k);
    assert(rms > 0.3 && rms < 0.4, `calculateRms calculates accurate RMS energy (${rms.toFixed(4)})`);

    // Test 1.3: Voice Activity Detection (VAD)
    const isSpeech = VoiceProcessor.isSpeech(tone16k, 0.015);
    assert(isSpeech === true, 'isSpeech detects sound energy above threshold');

    const silence = Buffer.alloc(1600);
    const isSilenceSpeech = VoiceProcessor.isSpeech(silence, 0.015);
    assert(isSilenceSpeech === false, 'isSpeech correctly identifies silent buffer as false');

    // Test 1.4: PCM to WAV conversion
    const wav = VoiceProcessor.pcmToWav(tone16k, 16000, 1, 16);
    assert(wav.length === tone16k.length + 44, 'pcmToWav creates exact WAV header (44 bytes) + data size');
    assert(wav.subarray(0, 4).toString() === 'RIFF', 'WAV header starts with RIFF descriptor');
    assert(wav.subarray(8, 12).toString() === 'WAVE', 'WAV header contains WAVE identifier');
    assert(wav.subarray(12, 16).toString() === 'fmt ', 'WAV header contains fmt subchunk');
    assert(wav.subarray(36, 40).toString() === 'data', 'WAV header contains data subchunk');
  }

  // Test Suite 2: Agent Voice Tools
  console.log('\n2. Agent Voice Tools');
  {
    // Test 2.1: get_current_time tool
    const timeRes = await executeTool('get_current_time', { timezone: 'UTC' });
    assert(Boolean(timeRes.currentTime) && timeRes.timezone === 'UTC', 'get_current_time returns formatted date/time for UTC');

    // Test 2.2: get_weather tool
    const weatherRes = await executeTool('get_weather', { location: 'Tokyo', unit: 'celsius' });
    assert(weatherRes.location === 'Tokyo' && weatherRes.temperature.includes('°C'), 'get_weather returns condition and temperature in celsius');

    // Test 2.3: calculate tool
    const mathRes = await executeTool('calculate', { expression: '125 * 8 + 50' });
    assert(mathRes.result === 1050, `calculate evaluates expression correctly (expected 1050, got ${mathRes.result})`);

    // Test 2.4: save_voice_note and list_voice_notes
    const noteRes = await executeTool('save_voice_note', { text: 'Schedule test demo for team', tags: 'work, urgent' });
    assert(noteRes.success === true && noteRes.totalNotes > 0, 'save_voice_note stores note in memory');

    const notesList = await executeTool('list_voice_notes', { limit: 5 });
    assert(notesList.count >= 1 && notesList.notes.some((n: any) => n.text === 'Schedule test demo for team'), 'list_voice_notes returns saved notes');
    assert(getAllVoiceNotes().length >= 1, 'getAllVoiceNotes returns active notes repository');

    // Test 2.5: set_reminder tool
    const reminderRes = await executeTool('set_reminder', { reminder: 'Call John', timeOrDuration: 'in 15 minutes' });
    assert(reminderRes.success === true && reminderRes.reminder === 'Call John', 'set_reminder sets reminder successfully');
  }

  // Test Suite 3: Google ADK Agent Integration
  console.log('\n3. Google ADK Agent & Intent Understanding');
  {
    const instruction = googleAdkAgent.getSystemInstruction();
    assert(instruction.includes(config.agentName), 'Agent system instruction includes agent persona and name');

    if (config.apiKey) {
      console.log('   (Running live Gemini API query test with configured API key...)');
      try {
        const response = await googleAdkAgent.respondToVoiceInput('Hello Aria! Tell me in 5 words what you do.');
        assert(Boolean(response.reply) && response.reply.length > 0, `Google ADK Agent responded: "${response.reply}"`);
        assert(response.intent.intent === 'conversation' || response.intent.intent === 'question', 'Agent recognizes voice intent accurately');
      } catch (err: any) {
        console.warn(`   ⚠️ Gemini Live API call failed (might be network/rate limit): ${err.message}`);
      }
    } else {
      console.log('   (Skipping live API call because API key is not provided)');
    }
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
