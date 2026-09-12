import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env';
import { KnowledgeBaseNotFoundError } from '../../shared/errors';

export interface KBDocument {
  name: string;
  content: string;
}

export interface LoaderOptions {
  dir?: string;
}

export function loadDocuments(options: LoaderOptions = {}): KBDocument[] {
  const dir = options.dir ?? env.KNOWLEDGE_BASE_DIR;

  if (!fs.existsSync(dir)) {
    throw new KnowledgeBaseNotFoundError(
      `Knowledge base directory "${dir}" does not exist.`,
    );
  }

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort();

  const documents = files.map((file) => {
    const fullPath = path.join(dir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    return { name: file, content };
  });

  if (documents.length === 0) {
    throw new KnowledgeBaseNotFoundError(
      `No markdown documents found in "${dir}".`,
    );
  }

  return documents;
}