import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { checkDatabaseConnection, pool } from '../../src/shared/db';
import { loadDocuments } from '../../src/modules/rag/loader';
import { chunkDocuments } from '../../src/modules/rag/chunker';
import {
  clearChunks,
  countChunks,
  initSchema,
  insertChunks,
  searchChunks,
} from '../../src/modules/rag/vectorStore';

const DIM = 1024;

/**
 * Deterministic character-3-gram embedding with stopword filtering. Shared
 * sub-word structure maps to shared dimensions, so cosine similarity reflects
 * lexical relatedness closely enough to exercise the real pgvector pipeline
 * without an API key.
 */
const STOPWORDS = new Set([
  'and', 'the', 'for', 'are', 'all', 'not', 'from', 'that', 'this', 'with',
  'must', 'shall', 'every', 'when', 'vessel', 'ship', 'crews', 'crew', 'person',
  'people', 'into', 'should', 'what', 'a', 'an', 'is', 'in', 'on', 'of', 'to',
  'at', 'be', 'by', 'or', 'as', 'it', 'its', 'can', 'has', 'have', 'may', 'use',
  'using', 'used', 'being', 'will', 'was', 'main', 'also', 'after', 'before',
]);

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function fakeEmbedding(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const words = text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [];
  const seen = new Set<number>();

  for (const word of words) {
    if (STOPWORDS.has(word) || word.length < 4) continue;
    for (let i = 0; i <= word.length - 3; i++) {
      const gram = word.slice(i, i + 3);
      const idx = hash(gram + '#') % DIM;
      if (!seen.has(idx)) {
        vec[idx] += 1;
        seen.add(idx);
      }
    }
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseConnection();
  if (!dbAvailable) return;
  await initSchema();
  await clearChunks();

  const docs = loadDocuments();
  const chunks = chunkDocuments(docs, { chunkSize: 500, chunkOverlap: 50 });
  await insertChunks(chunks.map((c, i) => ({ ...c, embedding: fakeEmbedding(c.content) })));
});

afterAll(async () => {
  if (dbAvailable) {
    await clearChunks();
  }
  await pool.end();
});

describe('RAG integration (needs Docker db)', () => {
  it('indexes documents then retrieves them', async () => {
    if (!dbAvailable) return;
    expect(await countChunks()).toBeGreaterThan(0);
  });

  it('finds the fire procedure for an engine-room fire query', async () => {
    if (!dbAvailable) return;
    const query = 'What should I do if there is a fire in the engine room?';
    const results = await searchChunks(fakeEmbedding(query), {
      topK: 5,
      similarityThreshold: 0.02,
    });
    expect(results.length).toBeGreaterThan(0);
    const topDocuments = results.slice(0, 3).map((r) => r.chunk.document);
    expect(topDocuments).toContain('fire-procedure.md');
  });

  it('finds the man-overboard procedure for a man overboard query', async () => {
    if (!dbAvailable) return;
    const query = 'A crew member has fallen into the sea, what do we do?';
    const results = await searchChunks(fakeEmbedding(query), {
      topK: 5,
      similarityThreshold: 0.02,
    });
    expect(results.length).toBeGreaterThan(0);
    const topDocuments = results.slice(0, 3).map((r) => r.chunk.document);
    expect(topDocuments).toContain('man-overboard.md');
  });

  it('ranks results by similarity (descending scores)', async () => {
    if (!dbAvailable) return;
    const query = 'communication distress channel VHF mayday';
    const results = await searchChunks(fakeEmbedding(query), { topK: 5, similarityThreshold: 0.02 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });
});