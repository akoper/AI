import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { RagAgent } from './rag-agent.js';
import { AdkRagAgent } from './adk-rag-agent.js';
import { config, validateConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

validateConfig();

const agent = new RagAgent();
const adkAgent = new AdkRagAgent();
let useAdk = true;

// Load sample docs if empty
const sampleDataDir = path.resolve(__dirname, '..', 'data', 'knowledge');
await agent.ingestDirectory(sampleDataDir).catch(() => {});
await adkAgent.ingestDirectory(sampleDataDir).catch(() => {});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('================================================================');
console.log('🤖  WELCOME TO GEMINI RAG AI AGENT CLI (Google ADK)  🤖');
console.log('================================================================');
console.log(`📦 Framework: Google Agent Development Kit (@google/adk)`);
console.log(`🧠 Model: ${config.llmModel} | Embedding: ${config.embeddingModel}`);
const stats = agent.getStats();
console.log(`📚 Indexed Knowledge: ${stats.documentsCount} documents (${stats.chunksCount} chunks)`);
console.log('\nCommands:');
console.log('  /mode            Toggle between Google ADK and Direct RAG mode');
console.log('  /stats           Display knowledge base statistics');
console.log('  /add <text>      Ingest custom text into knowledge base');
console.log('  /file <path>     Ingest a local document file');
console.log('  /clear           Clear conversation history');
console.log('  /help            Show help');
console.log('  /exit or /quit   Exit CLI\n');
console.log('Or just type any question to query the RAG agent!\n');

function promptUser() {
  const modeLabel = useAdk ? 'Google ADK' : 'Direct';
  rl.question(`\n💬 [${modeLabel}] You: `, async (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      promptUser();
      return;
    }

    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log('👋 Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (trimmed === '/mode') {
      useAdk = !useAdk;
      console.log(`\n🔄 Switched mode to: ${useAdk ? 'Google ADK (@google/adk)' : 'Direct RAG'}`);
      promptUser();
      return;
    }

    if (trimmed === '/help') {
      console.log('\nAvailable commands:');
      console.log('  /mode            Toggle Google ADK / Direct mode');
      console.log('  /stats           Display knowledge base statistics');
      console.log('  /add <text>      Ingest custom text into knowledge base');
      console.log('  /file <path>     Ingest a local document file');
      console.log('  /clear           Clear conversation history');
      console.log('  /exit            Exit');
      promptUser();
      return;
    }

    if (trimmed === '/stats') {
      const currentStats = agent.getStats();
      console.log(`\n📊 Knowledge Base Stats:`);
      console.log(`   - Documents: ${currentStats.documentsCount}`);
      console.log(`   - Chunks: ${currentStats.chunksCount}`);
      console.log(`   - Total Chars: ${currentStats.totalCharacters}`);
      promptUser();
      return;
    }

    if (trimmed === '/clear') {
      agent.clearHistory();
      console.log('\n🧹 Conversation history cleared.');
      promptUser();
      return;
    }

    if (trimmed.startsWith('/add ')) {
      const textToAdd = trimmed.substring(5).trim();
      if (!textToAdd) {
        console.log('⚠️ Please provide text to add.');
      } else {
        process.stdout.write('⏳ Chunking and embedding...');
        const count = await agent.ingestText(textToAdd, { title: 'CLI Added Document' });
        await adkAgent.ingestText(textToAdd, { title: 'CLI Added Document' });
        console.log(`\n✅ Ingested ${count} chunks into knowledge base!`);
      }
      promptUser();
      return;
    }

    if (trimmed.startsWith('/file ')) {
      const filePath = trimmed.substring(6).trim();
      try {
        process.stdout.write(`⏳ Loading and embedding file "${filePath}"...`);
        const count = await agent.ingestFile(filePath);
        await adkAgent.ingestFile(filePath);
        console.log(`\n✅ Successfully ingested ${count} chunks from file!`);
      } catch (err: any) {
        console.log(`\n❌ Error ingesting file: ${err?.message || err}`);
      }
      promptUser();
      return;
    }

    // Process RAG Query
    try {
      process.stdout.write(`🔍 [${useAdk ? 'Google ADK' : 'Direct'}] Querying knowledge base...\n`);
      const response = useAdk ? await adkAgent.query(trimmed) : await agent.chat(trimmed);

      console.log('\n' + '='.repeat(60));
      console.log(`🤖 Agent (${response.usedModel} | ${response.latencyMs}ms, confidence: ${(response.confidence * 100).toFixed(0)}%):`);
      console.log('='.repeat(60));
      console.log(response.answer);

      if (response.citations.length > 0) {
        console.log('\n📖 Sources & Citations:');
        response.citations.forEach((c, idx) => {
          console.log(`  [${idx + 1}] ${c.source} (score: ${(c.score * 100).toFixed(1)}%)`);
          console.log(`      "${c.snippet}"`);
        });
      }
    } catch (err: any) {
      console.error('\n❌ Query failed:', err?.message || err);
    }

    promptUser();
  });
}

promptUser();
