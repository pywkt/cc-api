import { z } from 'zod';
import type { Config } from '../types';

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  API_KEYS: z.string().transform((s) => s.split(',').map((k) => k.trim())),
  CLAUDE_TIMEOUT_MS: z.string().default('120000').transform(Number),
  CLAUDE_MODEL: z.string().optional(),
  DEFAULT_ALLOWED_TOOLS: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((t) => t.trim()) : undefined)),
  OLLAMA_API_ENABLED: z
    .string()
    .default('true')
    .transform((s) => s.toLowerCase() === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SESSION_STORAGE: z.enum(['memory', 'file']).default('memory'),
  SESSION_STORAGE_PATH: z.string().default('./sessions'),
});

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  const env = result.data;

  return {
    port: env.PORT,
    host: env.HOST,
    apiKeys: env.API_KEYS,
    claudeTimeout: env.CLAUDE_TIMEOUT_MS,
    claudeModel: env.CLAUDE_MODEL,
    defaultAllowedTools: env.DEFAULT_ALLOWED_TOOLS,
    ollamaApiEnabled: env.OLLAMA_API_ENABLED,
    logLevel: env.LOG_LEVEL,
    sessionStorage: {
      type: env.SESSION_STORAGE,
      path: env.SESSION_STORAGE_PATH,
    },
  };
}

export const config = loadConfig();
