import { NextResponse } from 'next/server';
import { createWorkspaceSchema } from '@/lib/ga4/schemas';
import { getClientIpFromHeaders, getRequestOrigin, jsonError } from '@/lib/server/http';
import { coerceClientIp, makeShareUrl } from '@/lib/server/security';
import { createWorkspace } from '@/lib/server/workspaces';

export async function POST(request: Request) {
  try {
    const payload = createWorkspaceSchema.parse(await request.json());
    const origin = await getRequestOrigin();
    const clientIp = coerceClientIp(await getClientIpFromHeaders());
    const workspace = await createWorkspace({ ipAddress: clientIp });

    return NextResponse.json({
      ok: true,
      workspace: {
        id: workspace.id,
        token: workspace.token,
        shareUrl: makeShareUrl(origin, workspace.token),
        expiresAt: workspace.expiresAt,
        answers: payload.answers
      }
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
