import { describe, expect, it, vi } from 'vitest';
import { OpenAiLlm } from '../../src/modules/llm/generator';
import { buildSystemPrompt, formatContext, buildUserPrompt } from '../../src/modules/llm/prompt';
import { ExternalServiceError } from '../../src/shared/errors';

function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    ...overrides,
  } as never;
}

function respondWith(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

describe('prompts', () => {
  it('buildSystemPrompt enforces grounding rules and mentions safety fallback', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Answer ONLY using the factual knowledge');
    expect(prompt).toContain('does NOT contain enough information');
    expect(prompt).toContain('Never invent');
  });

  it('buildUserPrompt embeds the query and a context block', () => {
    const prompt = buildUserPrompt('What is VHF 16 for?', 'VHF 16 is the distress channel.');
    expect(prompt).toContain('What is VHF 16 for?');
    expect(prompt).toContain('<context>');
    expect(prompt).toContain('VHF 16 is the distress channel.');
  });

  it('formatContext numbers and labels sources', () => {
    const formatted = formatContext([
      { document: 'a.md', content: 'first chunk' },
      { document: 'b.md', content: 'second chunk' },
    ]);
    expect(formatted).toContain('[1] Source: a.md');
    expect(formatted).toContain('[2] Source: b.md');
    expect(formatted).toContain('second chunk');
  });
});

describe('OpenAiLlm', () => {
  it('detects a grounded answer and returns usedContext=true', async () => {
    const client = fakeClient();
    const llm = new OpenAiLlm(client as never);
    vi.mocked(client.chat.completions.create).mockResolvedValue(respondWith('Sound the alarm.') as never);

    const result = await llm.generateGroundedAnswer('Fire?', 'Fire procedure context.');
    expect(result.text).toBe('Sound the alarm.');
    expect(result.usedContext).toBe(true);
  });

  it('detects the no-info fallback and returns usedContext=false', async () => {
    const client = fakeClient();
    const llm = new OpenAiLlm(client as never);
    const fallback = 'I do not have enough information in the knowledge base to answer that question.';
    vi.mocked(client.chat.completions.create).mockResolvedValue(respondWith(fallback) as never);

    const result = await llm.generateGroundedAnswer('Weather on Mars?', '<empty>');
    expect(result.usedContext).toBe(false);
    expect(result.text).toBe(fallback);
  });

  it('throws ExternalServiceError when the API call fails', async () => {
    const client = fakeClient();
    const llm = new OpenAiLlm(client as never);
    vi.mocked(client.chat.completions.create).mockRejectedValue(new Error('boom') as never);

    await expect(llm.generateGroundedAnswer('Q', 'C')).rejects.toBeInstanceOf(ExternalServiceError);
  });
});