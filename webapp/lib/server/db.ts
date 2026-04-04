import { neon } from '@neondatabase/serverless';
import { assertPersistenceConfigured, getServerEnv } from '@/lib/server/env';

let schemaPromise: Promise<void> | null = null;

function getSql() {
  assertPersistenceConfigured();
  const env = getServerEnv();
  return neon(env.POSTGRES_URL!);
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = createSchema();
  }
  await schemaPromise;
}

export async function queryDb<T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const sql = getSql();
  await ensureSchema();
  const rows = await sql(strings, ...values);
  return rows as T[];
}

async function createSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id text PRIMARY KEY,
      token_hash text NOT NULL UNIQUE,
      access_mode text NOT NULL,
      owner_user_id text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      last_accessed_at timestamptz NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      answers_json jsonb NOT NULL,
      local_analysis_json jsonb NOT NULL,
      ai_analysis_json jsonb NULL,
      comparison_json jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS snapshot_files (
      id text PRIMARY KEY,
      snapshot_id text NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      blob_path text NOT NULL,
      original_name text NOT NULL,
      report_name text NOT NULL,
      file_size_bytes integer NOT NULL,
      summary_json jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS workspace_notes (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      snapshot_id text NULL REFERENCES snapshots(id) ON DELETE SET NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS pending_uploads (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      blob_path text NOT NULL UNIQUE,
      original_name text NOT NULL,
      file_size_bytes integer NOT NULL,
      content_type text NOT NULL,
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      consumed_at timestamptz NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limit_counters (
      scope text NOT NULL,
      identifier text NOT NULL,
      window_key text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (scope, identifier, window_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS snapshots_workspace_id_idx ON snapshots(workspace_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS workspace_notes_workspace_id_idx ON workspace_notes(workspace_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS snapshot_files_snapshot_id_idx ON snapshot_files(snapshot_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pending_uploads_workspace_id_idx ON pending_uploads(workspace_id, uploaded_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS workspaces_expires_at_idx ON workspaces(expires_at)`;
}
