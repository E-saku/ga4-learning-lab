import { NextResponse } from 'next/server';
import { noteMutationSchema } from '@/lib/ga4/schemas';
import { jsonError } from '@/lib/server/http';
import { saveWorkspaceNote } from '@/lib/server/workspaces';

type NotesRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: Request, { params }: NotesRouteProps) {
  try {
    const { token } = await params;
    const payload = noteMutationSchema.parse(await request.json());
    const note = await saveWorkspaceNote({
      workspaceToken: token,
      noteId: payload.id,
      snapshotId: payload.snapshotId ?? null,
      body: payload.body
    });

    return NextResponse.json({
      ok: true,
      note
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
