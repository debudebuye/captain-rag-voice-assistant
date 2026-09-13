import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  CLOUDFLARE_API_TOKEN: z.string().min(1, 'CLOUDFLARE_API_TOKEN is required'),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID is required'),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  EMBEDDING_MODEL: z.string().default('@cf/baai/bge-m3'),
  LLM_MODEL: z.string().default('qwen/qwen3.8-27b'),
  TRANSLATION_MODEL: z.string().default('qwen/qwen3.8-27b'),
  TTS_MODEL: z.string().default('edge-tts'),
  TTS_VOICE: z.string().default('am-ET-AmehaNeural'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://captain:captain@localhost:5432/captain_rag'),
  VECTOR_DIMENSIONS: z.coerce.number().int().positive().default(1024),
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