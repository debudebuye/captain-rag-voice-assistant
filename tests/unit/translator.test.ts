import { describe, expect, it, vi } from 'vitest';
import { GroqTranslator } from '../../src/modules/translation/translator';
import { ExternalServiceError } from '../../src/shared/errors';

function fakeClient() {
  return {
    chat: { completions: { create: vi.fn() } },
  } as never;
}

describe('GroqTranslator', () => {
  it('returns the translated text from the model', async () => {
    const client = fakeClient();
    const translator = new GroqTranslator(client as never);
    vi.mocked(client.chat.completions.create).mockResolvedValue({
      choices: [{ message: { content: 'እሳት ነው' } }],
    } as never);

    const result = await translator.translate('It is a fire', 'am');
    expect(result).toBe('እሳት ነው');
  });

  it('throws when the translation is empty', async () => {
    const client = fakeClient();
    const translator = new GroqTranslator(client as never);
    vi.mocked(client.chat.completions.create).mockResolvedValue({
      choices: [{ message: { content: '' } }],
    } as never);

    await expect(translator.translate('Text', 'am')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('wraps API failures in ExternalServiceError', async () => {
    const client = fakeClient();
    const translator = new GroqTranslator(client as never);
    vi.mocked(client.chat.completions.create).mockRejectedValue(new Error('bad') as never);

    await expect(translator.translate('Text', 'am')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});