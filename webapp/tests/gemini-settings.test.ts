import { describe, expect, it } from 'vitest';
import {
  decryptGeminiSettings,
  encryptGeminiSettings,
  resolveGeminiModel
} from '@/lib/server/gemini-settings';

describe('gemini settings encryption', () => {
  it('round-trips the encrypted Gemini cookie payload', () => {
    const secret = 'workspace-secret';
    const encrypted = encryptGeminiSettings(
      {
        apiKey: 'AIzaSyExampleSecretKey',
        model: 'gemini-2.5-flash'
      },
      secret
    );

    const decrypted = decryptGeminiSettings(encrypted, secret);

    expect(decrypted).toEqual({
      apiKey: 'AIzaSyExampleSecretKey',
      model: 'gemini-2.5-flash'
    });
  });

  it('returns null when the wrong secret is used', () => {
    const encrypted = encryptGeminiSettings(
      {
        apiKey: 'AIzaSyExampleSecretKey',
        model: 'gemini-2.5-flash'
      },
      'secret-a'
    );

    expect(decryptGeminiSettings(encrypted, 'secret-b')).toBeNull();
  });

  it('falls back to the default model when an invalid model is requested', () => {
    expect(resolveGeminiModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(resolveGeminiModel('unknown-model')).toBe('gemini-2.5-flash');
  });
});
