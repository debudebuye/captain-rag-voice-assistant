import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../../config/env';
import { ExternalServiceError } from '../../shared/errors';
import { logger } from '../../shared/logger';

const execFileAsync = promisify(execFile);

export interface TtsResult {
  audioPath: string;
  audioUrl: string;
}

export interface TtsClient {
  synthesize(text: string, language?: string): Promise<TtsResult>;
}

const VOICE_BY_LANGUAGE: Record<string, string> = {
  am: 'am-ET-AmehaNeural',
  en: 'en-US-ChristopherNeural',
  fr: 'fr-FR-HenriNeural',
  es: 'es-ES-AlvaroNeural',
  sw: 'sw-KE-RafikiNeural',
  de: 'de-DE-ConradNeural',
};

export function resolveVoice(language: string): string {
  return VOICE_BY_LANGUAGE[language] ?? env.TTS_VOICE;
}

export type TtsRunner = (command: string, args: string[]) => Promise<void>;

async function resolveCommand(command: string): Promise<string> {
  try {
    await execFileAsync(command, ['--version']);
    return command;
  } catch {
    const fallback = path.join(os.homedir(), '.local', 'bin', command);
    if (fs.existsSync(fallback)) {
      return fallback;
    }
    return command;
  }
}

const defaultRunner: TtsRunner = async (command, args) => {
  await execFileAsync(await resolveCommand(command), args);
};

export function sanitizeFileName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export class EdgeTts implements TtsClient {
  private readonly audioDir: string;
  private readonly voice: string | undefined;
  private readonly command: string;
  private readonly runner: TtsRunner;

  constructor(
    options: { audioDir?: string; voice?: string; command?: string; runner?: TtsRunner } = {},
  ) {
    this.audioDir = options.audioDir ?? env.AUDIO_DIR;
    this.voice = options.voice;
    this.command = options.command ?? 'edge-tts';
    this.runner = options.runner ?? defaultRunner;
  }

  async synthesize(text: string, language = 'am'): Promise<TtsResult> {
    const voice = this.voice ?? resolveVoice(language);
    const inputPath = path.join(this.audioDir, `.tts-input-${randomUUID()}.txt`);
    const fileName = `${sanitizeFileName(text) || 'answer'}-${randomUUID().slice(0, 8)}.mp3`;
    const audioPath = path.join(this.audioDir, fileName);

    try {
      fs.mkdirSync(this.audioDir, { recursive: true });
      fs.writeFileSync(inputPath, text, 'utf8');

      await this.runner(this.command, [
        '--voice',
        voice,
        '--file',
        inputPath,
        '--write-media',
        audioPath,
      ]);

      const { size } = fs.statSync(audioPath);
      if (size === 0) {
        throw new ExternalServiceError(
          'edge-tts',
          'TTS produced an empty audio file',
        );
      }

      const audioUrl = `${env.AUDIO_BASE_URL}/${fileName}`;
      logger.info({ file: fileName, bytes: size, voice, language }, 'Audio saved');

      return { audioPath, audioUrl };
    } catch (err) {
      logger.error({ err, voice }, 'TTS request failed');
      throw err instanceof ExternalServiceError
        ? err
        : new ExternalServiceError(
            'edge-tts',
            'Failed to synthesize speech',
            err instanceof Error ? err.message : undefined,
          );
    } finally {
      fs.rmSync(inputPath, { force: true });
    }
  }
}