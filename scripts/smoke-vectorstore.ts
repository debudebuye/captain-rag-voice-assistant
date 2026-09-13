import { initSchema, countChunks, clearChunks, insertChunks, searchChunks } from '../src/modules/rag/vectorStore';
import { loadDocuments } from '../src/modules/rag/loader';
import { chunkDocuments } from '../src/modules/rag/chunker';
import { logger } from '../src/shared/logger';

async function main(): Promise<void> {
  await initSchema();
  await clearChunks();

  const docs = loadDocuments();
  const chunks = chunkDocuments(docs, { chunkSize: 500, chunkOverlap: 50 });
  logger.info({ docs: docs.length, chunks: chunks.length }, 'chunked');

  const zeroVec = (padding: number): number[] => new Array(1024).fill(0).map(() => Math.random());
  await insertChunks(chunks.map((c, i) => ({ ...c, embedding: zeroVec(i) })));

  logger.info({ count: await countChunks() }, 'inserted');

  const top = await searchChunks(zeroVec(999), { topK: 3 });
  logger.info({ top: top.length, scores: top.map((t) => t.score.toFixed(4)) }, 'searched');

  await clearChunks();
  logger.info('cleaned up - test data removed');
}

main().catch((err) => {
  logger.error(err, 'vector store smoke test failed');
  process.exit(1);
});