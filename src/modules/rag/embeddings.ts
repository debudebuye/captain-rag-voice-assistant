import { env } from '../../config/env';
import { ExternalServiceError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export interface EmbeddingsClient {
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}

interface CloudflareResponse {
  result?: {
    data: number[][];
    shape?: number[];
  };
  success: boolean;
  errors?: Array<{ message: string }>;
}

export class CloudflareEmbeddings implements EmbeddingsClient {
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly model: string;

  constructor(
    apiToken = env.CLOUDFLARE_API_TOKEN,
    accountId = env.CLOUDFLARE_ACCOUNT_ID,
    model = env.EMBEDDING_MODEL,
  ) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await this.request(texts);
      if (embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, got ${embeddings.length}`);
      }
      return embeddings;
    } catch (err) {
      logger.error(
        { err, model: this.model, count: texts.length },
        'Embedding request failed (Cloudflare Workers AI)',
      );
      throw new ExternalServiceError(
        'cloudflare',
        'Failed to generate embeddings',
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  async embedSingle(text: string): Promise<number[]> {
    try {
      const [embedding] = await this.request([text]);
      return embedding;
    } catch (err) {
      logger.error({ err, model: this.model }, 'Embedding request failed (Cloudflare Workers AI)');
      throw new ExternalServiceError(
        'cloudflare',
        'Failed to generate embeddings',
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  private async request(texts: string[]): Promise<number[][]> {
    const url =
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}` +
      `/ai/run/${this.model}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({ text: texts }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Cloudflare API ${response.status}: ${detail}`);
    }

    const json = (await response.json()) as CloudflareResponse;

    if (!json.success || !json.result) {
      const detail = json.errors?.map((e) => e.message).join('; ');
      throw new Error(`Cloudflare API error: ${detail ?? 'unknown error'}`);
    }

    return json.result.data;
  }
}