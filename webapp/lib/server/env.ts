import { z } from 'zod';

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.4-mini'),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),
  WORKSPACE_TOKEN_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional()
});

const parsedEnv = serverEnvSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  POSTGRES_URL: process.env.POSTGRES_URL,
  POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
  WORKSPACE_TOKEN_SECRET: process.env.WORKSPACE_TOKEN_SECRET,
  CRON_SECRET: process.env.CRON_SECRET
});

export function getServerEnv() {
  return parsedEnv;
}

export function isPersistenceConfigured() {
  return Boolean(
    parsedEnv.POSTGRES_URL &&
      parsedEnv.POSTGRES_URL_NON_POOLING &&
      parsedEnv.BLOB_READ_WRITE_TOKEN &&
      parsedEnv.WORKSPACE_TOKEN_SECRET
  );
}

export function assertPersistenceConfigured() {
  if (!isPersistenceConfigured()) {
    throw new Error('Persistence is not configured. POSTGRES_URL, POSTGRES_URL_NON_POOLING, BLOB_READ_WRITE_TOKEN, WORKSPACE_TOKEN_SECRET を設定してください。');
  }
}

export function isAiConfigured() {
  return Boolean(parsedEnv.OPENAI_API_KEY);
}
