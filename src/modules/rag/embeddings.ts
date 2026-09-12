import OpenAI from 'openai';
import { env } from '../../config/env';
import { ExternalServiceError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export interface EmbeddingsClient {
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}

export class OpenAiEmbeddings implements EmbeddingsClient {
  private readonly client: OpenAI;

  constructor(client = new OpenAI({ apiKey: env.OPENAI_API_KEY })) {
    this.client = client;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    } catch (err) {
      logger.error({ err, model: env.EMBEDDING_MODEL, count: texts.length }, 'Embedding request failed');
      throw new ExternalServiceError(
        'openai',
        'Failed to generate embeddings',
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }
}