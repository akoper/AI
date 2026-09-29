/**
 * Educational & Structured Console Logger for Google Gemini RAG Learning Lab.
 * Outputs readable, formatted logs to the IDE terminal/console.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function formatTimestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

const logger = {
  server: (msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.green}[SERVER]${colors.reset} ${msg}`);
  },

  info: (tag, msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.cyan}[${tag}]${colors.reset} ${msg}`);
  },

  ingest: (msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.blue}[INGEST]${colors.reset} ${msg}`);
  },

  chunker: (msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.magenta}[CHUNKER]${colors.reset} ${msg}`);
  },

  embed: (msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.yellow}[EMBEDDING]${colors.reset} ${msg}`);
  },

  vectorStore: (msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.cyan}[VECTOR_STORE]${colors.reset} ${msg}`);
  },

  rag: (step, msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.bright}${colors.blue}[RAG:STEP ${step}]${colors.reset} ${msg}`);
  },

  ragSummary: (msg) => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.bright}${colors.green}[RAG]${colors.reset} ${msg}`);
  },

  warn: (tag, msg) => {
    console.warn(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.yellow}[WARN:${tag}]${colors.reset} ⚠️ ${msg}`);
  },

  error: (tag, msg) => {
    console.error(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.red}[ERROR:${tag}]${colors.reset} ❌ ${msg}`);
  }
};

module.exports = logger;
