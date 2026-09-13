import { createRagOrchestrator } from '../rag';
import { CloudflareEmbeddings } from '../rag/embeddings';
import { GroqLlm } from '../llm/generator';
import { GroqTranslator } from '../translation/translator';
import { EdgeTts } from '../tts/synthesizer';
import type { PipelineDependencies } from './pipeline';

export function buildPipelineDependencies(): PipelineDependencies {
  const embeddings = new CloudflareEmbeddings();
  const rag = createRagOrchestrator({ embeddings });

  return {
    rag,
    llm: new GroqLlm(),
    translator: new GroqTranslator(),
    tts: new EdgeTts(),
  };
}