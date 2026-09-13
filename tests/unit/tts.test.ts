import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EdgeTts, resolveVoice, sanitizeFileName, type TtsRunner } from '../../src/modules/tts/synthesizer';
import { ExternalServiceError } from '../../src/shared/errors';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tts-test-'));
}

function runnerThatWrites(bytes: number): TtsRunner {
  return async (_command, args) => {
    const mp3 = args[args.indexOf('--write-media') + 1];
    fs.writeFileSync(mp3, Buffer.alloc(bytes));
  };
}

describe('sanitizeFileName', () => {
  it('lowercases and strips special characters', () => {
    expect(sanitizeFileName('Fire Drill #1!')).toBe('fire-drill-1');
  });
});

describe('resolveVoice', () => {
  it('maps each supported language to a native male voice', () => {
    expect(resolveVoice('am')).toBe('am-ET-AmehaNeural');
    expect(resolveVoice('en')).toBe('en-US-ChristopherNeural');
    expect(resolveVoice('fr')).toBe('fr-FR-HenriNeural');
    expect(resolveVoice('es')).toBe('es-ES-AlvaroNeural');
    expect(resolveVoice('sw')).toBe('sw-KE-RafikiNeural');
    expect(resolveVoice('de')).toBe('de-DE-ConradNeural');
  });
});

describe('EdgeTts', () => {
  it('writes an mp3 file and returns relative url and absolute path', async () => {
    const dir = tempDir();
    const tts = new EdgeTts({ audioDir: dir, runner: runnerThatWrites(8) });

    const result = await tts.synthesize('The alarm is sounding');
    expect(fs.existsSync(result.audioPath)).toBe(true);
    expect(fs.statSync(result.audioPath).size).toBe(8);
    expect(result.audioUrl).toMatch(/^\/audio\/.*\.mp3$/);
    expect(result.audioPath.startsWith(dir)).toBe(true);
  });

  it('passes text via --file to avoid shell escaping', async () => {
    const dir = tempDir();
    const readInput = { content: '' };
    const spy = vi.fn<TtsRunner>((_command, args) => {
      const inputFile = args[args.indexOf('--file') + 1];
      readInput.content = fs.readFileSync(inputFile, 'utf8');
      const mp3 = args[args.indexOf('--write-media') + 1];
      fs.writeFileSync(mp3, Buffer.alloc(8));
    });
    const tts = new EdgeTts({ audioDir: dir, runner: spy });

    await tts.synthesize('እሳት ነው! "quotes"', 'am');
    const args = spy.mock.calls[0][1];
    expect(args).toContain('--voice');
    expect(args[args.indexOf('--voice') + 1]).toBe('am-ET-AmehaNeural');
    expect(args).toContain('--file');
    expect(readInput.content).toBe('እሳት ነው! "quotes"');
    expect(args).toContain('--write-media');
  });

  it('selects a native voice for the requested language', async () => {
    const dir = tempDir();
    const spy = vi.fn<TtsRunner>((_command, args) => {
      const mp3 = args[args.indexOf('--write-media') + 1];
      fs.writeFileSync(mp3, Buffer.alloc(8));
    });
    const tts = new EdgeTts({ audioDir: dir, runner: spy });

    await tts.synthesize('Hello', 'en');
    const args = spy.mock.calls[0][1];
    expect(args[args.indexOf('--voice') + 1]).toBe('en-US-ChristopherNeural');
  });

  it('cleans up the temp input file after synthesis', async () => {
    const dir = tempDir();
    const tts = new EdgeTts({ audioDir: dir, runner: runnerThatWrites(8) });

    await tts.synthesize('Hello');
    const leftovers = fs.readdirSync(dir).filter((f) => f.startsWith('.tts-input-'));
    expect(leftovers).toHaveLength(0);
  });

  it('throws when the audio file is empty', async () => {
    const dir = tempDir();
    const tts = new EdgeTts({ audioDir: dir, runner: runnerThatWrites(0) });

    await expect(tts.synthesize('Nothing')).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('wraps runner failures in ExternalServiceError', async () => {
    const dir = tempDir();
    const failing: TtsRunner = async () => {
      throw new Error('edge-tts down');
    };
    const tts = new EdgeTts({ audioDir: dir, runner: failing });

    await expect(tts.synthesize('Hi')).rejects.toBeInstanceOf(ExternalServiceError);
  });
});