import { CloudflareEmbeddings } from '../src/modules/rag/embeddings';
import { createRagOrchestrator } from '../src/modules/rag';
import { logger } from '../src/shared/logger';

async function seed(): Promise<void> {
  const embeddings = new CloudflareEmbeddings();
  const rag = createRagOrchestrator({ embeddings });

  logger.info('Starting knowledge base seeding...');
  const result = await rag.indexKnowledgeBase();

  logger.info(
    { documents: result.documents, chunks: result.chunks },
    'Seeding complete',
  );
}

seed().catch((err) => {
  logger.fatal(err, 'Seeding failed');
  process.exit(1);
});