import type { RagOrchestrator } from '../rag';
import type { LlmClient } from '../llm/generator';
import { formatContext } from '../llm/prompt';
import type { Translator } from '../translation/translator';
import type { TtsClient } from '../tts/synthesizer';
import type { PipelineResult, SourceReference } from '../../shared/types';
import { logger } from '../../shared/logger';
import { env } from '../../config/env';

export interface PipelineDependencies {
  rag: RagOrchestrator;
  llm: LlmClient;
  translator: Translator;
  tts: TtsClient;
}

export interface PipelineInput {
  query: string;
  targetLanguage: string;
}

const measure = <T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> => {
  const start = performance.now();
  return fn().then((result) => ({ result, elapsedMs: Math.round(performance.now() - start) }));
};

export async function runPipeline(
  deps: PipelineDependencies,
  input: PipelineInput,
): Promise<PipelineResult> {
  const { query, targetLanguage } = input;
  const pipelineStart = performance.now();

  const { result: retrieved, elapsedMs: retrievalTimeMs } = await measure(() =>
    deps.rag.retrieve(query),
  );

  const sources: SourceReference[] = retrieved.map(({ chunk, score }) => ({
    document: chunk.document,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content.slice(0, 400),
    similarity: Number(score.toFixed(4)),
  }));

  const context = formatContext(
    retrieved.map(({ chunk }) => ({ document: chunk.document, content: chunk.content })),
  );

  const { result: generated, elapsedMs: generationTimeMs } = await measure(() =>
    deps.llm.generateGroundedAnswer(query, context),
  );

  const { result: translated, elapsedMs: translationTimeMs } = await measure(() =>
    deps.translator.translate(generated.text, targetLanguage),
  );

  const { result: tts, elapsedMs: ttsTimeMs } = await measure(() =>
    deps.tts.synthesize(translated),
  );

  const totalLatencyMs = Math.round(performance.now() - pipelineStart);

  logger.info(
    {
      query,
      targetLanguage,
      chunkCount: retrieved.length,
      retrievalTimeMs,
      generationTimeMs,
      translationTimeMs,
      ttsTimeMs,
      totalLatencyMs,
      usedContext: generated.usedContext,
      audioUrl: tts.audioUrl,
    },
    'Pipeline completed',
  );

  return {
    query,
    targetLanguage,
    retrievedChunks: sources,
    generatedResponse: generated.text,
    translatedResponse: translated,
    audioUrl: tts.audioUrl,
    audioPath: tts.audioPath,
    sources,
    metadata: {
      latencyMs: totalLatencyMs,
      models: {
        embedding: env.EMBEDDING_MODEL,
        llm: env.LLM_MODEL,
        translation: env.TRANSLATION_MODEL,
        tts: env.TTS_MODEL,
        voice: env.TTS_VOICE,
      },
      chunkCount: retrieved.length,
      retrievalTimeMs,
      generationTimeMs,
      translationTimeMs,
      ttsTimeMs,
    },
  };
}