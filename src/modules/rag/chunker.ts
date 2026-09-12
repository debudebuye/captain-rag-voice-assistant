import type { KBDocument } from './loader';
import type { DocumentChunk } from '../../shared/types';

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
}

/**
 * Token estimate: ~4 characters per token is a standard approximation for
 * English prose. In production, swap this for a real tokenizer
 * (e.g. tiktoken) matched to the embedding/LLM model.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Splits a single very large paragraph into sentence-sized pieces, then
 * greedily groups them back into chunks of at most chunkSize tokens.
 */
function splitLargeParagraph(paragraph: string, options: ChunkerOptions): string[] {
  const sentences = splitIntoSentences(paragraph);
  const pieces: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const tokenCount = estimateTokens(sentence);
    if (currentTokens + tokenCount > options.chunkSize && current.length > 0) {
      pieces.push(current.join(' '));
      current = [];
      currentTokens = 0;
    }
    current.push(sentence);
    currentTokens += tokenCount;
  }
  if (current.length > 0) {
    pieces.push(current.join(' '));
  }
  return pieces;
}

/**
 * Paragraph-aware chunker.
 *
 * Documents are split on blank lines (paragraph boundaries). Consecutive
 * paragraphs are greedily merged until chunkSize tokens. When a chunk is full,
 * the trailing paragraphs that fit within chunkOverlap are carried into the
 * next chunk so that context is preserved across boundaries.
 *
 * Paragraphs that alone exceed chunkSize are split on sentence boundaries.
 */
export function chunkDocuments(documents: KBDocument[], options: ChunkerOptions): DocumentChunk[] {
  const { chunkSize, chunkOverlap } = options;

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than zero');
  }
  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be between 0 and chunkSize');
  }

  const chunks: DocumentChunk[] = [];

  for (const document of documents) {
    const paragraphs = document.content
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0);

    let current: string[] = [];
    let currentTokens = 0;
    let chunkIndex = 0;

    const flush = (): void => {
      if (current.length === 0) return;
      chunks.push({
        id: `${document.name}-${chunkIndex}`,
        document: document.name,
        chunkIndex,
        content: current.join(' '),
      });
      chunkIndex++;
    };

    const pushParagraph = (paragraph: string): void => {
      const tokenCount = estimateTokens(paragraph);

      if (tokenCount > chunkSize) {
        flush();
        for (const piece of splitLargeParagraph(paragraph, options)) {
          chunks.push({
            id: `${document.name}-${chunkIndex}`,
            document: document.name,
            chunkIndex,
            content: piece,
          });
          chunkIndex++;
        }
        current = [];
        currentTokens = 0;
        return;
      }

      if (currentTokens + tokenCount > chunkSize && current.length > 0) {
        flush();

        // Carry trailing paragraphs forward as overlap context.
        const carry: string[] = [];
        let carryTokens = 0;
        for (let i = current.length - 1; i >= 0; i--) {
          const t = estimateTokens(current[i]);
          if (carryTokens + t > chunkOverlap) break;
          carry.unshift(current[i]);
          carryTokens += t;
        }
        current = carry;
        currentTokens = carryTokens;
      }

      current.push(paragraph);
      currentTokens += tokenCount;
    };

    for (const paragraph of paragraphs) {
      pushParagraph(paragraph);
    }
    flush();
  }

  return chunks;
}