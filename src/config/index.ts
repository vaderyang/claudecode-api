import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

export const config: AppConfig = {
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  requireOpenAiKey: process.env['OPENAI_API_KEY_REQUIRED'] === 'true',
  logLevel: process.env['LOG_LEVEL'] || 'info',
  corsOrigin: process.env['CORS_ORIGIN'] || '*'
};

export const validateConfig = (): void => {
  const requiredVars: (keyof AppConfig)[] = [];
  
  if (config.requireOpenAiKey && !process.env['OPENAI_API_KEY']) {
    requiredVars.push('requireOpenAiKey');
  }

  if (requiredVars.length > 0) {
    throw new Error(`Missing required environment variables: ${requiredVars.join(', ')}`);
  }
};