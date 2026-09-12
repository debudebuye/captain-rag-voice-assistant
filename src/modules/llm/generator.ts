import OpenAI from 'openai';
import { env } from '../../config/env';
import { ExternalServiceError } from '../../shared/errors';
import { buildSystemPrompt, formatContext, buildUserPrompt } from './prompt';

export interface GenerationResult {
  text: string;
  usedContext: boolean;
}

export interface LlmClient {
  generateGroundedAnswer(query: string, context: string): Promise<GenerationResult>;
}

export class OpenAiLlm implements LlmClient {
  private readonly client: OpenAI;

  constructor(client = new OpenAI({ apiKey: env.OPENAI_API_KEY })) {
    this.client = client;
  }

  async generateGroundedAnswer(query: string, context: string): Promise<GenerationResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: env.LLM_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(query, context) },
        ],
        temperature: 0.2,
        max_tokens: 300,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? '';
      const usedContext = !text.includes(
        'I do not have enough information in the knowledge base to answer that question.',
      );

      return { text, usedContext };
    } catch (err) {
      throw new ExternalServiceError(
        'openai',
        'Failed to generate a grounded answer',
        err instanceof Error ? err.message : undefined,
      );
    }
  }
}

export { formatContext };