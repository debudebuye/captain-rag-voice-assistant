import { describe, expect, it, vi } from 'vitest';
import { runPipeline } from '../../src/modules/assistant/pipeline';
import type { PipelineDependencies } from '../../src/modules/assistant/pipeline';

function buildDeps(): PipelineDependencies {
  return {
    rag: {
      retrieve: vi.fn().mockResolvedValue([
        {
          chunk: {
            id: 'fire-procedure.md-0',
            document: 'fire-procedure.md',
            chunkIndex: 0,
            content: 'CO2 system and engine room fire.',
          },
          score: 0.91,
        },
      ]),
      indexKnowledgeBase: vi.fn(),
      isIndexed: vi.fn(),
    },
    llm: {
      generateGroundedAnswer: vi
        .fn()
        .mockResolvedValue({ text: 'Enter the engine room procedures now.', usedContext: true }),
    },
    translator: {
      translate: vi.fn().mockResolvedValue('ወደ ሞተር ክፍል አካሄድ ይግቡ።'),
    },
    tts: {
      synthesize: vi
        .fn()
        .mockResolvedValue({ audioPath: '/audio/x.mp3', audioUrl: '/audio/x.mp3' }),
    },
  } as unknown as PipelineDependencies;
}

describe('runPipeline', () => {
  it('returns a complete pipeline trace with sources and latency', async () => {
    const deps = buildDeps();
    const result = await runPipeline(deps, { query: 'Engine room fire?', targetLanguage: 'am' });

    expect(result.query).toBe('Engine room fire?');
    expect(result.targetLanguage).toBe('am');
    expect(result.generatedResponse).toContain('engine room');
    expect(result.translatedResponse).toContain('ሞተር');
    expect(result.audioUrl).toBe('/audio/x.mp3');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].document).toBe('fire-procedure.md');
    expect(result.sources[0].similarity).toBeCloseTo(0.91);
    expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.retrievalTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.generationTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.translationTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.ttsTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.chunkCount).toBe(1);

    expect(deps.rag.retrieve).toHaveBeenCalledTimes(1);
    expect(deps.llm.generateGroundedAnswer).toHaveBeenCalledTimes(1);
    expect(deps.translator.translate).toHaveBeenCalledWith(expect.any(String), 'am');
    expect(deps.tts.synthesize).toHaveBeenCalledTimes(1);
  });

  it('propagates empty retrieval as empty sources without crashing', async () => {
    const deps = buildDeps();
    deps.rag.retrieve = vi.fn().mockResolvedValue([]);
    const result = await runPipeline(deps, { query: 'Unknown topic', targetLanguage: 'am' });
    expect(result.retrievedChunks).toHaveLength(0);
    expect(result.metadata.chunkCount).toBe(0);
  });
});