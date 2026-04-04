import { NextResponse } from 'next/server';
import { getRequestOrigin, jsonError } from '@/lib/server/http';
import { getWorkspaceView } from '@/lib/server/workspaces';

type WorkspaceRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_: Request, { params }: WorkspaceRouteProps) {
  try {
    const { token } = await params;
    const origin = await getRequestOrigin();
    const workspace = await getWorkspaceView(token, origin);

    if (!workspace) {
      return jsonError('ワークスペースが見つからないか、有効期限が切れています。', 404);
    }

    return NextResponse.json({
      ok: true,
      workspace
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
