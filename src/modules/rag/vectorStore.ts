import { pool } from '../../shared/db';
import type { DocumentChunk, RetrievalResult } from '../../shared/types';
import { env } from '../../config/env';
import { KnowledgeBaseNotFoundError } from '../../shared/errors';

const TABLE = 'chunks';

export interface VectorStoreOptions {
  dimensions: number;
  topK: number;
  similarityThreshold: number;
}

const defaultOptions = (): VectorStoreOptions => ({
  dimensions: env.VECTOR_DIMENSIONS,
  topK: env.TOP_K,
  similarityThreshold: env.SIMILARITY_THRESHOLD,
});

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      document TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${env.VECTOR_DIMENSIONS}) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS chunks_embedding_idx
      ON ${TABLE} USING hnsw (embedding vector_cosine_ops);
  `);
}

export async function countChunks(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${TABLE}`);
  return result.rows[0].count as number;
}

export async function clearChunks(): Promise<void> {
  await pool.query(`TRUNCATE ${TABLE}`);
}

export async function insertChunks(
  chunks: Array<DocumentChunk & { embedding: number[] }>,
): Promise<void> {
  const values: unknown[] = [];
  const placeholders = chunks
    .map((chunk, i) => {
      const offset = i * 5;
      values.push(chunk.id, chunk.document, chunk.chunkIndex, chunk.content);
      values.push(`[${chunk.embedding.join(',')}]`);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::vector)`;
    })
    .join(', ');

  await pool.query(
    `INSERT INTO ${TABLE} (id, document, chunk_index, content, embedding) VALUES ${placeholders}`,
    values,
  );
}

export async function searchChunks(
  queryEmbedding: number[],
  options: Partial<VectorStoreOptions> = {},
): Promise<RetrievalResult[]> {
  const { topK, similarityThreshold } = { ...defaultOptions(), ...options };
  const vector = `[${queryEmbedding.join(',')}]`;

  const result = await pool.query(
    `
    SELECT id, document, chunk_index, content, 1 - (embedding <=> $1) AS similarity
    FROM ${TABLE}
    WHERE 1 - (embedding <=> $1) >= $2
    ORDER BY embedding <=> $1
    LIMIT $3
    `,
    [vector, similarityThreshold, topK],
  );

  return result.rows.map((row) => ({
    chunk: {
      id: row.id as string,
      document: row.document as string,
      chunkIndex: row.chunk_index as number,
      content: row.content as string,
    },
    score: Number(row.similarity),
  }));
}

export async function ensureIndexed(): Promise<void> {
  const count = await countChunks();
  if (count === 0) {
    throw new KnowledgeBaseNotFoundError();
  }
}