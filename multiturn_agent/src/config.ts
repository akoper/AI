import dotenv from 'dotenv';
dotenv.config();

export interface AgentConfig {
  apiKey: string;
  modelName: string;
  port: number;
  agentName: string;
  agentRole: string;
  maxHistoryTurns: number;
  enableAutoToolCalling: boolean;
}

export const config: AgentConfig = {
  apiKey: process.env.GEMINI_API_KEY || '',
  modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  port: parseInt(process.env.PORT || '3004', 10),
  agentName: process.env.AGENT_NAME || 'Nexus',
  agentRole: process.env.AGENT_ROLE || 'an advanced multi-turn conversational AI assistant with memory and dynamic tool execution',
  maxHistoryTurns: parseInt(process.env.MAX_HISTORY_TURNS || '50', 10),
  enableAutoToolCalling: process.env.ENABLE_AUTO_TOOL_CALLING !== 'false',
};

export function validateConfig(): void {
  if (!config.apiKey) {
    console.warn('⚠️ GEMINI_API_KEY is not set. The agent will run with simulated local responses unless an API key is provided.');
  }
}
