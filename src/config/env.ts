import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  TRANSLATION_MODEL: z.string().default('gpt-4o-mini'),
  TTS_MODEL: z.string().default('tts-1'),
  TTS_VOICE: z.string().default('onyx'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://captain:captain@localhost:5432/captain_rag'),
  VECTOR_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  AUDIO_DIR: z.string().default('./audio'),
  AUDIO_BASE_URL: z.string().default('/audio'),
  TOP_K: z.coerce.number().int().positive().default(5),
  CHUNK_SIZE: z.coerce.number().int().positive().default(500),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(50),
  SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
  KNOWLEDGE_BASE_DIR: z.string().default('./knowledge-base'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  console.error('Copy .env.example to .env and fill in the required values.');
  process.exit(1);
}

export const env = parsed.data;