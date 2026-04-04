import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateCoachAnalysisMock = vi.fn();
const buildLocalWorkspaceAnalysisMock = vi.fn();
const incrementRateLimitMock = vi.fn();
const createDailyWindowKeyMock = vi.fn(() => '2026-04-05');
const createSnapshotFromUploadsMock = vi.fn();
const resolveWorkspaceByTokenMock = vi.fn();
const getRequestOriginMock = vi.fn();

vi.mock('@/lib/server/ai', () => ({
  generateCoachAnalysis: generateCoachAnalysisMock
}));

vi.mock('@/lib/ga4/insights', () => ({
  buildLocalWorkspaceAnalysis: buildLocalWorkspaceAnalysisMock
}));

vi.mock('@/lib/server/rate-limit', () => ({
  incrementRateLimit: incrementRateLimitMock,
  createDailyWindowKey: createDailyWindowKeyMock
}));

vi.mock('@/lib/server/workspaces', () => ({
  createSnapshotFromUploads: createSnapshotFromUploadsMock,
  resolveWorkspaceByToken: resolveWorkspaceByTokenMock
}));

vi.mock('@/lib/server/http', () => ({
  getRequestOrigin: getRequestOriginMock,
  jsonError: (message: string, status = 400) =>
    Response.json(
      {
        ok: false,
        error: message
      },
      { status }
    )
}));

const sampleDataset = {
  fileName: 'traffic.csv',
  reportName: 'トラフィック獲得',
  account: 'demo',
  property: 'demo-property',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  headers: ['チャネル', 'セッション'],
  rows: [],
  type: 'acquisition',
  primaryDimension: 'チャネル',
  primaryMetric: {
    id: 'sessions',
    label: 'セッション'
  },
  avgEngagementRate: 0.54,
  keyEventsTotal: 14,
  revenueTotal: 0,
  numericTotals: {
    セッション: {
      total: 120,
      average: 60,
      min: 40,
      max: 80
    }
  },
  topRows: [
    {
      label: 'Organic Search',
      primaryValue: 80,
      share: 0.66,
      engagementRate: 0.61,
      keyEvents: 10
    }
  ],
  chart: {
    labels: ['Organic Search'],
    primaryLabel: 'セッション',
    primaryValues: [80],
    engagementValues: [0.61]
  }
} as const;

const sampleAnswers = {
  focus: 'overview',
  businessType: 'lead',
  experience: 'beginner',
  concern: 'まず改善点を知りたい'
} as const;

const sampleLocalAnalysis = {
  workspaceSummary: {
    cards: [],
    caption: 'summary'
  },
  quantitativeFindings: [],
  reportGuidance: [],
  localCoach: {
    overview: 'local overview',
    findings: [],
    reportGuidance: [],
    nextQuestions: [],
    nextActions: [],
    dataQuality: []
  }
};

describe('POST /api/workspaces/[token]/snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveWorkspaceByTokenMock.mockResolvedValue({ id: 'ws_123' });
    getRequestOriginMock.mockResolvedValue('https://ga4.example.com');
    buildLocalWorkspaceAnalysisMock.mockReturnValue(sampleLocalAnalysis);
  });

  it('returns 429 when the workspace AI rate limit is exceeded', async () => {
    incrementRateLimitMock.mockResolvedValue({ limited: true });

    const { POST } = await import('@/app/api/workspaces/[token]/snapshots/route');
    const response = await POST(
      new Request('https://ga4.example.com/api/workspaces/secret/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: sampleAnswers,
          datasets: [sampleDataset],
          uploadedBlobs: [
            {
              url: 'https://blob.example.com/ga4/traffic.csv',
              pathname: 'ga4/traffic.csv',
              originalName: 'traffic.csv',
              size: 1024,
              contentType: 'text/csv'
            }
          ]
        })
      }),
      { params: Promise.resolve({ token: 'secret-token' }) }
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'このワークスペースでのAI解析回数が上限に達しました。'
    });
    expect(createSnapshotFromUploadsMock).not.toHaveBeenCalled();
  });

  it('stores the snapshot and keeps aiAnalysis null when local fallback is used', async () => {
    incrementRateLimitMock.mockResolvedValue({ limited: false });
    generateCoachAnalysisMock.mockResolvedValue({
      mode: 'local',
      analysis: sampleLocalAnalysis.localCoach,
      warning: 'fallback'
    });
    createSnapshotFromUploadsMock.mockResolvedValue({
      workspace: {
        id: 'ws_123',
        shareUrl: '/w/secret-token',
        createdAt: '2026-04-05T00:00:00.000Z',
        expiresAt: '2026-05-05T00:00:00.000Z',
        lastAccessedAt: null
      },
      snapshots: [],
      notes: []
    });

    const { POST } = await import('@/app/api/workspaces/[token]/snapshots/route');
    const response = await POST(
      new Request('https://ga4.example.com/api/workspaces/secret/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: sampleAnswers,
          datasets: [sampleDataset],
          uploadedBlobs: [
            {
              url: 'https://blob.example.com/ga4/traffic.csv',
              pathname: 'ga4/traffic.csv',
              originalName: 'traffic.csv',
              size: 1024,
              contentType: 'text/csv'
            }
          ]
        })
      }),
      { params: Promise.resolve({ token: 'secret-token' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      mode: 'local',
      warning: 'fallback',
      workspace: {
        workspace: {
          shareUrl: 'https://ga4.example.com/w/secret-token'
        }
      }
    });

    expect(createSnapshotFromUploadsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceToken: 'secret-token',
        answers: sampleAnswers,
        datasets: [sampleDataset],
        localAnalysis: sampleLocalAnalysis,
        aiAnalysis: null
      })
    );
  });
});
