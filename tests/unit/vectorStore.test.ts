import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as db from '../../src/shared/db';

vi.mock('../../src/shared/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { initSchema, insertChunks, searchChunks, clearChunks } from '../../src/modules/rag/vectorStore';
import type { DocumentChunk } from '../../src/shared/types';

const mockPool = db.pool as unknown as { query: ReturnType<typeof vi.fn> };

describe('vectorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initSchema runs CREATE EXTENSION and CREATE TABLE', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await initSchema();
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS chunks');
    expect(sql).toContain('embedding vector(1536)');
    expect(sql).toContain('hnsw (embedding vector_cosine_ops)');
  });

  it('insertChunks formats vector literals and batch inserts', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const chunks: Array<DocumentChunk & { embedding: number[] }> = [
      { id: 'a-0', document: 'a.md', chunkIndex: 0, content: 'hello', embedding: [1, 2, 3] },
      { id: 'a-1', document: 'a.md', chunkIndex: 1, content: 'world', embedding: [4, 5, 6] },
    ];
    await insertChunks(chunks);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO chunks');
    expect(sql).toContain('($1, $2, $3, $4, $5::vector), ($6, $7, $8, $9, $10::vector)');
    expect(params).toContain('hello');
    expect(params).toContain('[1,2,3]');
  });

  it('searchChunks orders by vector distance and applies threshold', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ id: 'x', document: 'x.md', chunk_index: 0, content: 'result', similarity: 0.82 }],
    });
    const results = await searchChunks([1, 0, 0]);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY embedding <=>');
    expect(sql).toContain('1 - (embedding <=> $1) >= $2');
    expect(params[0]).toBe('[1,0,0]');
    expect(params[1]).toBe(0.35);
    expect(params[2]).toBe(5);
    expect(results[0].chunk.content).toBe('result');
    expect(results[0].score).toBeCloseTo(0.82);
  });

  it('clearChunks issues TRUNCATE', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await clearChunks();
    expect(mockPool.query).toHaveBeenCalledWith('TRUNCATE chunks');
  });
});