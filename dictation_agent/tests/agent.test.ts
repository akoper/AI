import { config } from '../src/config.js';
import { agent } from '../src/agent.js';

async function testAgent() {
  console.log('--- Testing Dictation Agent ---');
  console.log('Checking config...');
  console.log('API Key configured:', Boolean(config.apiKey));
  console.log('Model:', config.modelName);

  if (!config.apiKey) {
    console.error('❌ Test failed: API Key is not set.');
    process.exit(1);
  }

  try {
    console.log('\nTesting polishDictation...');
    const rawSpeech = 'um hello so yeah I wanted to like test this dictation agent and see if it works';
    const polished = await agent.polishDictation(rawSpeech, { mode: 'polish' });
    console.log('Raw:', rawSpeech);
    console.log('Polished:', polished);

    console.log('\nTesting talkToAgent...');
    const reply = await agent.talkToAgent('Say "Voice Agent online and ready to dictate and read back speech!" in one short sentence.');
    console.log('Reply:', reply);

    console.log('\n✅ All Agent Tests Passed Successfully!');
  } catch (err: any) {
    console.error('❌ Test encountered error:', err.message || err);
    process.exit(1);
  }
}

testAgent();
