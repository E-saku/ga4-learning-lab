import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWorkspaceMock = vi.fn();
const getRequestOriginMock = vi.fn();
const getClientIpFromHeadersMock = vi.fn();
const coerceClientIpMock = vi.fn((value: string) => value);
const makeShareUrlMock = vi.fn((origin: string, token: string) => `${origin}/w/${token}`);

vi.mock('@/lib/server/workspaces', () => ({
  createWorkspace: createWorkspaceMock
}));

vi.mock('@/lib/server/http', () => ({
  getRequestOrigin: getRequestOriginMock,
  getClientIpFromHeaders: getClientIpFromHeadersMock,
  jsonError: (message: string, status = 400) =>
    Response.json(
      {
        ok: false,
        error: message
      },
      { status }
    )
}));

vi.mock('@/lib/server/security', () => ({
  coerceClientIp: coerceClientIpMock,
  makeShareUrl: makeShareUrlMock
}));

describe('POST /api/workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestOriginMock.mockResolvedValue('https://ga4.example.com');
    getClientIpFromHeadersMock.mockResolvedValue('203.0.113.7');
    createWorkspaceMock.mockResolvedValue({
      id: 'ws_123',
      token: 'secret-token',
      expiresAt: '2026-05-05T00:00:00.000Z'
    });
  });

  it('creates a workspace and returns a share url', async () => {
    const { POST } = await import('@/app/api/workspaces/route');
    const response = await POST(
      new Request('https://ga4.example.com/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: {
            focus: 'overview',
            businessType: 'lead',
            experience: 'beginner',
            concern: 'まず全体像を見たい'
          }
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      workspace: {
        id: 'ws_123',
        token: 'secret-token',
        shareUrl: 'https://ga4.example.com/w/secret-token'
      }
    });

    expect(createWorkspaceMock).toHaveBeenCalledWith({
      ipAddress: '203.0.113.7'
    });
  });
});
