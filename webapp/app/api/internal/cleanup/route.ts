import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/server/env';
import { cleanupExpiredWorkspaces } from '@/lib/server/workspaces';
import { jsonError } from '@/lib/server/http';

export async function GET(request: Request) {
  try {
    const env = getServerEnv();
    if (env.CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
        return jsonError('Unauthorized', 401);
      }
    }

    const result = await cleanupExpiredWorkspaces();
    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
