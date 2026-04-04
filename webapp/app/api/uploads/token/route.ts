import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { resolveWorkspaceByToken, recordPendingUpload } from '@/lib/server/workspaces';
import type { PendingUploadPayload } from '@/lib/ga4/types';

const ALLOWED_CONTENT_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/csv',
  'text/plain'
];

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) {
          throw new Error('workspaceToken が必要です。');
        }

        const payload = JSON.parse(clientPayload) as PendingUploadPayload & { workspaceToken?: string };
        if (!payload.workspaceToken) {
          throw new Error('workspaceToken が必要です。');
        }

        const workspace = await resolveWorkspaceByToken(payload.workspaceToken);
        if (!workspace) {
          throw new Error('有効なワークスペースではありません。');
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            workspaceId: workspace.id,
            originalName: payload.originalName,
            size: payload.size,
            contentType: payload.contentType
          })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          throw new Error('tokenPayload が不足しています。');
        }
        const payload = JSON.parse(tokenPayload) as PendingUploadPayload;
        await recordPendingUpload({
          workspaceId: payload.workspaceId,
          blobPath: blob.url,
          originalName: payload.originalName,
          fileSizeBytes: payload.size,
          contentType: payload.contentType
        });
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
