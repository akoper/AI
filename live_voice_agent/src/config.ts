import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try loading .env from current directory or parent directory
const localEnvPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '..', '.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  apiKey: string;
  modelName: string;
  port: number;
  agentName: string;
  agentPersona: string;
  sampleRate: number;
  vadThreshold: number;
  silenceDurationMs: number;
}

export const config: AppConfig = {
  apiKey:
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    '',
  modelName:
    process.env.GEMINI_MODEL ||
    process.env.GOOGLE_MODEL ||
    'gemini-2.5-flash',
  port: parseInt(process.env.PORT || '3003', 10),
  agentName: process.env.VOICE_AGENT_NAME || 'Aria',
  agentPersona:
    process.env.VOICE_AGENT_PERSONA ||
    'an intelligent, helpful, and concise live voice AI assistant that understands real-time speech and answers naturally.',
  sampleRate: 16000, // Standard 16kHz audio for speech recognition
  vadThreshold: 0.015, // Energy threshold for Voice Activity Detection
  silenceDurationMs: 1200, // Silence pause in ms to finalize speech turn
};

export function validateConfig(): void {
  if (!config.apiKey) {
    console.warn(
      '⚠️ Warning: No Gemini API Key found in .env (checked GEMINI_API_KEY, GOOGLE_API_KEY). Please ensure it is set in .env'
    );
  }
}
