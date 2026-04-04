import { NextResponse } from 'next/server';
import { analyzeRequestSchema } from '@/lib/ga4/schemas';
import { buildLocalWorkspaceAnalysis } from '@/lib/ga4/insights';
import { generateCoachAnalysis } from '@/lib/server/ai';
import { incrementRateLimit, createDailyWindowKey } from '@/lib/server/rate-limit';
import { resolveWorkspaceByToken } from '@/lib/server/workspaces';
import { jsonError } from '@/lib/server/http';

export async function POST(request: Request) {
  try {
    const payload = analyzeRequestSchema.parse(await request.json());
    const localAnalysis = buildLocalWorkspaceAnalysis(payload.datasets, payload.answers);

    if (payload.workspaceToken) {
      const workspace = await resolveWorkspaceByToken(payload.workspaceToken);
      if (!workspace) {
        return jsonError('ワークスペースが見つからないか、有効期限が切れています。', 404);
      }

      const rateLimit = await incrementRateLimit({
        scope: 'workspace-ai',
        identifier: workspace.id,
        windowKey: createDailyWindowKey(),
        limit: 10
      });

      if (rateLimit.limited) {
        return jsonError('このワークスペースでのAI解析回数が上限に達しました。', 429);
      }
    }

    const result = await generateCoachAnalysis(payload.datasets, payload.answers);
    return NextResponse.json({
      ok: true,
      mode: result.mode,
      analysis: {
        localAnalysis,
        coachAnalysis: result.analysis
      },
      warning: result.warning
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
