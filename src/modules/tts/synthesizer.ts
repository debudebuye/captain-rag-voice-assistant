import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { env } from '../../config/env';
import { ExternalServiceError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export interface TtsResult {
  audioPath: string;
  audioUrl: string;
}

export interface TtsClient {
  synthesize(text: string): Promise<TtsResult>;
}

export function sanitizeFileName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export class OpenAiTts implements TtsClient {
  private readonly client: OpenAI;
  private readonly audioDir: string;

  constructor(
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY }),
    options: { audioDir?: string } = {},
  ) {
    this.client = client;
    this.audioDir = options.audioDir ?? env.AUDIO_DIR;
  }

  async synthesize(text: string): Promise<TtsResult> {
    try {
      const response = await this.client.audio.speech.create({
        model: env.TTS_MODEL,
        voice: env.TTS_VOICE as OpenAI.Audio.SpeechCreateParams['voice'],
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) {
        throw new ExternalServiceError('openai', 'TTS produced an empty audio file');
      }

      const fileName = `${sanitizeFileName(text) || 'answer'}-${randomUUID().slice(0, 8)}.mp3`;
      const audioPath = path.join(this.audioDir, fileName);
      fs.mkdirSync(this.audioDir, { recursive: true });
      fs.writeFileSync(audioPath, buffer);

      const audioUrl = `${env.AUDIO_BASE_URL}/${fileName}`;
      logger.info({ file: fileName, bytes: buffer.length }, 'Audio saved');

      return { audioPath, audioUrl };
    } catch (err) {
      logger.error({ err, model: env.TTS_MODEL, voice: env.TTS_VOICE }, 'TTS request failed');
      throw new ExternalServiceError(
        'openai',
        'Failed to synthesize speech',
        err instanceof Error ? err.message : undefined,
      );
    }
  }
}