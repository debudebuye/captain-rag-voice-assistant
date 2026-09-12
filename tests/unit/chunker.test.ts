import { describe, expect, it } from 'vitest';
import { chunkDocuments, estimateTokens } from '../../src/modules/rag/chunker';
import type { KBDocument } from '../../src/modules/rag/loader';

const doc: KBDocument = {
  name: 'test.md',
  content: [
    '## Section One',
    '',
    'First paragraph has about thirty words of content.',
    'It continues with more words to reach a reasonable paragraph length here.',
    '',
    'Second paragraph is short.',
    '',
    '## Section Two',
    '',
    'Third paragraph with a complete, factual sentence that is long enough.',
  ].join('\n'),
};

describe('estimateTokens', () => {
  it('approximates tokens as characters / 4', () => {
    expect(estimateTokens('1234')).toBe(1);
    expect(estimateTokens('12345678')).toBe(2);
  });
});

describe('chunkDocuments', () => {
  it('returns no chunks for empty documents', () => {
    const chunks = chunkDocuments([{ name: 'a.md', content: '   \n\n  ' }], {
      chunkSize: 500,
      chunkOverlap: 50,
    });
    expect(chunks).toHaveLength(0);
  });

  it('assigns stable ids and document names', () => {
    const chunks = chunkDocuments([doc], { chunkSize: 500, chunkOverlap: 50 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].document).toBe('test.md');
    expect(chunks[0].id).toBe('test.md-0');
  });

  it('respects chunkSize upper bound', () => {
    const bigDoc: KBDocument = {
      name: 'big.md',
      content: Array.from({ length: 200 }, (_, i) => `Sentence number ${i} in this document.`).join(' '),
    };
    const chunks = chunkDocuments([bigDoc], { chunkSize: 100, chunkOverlap: 10 });
    for (const chunk of chunks) {
      expect(estimateTokens(chunk.content)).toBeLessThanOrEqual(120);
    }
  });

  it('splits a single oversized paragraph on sentence boundaries', () => {
    const singleParagraph: KBDocument = {
      name: 'large.md',
      content:
        'First sentence of a very long paragraph that keeps going. ' +
        'Second sentence with almost the same length again. ' +
        'Third sentence adding more text. ' +
        'Fourth and final sentence of the long passage.',
    };
    const chunks = chunkDocuments([singleParagraph], { chunkSize: 20, chunkOverlap: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(estimateTokens(chunk.content)).toBeLessThanOrEqual(30);
    }
  });

  it('carries an overlap of trailing content into the next chunk', () => {
    const dotted: KBDocument = {
      name: 'overlap.md',
      content: Array.from({ length: 60 }, (_, i) => `Paragraph number ${i}.`).join('\n\n'),
    };
    const chunks = chunkDocuments([dotted], { chunkSize: 60, chunkOverlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1].content;
      const next = chunks[i].content;
      const shared = next
        .split('. ')
        .map((s) => s.trim())
        .filter((s, idx, arr) => idx < arr.length - 1)
        .find((s) => prev.includes(s));
      expect(shared).toBeDefined();
    }
  });

  it('validates options', () => {
    expect(() => chunkDocuments([doc], { chunkSize: 0, chunkOverlap: 0 })).toThrow();
    expect(() =>
      chunkDocuments([doc], { chunkSize: 100, chunkOverlap: 100 }),
    ).toThrow();
  });
});