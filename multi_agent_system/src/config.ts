import dotenv from 'dotenv';
import { WorkflowType } from './types.js';

dotenv.config();

export interface SystemConfig {
  apiKey: string;
  modelName: string;
  port: number;
  nodeEnv: string;
  defaultWorkflow: WorkflowType;
  maxRounds: number;
  enableLocalSimulationFallback: boolean;
}

export const config: SystemConfig = {
  apiKey: process.env.GEMINI_API_KEY || '',
  modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  defaultWorkflow: (process.env.DEFAULT_WORKFLOW as WorkflowType) || 'supervisor',
  maxRounds: parseInt(process.env.MAX_ROUNDS || '10', 10),
  enableLocalSimulationFallback: process.env.ENABLE_LOCAL_SIMULATION_FALLBACK !== 'false',
};

export function validateConfig(): void {
  if (!config.apiKey) {
    console.warn(
      '⚠️  GEMINI_API_KEY is not set. Multi-Agent System will use high-fidelity intelligent simulation fallback mode.'
    );
  } else {
    console.log(`✅ GEMINI_API_KEY detected. Using Google Gemini model: ${config.modelName}`);
  }
}
