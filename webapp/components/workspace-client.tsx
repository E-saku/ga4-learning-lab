'use client';

import { upload } from '@vercel/blob/client';
import { startTransition, useState } from 'react';
import { AnalysisView } from '@/components/analysis-view';
import { GeminiSettingsCard } from '@/components/gemini-settings-card';
import { buildLocalWorkspaceAnalysis } from '@/lib/ga4/insights';
import { parseGA4CSV } from '@/lib/ga4/parser';
import type { AiStatus, DatasetSummary, UserAnswers, WorkspaceView } from '@/lib/ga4/types';

type WorkspaceClientProps = {
  initialView: WorkspaceView;
  workspaceToken: string;
  initialAiStatus: AiStatus;
};

const DEFAULT_ANSWERS: UserAnswers = {
  focus: 'overview',
  businessType: 'lead',
  experience: 'beginner',
  concern: ''
};

export function WorkspaceClient({ initialView, workspaceToken, initialAiStatus }: WorkspaceClientProps) {
  const [view, setView] = useState(initialView);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(initialView.snapshots[0]?.id ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [draftDatasets, setDraftDatasets] = useState<DatasetSummary[]>([]);
  const [draftAnswers, setDraftAnswers] = useState<UserAnswers>(initialView.snapshots[0]?.answers ?? DEFAULT_ANSWERS);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const selectedSnapshot = view.snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? view.snapshots[0] ?? null;
  const draftAnalysis = draftDatasets.length ? buildLocalWorkspaceAnalysis(draftDatasets, draftAnswers) : null;

  async function handleDraftFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    setDraftError(null);
    setDraftMessage(null);

    if (!nextFiles.length) {
      setDraftDatasets([]);
      return;
    }

    if (nextFiles.length > 5) {
      setDraftError('1回のスナップショットで扱える CSV は最大 5 件です。');
      return;
    }

    try {
      const parsed = await Promise.all(
        nextFiles.map(async (file) => {
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`${file.name} は 10MB を超えています。`);
          }
          const text = await file.text();
          return parseGA4CSV(text, file.name);
        })
      );

      startTransition(() => {
        setDraftDatasets(parsed);
      });
    } catch (error) {
      setDraftDatasets([]);
      setDraftError((error as Error).message);
    }
  }

  async function handleSaveSnapshot() {
    if (!draftDatasets.length || !files.length) {
      setDraftError('先に CSV を読み込んでください。');
      return;
    }

    setIsSavingSnapshot(true);
    setDraftError(null);
    setDraftMessage(null);

    try {
      const uploadedBlobs = await Promise.all(
        files.map((file) =>
          upload(`ga4/${file.name}`, file, {
            access: 'private',
            handleUploadUrl: '/api/uploads/token',
            clientPayload: JSON.stringify({
              workspaceToken,
              originalName: file.name,
              size: file.size,
              contentType: file.type || 'text/csv'
            })
          })
        )
      );

      const response = await fetch(`/api/workspaces/${workspaceToken}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: draftAnswers,
          datasets: draftDatasets.map(stripRows),
          uploadedBlobs: uploadedBlobs.map((blob, index) => ({
            url: blob.url,
            pathname: blob.pathname,
            originalName: files[index]?.name ?? blob.pathname,
            size: files[index]?.size ?? 0,
            contentType: files[index]?.type || 'text/csv'
          }))
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'スナップショット保存に失敗しました。');
      }

      setView(data.workspace);
      setSelectedSnapshotId(data.workspace.snapshots[0]?.id ?? null);
      setFiles([]);
      setDraftDatasets([]);
      setDraftMessage('新しいスナップショットを保存しました。');
    } catch (error) {
      setDraftError((error as Error).message);
    } finally {
      setIsSavingSnapshot(false);
    }
  }

  async function handleSaveNote() {
    if (!noteBody.trim()) {
      setDraftError('メモを入力してください。');
      return;
    }

    setIsSavingNote(true);
    setDraftError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceToken}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingNoteId ?? undefined,
          snapshotId: editingSnapshotId,
          body: noteBody
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'メモ保存に失敗しました。');
      }

      const workspaceResponse = await fetch(`/api/workspaces/${workspaceToken}`);
      const workspaceData = await workspaceResponse.json();
      if (!workspaceResponse.ok || !workspaceData.ok) {
        throw new Error(workspaceData.error || 'ワークスペース再取得に失敗しました。');
      }

      setView(workspaceData.workspace);
      setNoteBody('');
      setEditingNoteId(null);
      setEditingSnapshotId(null);
      setDraftMessage('メモを保存しました。');
    } catch (error) {
      setDraftError((error as Error).message);
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <>
      <header className="shell-header">
        <div>
          <p className="hero-kicker">Private Workspace</p>
          <h1 className="hero-title">限定リンクの GA4 ワークスペース</h1>
          <p className="hero-copy">
            このリンクを知っている人は、このワークスペースのスナップショット追加とメモ編集ができます。
          </p>
        </div>

        <aside className="status-card">
          <span className="status-dot online" />
          <div>
            <strong>共有リンク</strong>
            <p className="status-copy" style={{ overflowWrap: 'anywhere' }}>
              {view.workspace.shareUrl}
            </p>
          </div>
        </aside>
      </header>

      <main>
        <section className="workspace-shell">
          <aside className="stack-18 sidebar-sticky">
            <section className="glass-panel">
              <p className="section-kicker">Workspace</p>
              <h2 className="panel-title">保存情報</h2>
              <p className="panel-description">作成日時: {formatDate(view.workspace.createdAt)}</p>
              <p className="panel-description">有効期限: {formatDate(view.workspace.expiresAt)}</p>
            </section>

            <GeminiSettingsCard initialStatus={initialAiStatus} />

            <section className="glass-panel">
              <p className="section-kicker">Snapshots</p>
              <h2 className="panel-title">履歴</h2>
              <div className="snapshot-list" style={{ marginTop: 14 }}>
                {view.snapshots.map((snapshot) => (
                  <button
                    className="snapshot-row"
                    key={snapshot.id}
                    onClick={() => {
                      setSelectedSnapshotId(snapshot.id);
                      setDraftAnswers(snapshot.answers);
                    }}
                    type="button"
                  >
                    <div style={{ textAlign: 'left' }}>
                      <strong>{formatDate(snapshot.createdAt)}</strong>
                      <div className="snapshot-meta">{snapshot.files.map((file) => file.reportName).join(' / ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel">
              <p className="section-kicker">Add Snapshot</p>
              <h2 className="panel-title">新しい CSV を追加</h2>
              <label className="dropzone" htmlFor="workspace-upload">
                <strong>追加する CSV を選択</strong>
                <span className="muted">比較したい最新の CSV を 5 件まで追加できます</span>
              </label>
              <input
                id="workspace-upload"
                className="hidden-file-input"
                type="file"
                accept=".csv"
                multiple
                onChange={(event) => handleDraftFiles(Array.from(event.target.files || []))}
              />

              <div className="files-list" style={{ marginTop: 14 }}>
                {files.length ? (
                  files.map((file) => (
                    <div className="file-row" key={`${file.name}-${file.size}`}>
                      <div>
                        <strong>{file.name}</strong>
                        <span className="muted">{Math.round(file.size / 1024)} KB</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="center-empty">まだ追加ファイルは選択されていません。</div>
                )}
              </div>

              <div className="button-row" style={{ marginTop: 16 }}>
                <button className="secondary-button" onClick={handleSaveSnapshot} disabled={isSavingSnapshot || !draftAnalysis}>
                  {isSavingSnapshot ? '保存中...' : '新しいスナップショットを保存'}
                </button>
              </div>
            </section>

            <section className="glass-panel">
              <p className="section-kicker">Notes</p>
              <h2 className="panel-title">メモ</h2>
              <div className="field-grid" style={{ marginTop: 14 }}>
                <label className="field">
                  <span>紐づけるスナップショット</span>
                  <select
                    value={editingSnapshotId ?? ''}
                    onChange={(event) => setEditingSnapshotId(event.target.value || null)}
                  >
                    <option value="">ワークスペース全体メモ</option>
                    {view.snapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>
                        {formatDate(snapshot.createdAt)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>メモ本文</span>
                  <textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} />
                </label>
              </div>
              <div className="button-row" style={{ marginTop: 14 }}>
                <button className="primary-button" onClick={handleSaveNote} disabled={isSavingNote}>
                  {isSavingNote ? '保存中...' : editingNoteId ? 'メモを更新' : 'メモを追加'}
                </button>
                {editingNoteId ? (
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setEditingSnapshotId(null);
                      setNoteBody('');
                    }}
                  >
                    編集をやめる
                  </button>
                ) : null}
              </div>
            </section>
          </aside>

          <section className="stack-18">
            {draftMessage ? <p className="inline-success">{draftMessage}</p> : null}
            {draftError ? <p className="inline-error">{draftError}</p> : null}

            {selectedSnapshot ? (
              <AnalysisView
                analysis={selectedSnapshot.localAnalysis}
                datasets={selectedSnapshot.files.map((file) => file.summary)}
                coachAnalysis={selectedSnapshot.aiAnalysis ?? selectedSnapshot.localAnalysis.localCoach}
                comparison={selectedSnapshot.comparison}
              />
            ) : (
              <div className="glass-panel">まだスナップショットが保存されていません。</div>
            )}

            <section className="section-block">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Saved Notes</p>
                  <h2 className="section-title">保存済みメモ</h2>
                </div>
              </div>
              <div className="notes-list">
                {view.notes.length ? (
                  view.notes.map((note) => (
                    <article className="note-card" key={note.id}>
                      <h3>{note.snapshotId ? 'スナップショットメモ' : 'ワークスペース全体メモ'}</h3>
                      <p>{note.body}</p>
                      <p className="note-meta">更新: {formatDate(note.updatedAt)}</p>
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingSnapshotId(note.snapshotId);
                            setNoteBody(note.body);
                          }}
                        >
                          編集
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="center-empty">まだメモはありません。</div>
                )}
              </div>
            </section>

            {draftAnalysis ? (
              <section className="section-block">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Draft Preview</p>
                    <h2 className="section-title">追加予定スナップショットのプレビュー</h2>
                  </div>
                </div>
                <AnalysisView analysis={draftAnalysis} datasets={draftDatasets} />
              </section>
            ) : null}
          </section>
        </section>
      </main>
    </>
  );
}

function stripRows(dataset: DatasetSummary): DatasetSummary {
  return {
    ...dataset,
    rows: []
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
