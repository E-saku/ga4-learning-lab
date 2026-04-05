import { NextResponse } from 'next/server';
import { generateCoachAnalysis } from '@/lib/server/ai';
import { finalizeSnapshotSchema } from '@/lib/ga4/schemas';
import { buildLocalWorkspaceAnalysis } from '@/lib/ga4/insights';
import { getRuntimeAiSettings } from '@/lib/server/gemini-settings';
import { getRequestOrigin, jsonError } from '@/lib/server/http';
import { incrementRateLimit, createDailyWindowKey } from '@/lib/server/rate-limit';
import { createSnapshotFromUploads, resolveWorkspaceByToken } from '@/lib/server/workspaces';

type SnapshotRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: Request, { params }: SnapshotRouteProps) {
  try {
    const { token } = await params;
    const payload = finalizeSnapshotSchema.parse(await request.json());
    const origin = await getRequestOrigin();
    const workspace = await resolveWorkspaceByToken(token);
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

    const localAnalysis = buildLocalWorkspaceAnalysis(payload.datasets, payload.answers);
    const aiSettings = await getRuntimeAiSettings();
    const aiResult = await generateCoachAnalysis(payload.datasets, payload.answers, aiSettings);
    const workspaceView = await createSnapshotFromUploads({
      workspaceToken: token,
      answers: payload.answers,
      datasets: payload.datasets,
      uploadedBlobs: payload.uploadedBlobs,
      localAnalysis,
      aiAnalysis: aiResult.mode === 'ai' ? aiResult.analysis : null
    });

    if (!workspaceView) {
      return jsonError('ワークスペースの保存に失敗しました。', 500);
    }

    return NextResponse.json({
      ok: true,
      workspace: {
        ...workspaceView,
        workspace: {
          ...workspaceView.workspace,
          shareUrl: workspaceView.workspace.shareUrl.startsWith('http')
            ? workspaceView.workspace.shareUrl
            : `${origin}${workspaceView.workspace.shareUrl}`
        }
      },
      mode: aiResult.mode,
      warning: aiResult.warning
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
