import { createRagOrchestrator } from '../rag';
import { OpenAiEmbeddings } from '../rag/embeddings';
import { OpenAiLlm } from '../llm/generator';
import { OpenAiTranslator } from '../translation/translator';
import { OpenAiTts } from '../tts/synthesizer';
import type { PipelineDependencies } from './pipeline';

export function buildPipelineDependencies(): PipelineDependencies {
  const embeddings = new OpenAiEmbeddings();
  const rag = createRagOrchestrator({ embeddings });

  return {
    rag,
    llm: new OpenAiLlm(),
    translator: new OpenAiTranslator(),
    tts: new OpenAiTts(),
  };
}