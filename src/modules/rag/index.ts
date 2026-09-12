import type { DocumentChunk, RetrievalResult } from '../../shared/types';
import { chunkDocuments, type ChunkerOptions } from './chunker';
import { loadDocuments } from './loader';
import {
  clearChunks,
  countChunks,
  ensureIndexed,
  initSchema,
  insertChunks,
  searchChunks,
} from './vectorStore';
import type { EmbeddingsClient } from './embeddings';
import { logger } from '../../shared/logger';
import { env } from '../../config/env';

export interface IndexResult {
  documents: number;
  chunks: number;
}

export interface RagOrchestrator {
  indexKnowledgeBase(): Promise<IndexResult>;
  retrieve(query: string, topK?: number): Promise<RetrievalResult[]>;
  isIndexed(): Promise<boolean>;
}

export interface RagDependencies {
  embeddings: EmbeddingsClient;
  chunkerOptions?: ChunkerOptions;
}

export function createRagOrchestrator(deps: RagDependencies): RagOrchestrator {
  const chunkerOptions: ChunkerOptions = deps.chunkerOptions ?? {
    chunkSize: env.CHUNK_SIZE,
    chunkOverlap: env.CHUNK_OVERLAP,
  };

  return {
    async indexKnowledgeBase(): Promise<IndexResult> {
      const documents = loadDocuments();
      const chunks = chunkDocuments(documents, chunkerOptions);

      await initSchema();
      await clearChunks();

      const embeddings = await deps.embeddings.embed(chunks.map((c) => c.content));
      const withEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      await insertChunks(withEmbeddings);

      logger.info(
        { documents: documents.length, chunks: chunks.length },
        'Knowledge base indexed',
      );
      return { documents: documents.length, chunks: chunks.length };
    },

    async retrieve(query: string, topK?: number): Promise<RetrievalResult[]> {
      await ensureIndexed();
      const queryEmbedding = await deps.embeddings.embedSingle(query);
      return searchChunks(queryEmbedding, { topK });
    },

    async isIndexed(): Promise<boolean> {
      return (await countChunks()) > 0;
    },
  };
}

export type { DocumentChunk };