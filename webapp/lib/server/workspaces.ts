import { setTimeout as sleep } from 'node:timers/promises';
import { del } from '@vercel/blob';
import type {
  DatasetSummary,
  LocalCoachAnalysis,
  LocalWorkspaceAnalysis,
  SnapshotComparison,
  UploadedBlobInput,
  UserAnswers,
  WorkspaceView
} from '@/lib/ga4/types';
import { buildSnapshotComparison } from '@/lib/ga4/comparison';
import { buildLocalWorkspaceAnalysis } from '@/lib/ga4/insights';
import { assertPersistenceConfigured } from '@/lib/server/env';
import { incrementRateLimit, createHourlyWindowKey } from '@/lib/server/rate-limit';
import {
  createId,
  createWorkspaceExpiryDate,
  createWorkspaceToken,
  hashWorkspaceToken,
  makeShareUrl
} from '@/lib/server/security';
import { getServerEnv } from '@/lib/server/env';
import { queryDb } from '@/lib/server/db';

type WorkspaceRow = {
  id: string;
  token_hash: string;
  access_mode: string;
  owner_user_id: string | null;
  created_at: string;
  expires_at: string;
  last_accessed_at: string | null;
};

type SnapshotRow = {
  id: string;
  workspace_id: string;
  answers_json: UserAnswers;
  local_analysis_json: LocalWorkspaceAnalysis;
  ai_analysis_json: LocalCoachAnalysis | null;
  comparison_json: SnapshotComparison | null;
  created_at: string;
};

type SnapshotFileRow = {
  id: string;
  snapshot_id: string;
  blob_path: string;
  original_name: string;
  report_name: string;
  file_size_bytes: number;
  summary_json: DatasetSummary;
  created_at: string;
};

type WorkspaceNoteRow = {
  id: string;
  workspace_id: string;
  snapshot_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

type PendingUploadRow = {
  id: string;
  workspace_id: string;
  blob_path: string;
  original_name: string;
  file_size_bytes: number;
  content_type: string;
  uploaded_at: string;
  consumed_at: string | null;
};

export async function createWorkspace({
  ipAddress
}: {
  ipAddress: string;
}) {
  assertPersistenceConfigured();
  const hourlyLimit = await incrementRateLimit({
    scope: 'workspace-create',
    identifier: ipAddress,
    windowKey: createHourlyWindowKey(),
    limit: 3
  });

  if (hourlyLimit.limited) {
    throw new Error('このIPからのワークスペース作成回数が上限に達しました。1時間ほど空けて再度お試しください。');
  }

  const env = getServerEnv();
  const token = createWorkspaceToken();
  const tokenHash = hashWorkspaceToken(token, env.WORKSPACE_TOKEN_SECRET!);
  const workspaceId = createId('ws');
  const expiresAt = createWorkspaceExpiryDate();

  await queryDb`
    INSERT INTO workspaces (id, token_hash, access_mode, owner_user_id, expires_at)
    VALUES (${workspaceId}, ${tokenHash}, ${'shared-link'}, ${null}, ${expiresAt.toISOString()})
  `;

  return {
    id: workspaceId,
    token,
    expiresAt: expiresAt.toISOString()
  };
}

export async function resolveWorkspaceByToken(token: string) {
  assertPersistenceConfigured();
  const env = getServerEnv();
  const tokenHash = hashWorkspaceToken(token, env.WORKSPACE_TOKEN_SECRET!);
  const [workspace] = await queryDb<WorkspaceRow>`
    SELECT *
    FROM workspaces
    WHERE token_hash = ${tokenHash}
      AND expires_at > now()
    LIMIT 1
  `;

  return workspace ?? null;
}

export async function touchWorkspaceAccess(workspaceId: string) {
  await queryDb`
    UPDATE workspaces
    SET last_accessed_at = now()
    WHERE id = ${workspaceId}
  `;
}

export async function recordPendingUpload(input: {
  workspaceId: string;
  blobPath: string;
  originalName: string;
  fileSizeBytes: number;
  contentType: string;
}) {
  await queryDb`
    INSERT INTO pending_uploads (id, workspace_id, blob_path, original_name, file_size_bytes, content_type)
    VALUES (
      ${createId('upl')},
      ${input.workspaceId},
      ${input.blobPath},
      ${input.originalName},
      ${input.fileSizeBytes},
      ${input.contentType}
    )
    ON CONFLICT (blob_path)
    DO NOTHING
  `;
}

export async function createSnapshotFromUploads(input: {
  workspaceToken: string;
  answers: UserAnswers;
  datasets: DatasetSummary[];
  uploadedBlobs: UploadedBlobInput[];
  aiAnalysis: LocalCoachAnalysis | null;
  localAnalysis: LocalWorkspaceAnalysis;
}) {
  const workspace = await resolveWorkspaceByToken(input.workspaceToken);
  if (!workspace) {
    throw new Error('ワークスペースが見つからないか、有効期限が切れています。');
  }

  let pendingUploads = await waitForPendingUploads(workspace.id, input.uploadedBlobs);
  if (pendingUploads.length !== input.uploadedBlobs.length && process.env.NODE_ENV !== 'production') {
    for (const blob of input.uploadedBlobs) {
      await recordPendingUpload({
        workspaceId: workspace.id,
        blobPath: blob.url,
        originalName: blob.originalName,
        fileSizeBytes: blob.size,
        contentType: blob.contentType
      });
    }
    pendingUploads = await waitForPendingUploads(workspace.id, input.uploadedBlobs);
  }

  if (pendingUploads.length !== input.uploadedBlobs.length) {
    throw new Error('アップロード済みファイルの照合に失敗しました。再度アップロードしてください。');
  }

  const previousSnapshot = await getLatestSnapshot(workspace.id);
  const currentSnapshotId = createId('snp');
  const comparison = buildSnapshotComparison(
    currentSnapshotId,
    input.datasets,
    previousSnapshot?.id ?? null,
    previousSnapshot?.datasets ?? []
  );

  await queryDb`
    INSERT INTO snapshots (id, workspace_id, answers_json, local_analysis_json, ai_analysis_json, comparison_json)
    VALUES (
      ${currentSnapshotId},
      ${workspace.id},
      ${JSON.stringify(input.answers)}::jsonb,
      ${JSON.stringify(input.localAnalysis)}::jsonb,
      ${input.aiAnalysis ? JSON.stringify(input.aiAnalysis) : null}::jsonb,
      ${comparison ? JSON.stringify(comparison) : null}::jsonb
    )
  `;

  const uploadIndex = new Map(pendingUploads.map((upload) => [upload.blob_path, upload]));

  for (let index = 0; index < input.uploadedBlobs.length; index += 1) {
    const requestedBlob = input.uploadedBlobs[index];
    const upload = uploadIndex.get(requestedBlob.url);
    if (!upload) {
      throw new Error('アップロード済みファイルの照合に失敗しました。');
    }

    const summary = sanitizeDatasetSummary(input.datasets[index]);
    await queryDb`
      INSERT INTO snapshot_files (id, snapshot_id, blob_path, original_name, report_name, file_size_bytes, summary_json)
      VALUES (
        ${createId('spf')},
        ${currentSnapshotId},
        ${upload.blob_path},
        ${upload.original_name},
        ${summary.reportName},
        ${upload.file_size_bytes},
        ${JSON.stringify(summary)}::jsonb
      )
    `;

    await queryDb`
      UPDATE pending_uploads
      SET consumed_at = now()
      WHERE id = ${upload.id}
    `;
  }

  return getWorkspaceView(input.workspaceToken, '');
}

export async function getWorkspaceView(token: string, origin: string): Promise<WorkspaceView | null> {
  const workspace = await resolveWorkspaceByToken(token);
  if (!workspace) return null;

  await touchWorkspaceAccess(workspace.id);

  const snapshots = await queryDb<SnapshotRow>`
    SELECT *
    FROM snapshots
    WHERE workspace_id = ${workspace.id}
    ORDER BY created_at DESC
  `;

  const snapshotFiles = await queryDb<SnapshotFileRow>`
    SELECT *
    FROM snapshot_files
    WHERE snapshot_id IN (
      SELECT id
      FROM snapshots
      WHERE workspace_id = ${workspace.id}
    )
    ORDER BY created_at DESC
  `;

  const notes = await queryDb<WorkspaceNoteRow>`
    SELECT *
    FROM workspace_notes
    WHERE workspace_id = ${workspace.id}
    ORDER BY updated_at DESC
  `;

  return {
    workspace: {
      id: workspace.id,
      shareUrl: origin ? makeShareUrl(origin, token) : `/w/${token}`,
      createdAt: workspace.created_at,
      expiresAt: workspace.expires_at,
      lastAccessedAt: workspace.last_accessed_at
    },
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      createdAt: snapshot.created_at,
      answers: snapshot.answers_json,
      localAnalysis: snapshot.local_analysis_json,
      aiAnalysis: snapshot.ai_analysis_json,
      comparison: snapshot.comparison_json,
      files: snapshotFiles
        .filter((file) => file.snapshot_id === snapshot.id)
        .map((file) => ({
          id: file.id,
          blobPath: file.blob_path,
          originalName: file.original_name,
          reportName: file.report_name,
          fileSizeBytes: file.file_size_bytes,
          summary: file.summary_json
        }))
    })),
    notes: notes.map((note) => ({
      id: note.id,
      snapshotId: note.snapshot_id,
      body: note.body,
      createdAt: note.created_at,
      updatedAt: note.updated_at
    }))
  };
}

export async function saveWorkspaceNote(input: {
  workspaceToken: string;
  noteId?: string;
  snapshotId?: string | null;
  body: string;
}) {
  const workspace = await resolveWorkspaceByToken(input.workspaceToken);
  if (!workspace) {
    throw new Error('ワークスペースが見つからないか、有効期限が切れています。');
  }

  if (input.snapshotId) {
    const [snapshot] = await queryDb<{ id: string }>`
      SELECT id
      FROM snapshots
      WHERE id = ${input.snapshotId}
        AND workspace_id = ${workspace.id}
      LIMIT 1
    `;

    if (!snapshot) {
      throw new Error('指定したスナップショットはこのワークスペースに存在しません。');
    }
  }

  const noteId = input.noteId ?? createId('note');
  if (input.noteId) {
    await queryDb`
      UPDATE workspace_notes
      SET body = ${input.body},
          snapshot_id = ${input.snapshotId ?? null},
          updated_at = now()
      WHERE id = ${input.noteId}
        AND workspace_id = ${workspace.id}
    `;
  } else {
    await queryDb`
      INSERT INTO workspace_notes (id, workspace_id, snapshot_id, body)
      VALUES (${noteId}, ${workspace.id}, ${input.snapshotId ?? null}, ${input.body})
    `;
  }

  const [note] = await queryDb<WorkspaceNoteRow>`
    SELECT *
    FROM workspace_notes
    WHERE id = ${noteId}
    LIMIT 1
  `;

  return note;
}

export async function cleanupExpiredWorkspaces() {
  assertPersistenceConfigured();
  const expiredWorkspaces = await queryDb<{ id: string }>`
    SELECT id
    FROM workspaces
    WHERE expires_at <= now()
  `;

  if (!expiredWorkspaces.length) {
    await queryDb`
      DELETE FROM rate_limit_counters
      WHERE updated_at < now() - interval '7 days'
    `;

    return {
      deletedWorkspaces: 0,
      deletedBlobs: 0
    };
  }

  const workspaceIds = expiredWorkspaces.map((workspace) => workspace.id);
  const blobs = await queryDb<{ blob_path: string }>`
    SELECT blob_path
    FROM snapshot_files
    WHERE snapshot_id IN (
      SELECT id
      FROM snapshots
      WHERE workspace_id = ANY(${workspaceIds})
    )
    UNION
    SELECT blob_path
    FROM pending_uploads
    WHERE workspace_id = ANY(${workspaceIds})
  `;

  if (blobs.length) {
    await del(blobs.map((blob) => blob.blob_path));
  }

  await queryDb`
    DELETE FROM workspaces
    WHERE id = ANY(${workspaceIds})
  `;

  await queryDb`
    DELETE FROM rate_limit_counters
    WHERE updated_at < now() - interval '7 days'
  `;

  return {
    deletedWorkspaces: workspaceIds.length,
    deletedBlobs: blobs.length
  };
}

async function getPendingUploadsForWorkspace(workspaceId: string, uploadedBlobs: UploadedBlobInput[]) {
  const urls = uploadedBlobs.map((blob) => blob.url);
  if (!urls.length) return [];

  return queryDb<PendingUploadRow>`
    SELECT *
    FROM pending_uploads
    WHERE workspace_id = ${workspaceId}
      AND consumed_at IS NULL
      AND blob_path = ANY(${urls})
    ORDER BY uploaded_at ASC
  `;
}

async function waitForPendingUploads(workspaceId: string, uploadedBlobs: UploadedBlobInput[]) {
  let attempts = 0;
  let pendingUploads = await getPendingUploadsForWorkspace(workspaceId, uploadedBlobs);

  while (pendingUploads.length !== uploadedBlobs.length && attempts < 8) {
    attempts += 1;
    await sleep(250);
    pendingUploads = await getPendingUploadsForWorkspace(workspaceId, uploadedBlobs);
  }

  return pendingUploads;
}

async function getLatestSnapshot(workspaceId: string): Promise<{
  id: string;
  datasets: DatasetSummary[];
} | null> {
  const [snapshot] = await queryDb<SnapshotRow>`
    SELECT *
    FROM snapshots
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!snapshot) return null;

  const files = await queryDb<SnapshotFileRow>`
    SELECT *
    FROM snapshot_files
    WHERE snapshot_id = ${snapshot.id}
    ORDER BY created_at ASC
  `;

  return {
    id: snapshot.id,
    datasets: files.map((file) => file.summary_json)
  };
}

function sanitizeDatasetSummary(dataset: DatasetSummary): DatasetSummary {
  return {
    ...dataset,
    rows: []
  };
}
