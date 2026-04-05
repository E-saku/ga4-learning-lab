import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveGeminiSettingsToCookieMock = vi.fn();
const clearGeminiSettingsCookieMock = vi.fn();
const getServerEnvMock = vi.fn();

vi.mock('@/lib/server/gemini-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/gemini-settings')>(
    '@/lib/server/gemini-settings'
  );

  return {
    ...actual,
    saveGeminiSettingsToCookie: saveGeminiSettingsToCookieMock,
    clearGeminiSettingsCookie: clearGeminiSettingsCookieMock
  };
});

vi.mock('@/lib/server/env', () => ({
  getServerEnv: getServerEnvMock
}));

describe('/api/settings/gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvMock.mockReturnValue({
      GEMINI_API_KEY: undefined,
      GEMINI_MODEL: 'gemini-2.5-flash'
    });
  });

  it('rejects cross-site POST requests', async () => {
    const { POST } = await import('@/app/api/settings/gemini/route');
    const response = await POST(
      new Request('https://ga4.example.com/api/settings/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://evil.example.com'
        },
        body: JSON.stringify({
          apiKey: 'AIzaSyExampleSecretKey',
          model: 'gemini-2.5-flash'
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Cross-site request was rejected.'
    });
    expect(saveGeminiSettingsToCookieMock).not.toHaveBeenCalled();
  });

  it('rejects non-allowlisted model ids', async () => {
    const { POST } = await import('@/app/api/settings/gemini/route');
    const response = await POST(
      new Request('https://ga4.example.com/api/settings/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://ga4.example.com'
        },
        body: JSON.stringify({
          apiKey: 'AIzaSyExampleSecretKey',
          model: 'gemini-malicious'
        })
      })
    );

    expect(response.status).toBe(400);
    expect(saveGeminiSettingsToCookieMock).not.toHaveBeenCalled();
  });
});
