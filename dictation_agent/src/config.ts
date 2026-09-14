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

export const config = {
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '',
  modelName: process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-2.5-flash',
  port: parseInt(process.env.PORT || '3000', 10),
};

export function validateConfig(): void {
  if (!config.apiKey) {
    console.warn(
      '⚠️ Warning: No Gemini API Key found in .env (checked GEMINI_API_KEY, GOOGLE_API_KEY). Please ensure it is set in .env'
    );
  }
}
