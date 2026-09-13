import OpenAI from 'openai';
import { env } from '../../config/env';
import { ExternalServiceError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export interface Translator {
  translate(text: string, targetLanguage: string): Promise<string>;
}

const LANGUAGE_NAMES: Record<string, string> = {
  am: 'Amharic (አማርኛ, written in Ethiopic script)',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  sw: 'Swahili',
  de: 'German',
};

function resolveLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

function buildTranslationPrompt(text: string, targetLanguage: string): string {
  const language = resolveLanguageName(targetLanguage);
  return `Translate the following text into ${language}. Rules:
1. Translate the meaning faithfully, not word-by-word.
2. Preserve names, numbers, units, and technical terms that are standard in maritime usage.
3. Keep the same tone: concise professional shipboard communication.
4. Output ONLY the translation, nothing else.

TEXT:
"""${text}"""`;
}

export class GroqTranslator implements Translator {
  private readonly client: OpenAI;

  constructor(client = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL })) {
    this.client = client;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: env.TRANSLATION_MODEL,
        messages: [
          { role: 'system', content: 'You are a professional maritime translator.' },
          {
            role: 'user',
            content: buildTranslationPrompt(text, targetLanguage),
          },
        ],
        temperature: 0.2,
      });

      const translation = response.choices[0]?.message?.content?.trim() ?? '';
      if (!translation) {
        throw new ExternalServiceError('groq', 'Translation produced empty output');
      }

      return translation;
    } catch (err) {
      logger.error(
        { err, targetLanguage },
        'Translation request failed',
      );
      throw new ExternalServiceError(
        'groq',
        'Failed to translate the answer',
        err instanceof Error ? err.message : undefined,
      );
    }
  }
}