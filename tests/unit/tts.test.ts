import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAiTts, sanitizeFileName } from '../../src/modules/tts/synthesizer';
import { ExternalServiceError } from '../../src/shared/errors';

function fakeClient() {
  return {
    audio: { speech: { create: vi.fn() } },
  } as never;
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tts-test-'));
}

describe('sanitizeFileName', () => {
  it('lowercases and strips special characters', () => {
    expect(sanitizeFileName('Fire Drill #1!')).toBe('fire-drill-1');
  });
});

describe('OpenAiTts', () => {
  it('writes an mp3 file and returns relative url and absolute path', async () => {
    const dir = tempDir();
    const client = fakeClient();
    const tts = new OpenAiTts(client as never, { audioDir: dir });
    vi.mocked(client.audio.speech.create).mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    } as never);

    const result = await tts.synthesize('The alarm is sounding');
    expect(fs.existsSync(result.audioPath)).toBe(true);
    expect(result.audioUrl).toMatch(/^\/audio\/.*\.mp3$/);
    expect(result.audioPath.startsWith(dir)).toBe(true);
  });

  it('throws when the audio file is empty', async () => {
    const dir = tempDir();
    const client = fakeClient();
    const tts = new OpenAiTts(client as never, { audioDir: dir });
    vi.mocked(client.audio.speech.create).mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(0),
    } as never);

    await expect(tts.synthesize('Nothing')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('wraps API failures in ExternalServiceError', async () => {
    const dir = tempDir();
    const client = fakeClient();
    const tts = new OpenAiTts(client as never, { audioDir: dir });
    vi.mocked(client.audio.speech.create).mockRejectedValue(new Error('tts down') as never);

    await expect(tts.synthesize('Hi')).rejects.toBeInstanceOf(ExternalServiceError);
  });
});