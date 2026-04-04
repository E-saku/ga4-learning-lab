'use client';

import { upload } from '@vercel/blob/client';
import { startTransition, useDeferredValue, useState } from 'react';
import { AnalysisView } from '@/components/analysis-view';
import { buildLocalWorkspaceAnalysis } from '@/lib/ga4/insights';
import { parseGA4CSV } from '@/lib/ga4/parser';
import type { DatasetSummary, LocalWorkspaceAnalysis, UserAnswers } from '@/lib/ga4/types';

type HomeClientProps = {
  initialHealth: {
    aiConfigured: boolean;
    persistenceConfigured: boolean;
  };
};

const DEFAULT_ANSWERS: UserAnswers = {
  focus: 'overview',
  businessType: 'lead',
  experience: 'beginner',
  concern: ''
};

export function HomeClient({ initialHealth }: HomeClientProps) {
  const [answers, setAnswers] = useState<UserAnswers>(DEFAULT_ANSWERS);
  const [files, setFiles] = useState<File[]>([]);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deferredDatasets = useDeferredValue(datasets);
  const analysis: LocalWorkspaceAnalysis | null =
    deferredDatasets.length > 0 ? buildLocalWorkspaceAnalysis(deferredDatasets, answers) : null;

  async function handleFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    setMessage(null);
    setErrorMessage(null);

    if (!nextFiles.length) {
      setDatasets([]);
      return;
    }

    if (nextFiles.length > 5) {
      setErrorMessage('1回の解析で扱える CSV は最大 5 件です。');
      return;
    }

    setIsParsing(true);
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
        setDatasets(parsed);
      });
    } catch (error) {
      setDatasets([]);
      setErrorMessage((error as Error).message);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSaveWorkspace() {
    if (!datasets.length || !files.length) {
      setErrorMessage('先に CSV を読み込んでください。');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const workspaceResponse = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const workspaceData = await workspaceResponse.json();
      if (!workspaceResponse.ok || !workspaceData.ok) {
        throw new Error(workspaceData.error || 'ワークスペース作成に失敗しました。');
      }

      const workspaceToken = workspaceData.workspace.token as string;
      const shareUrl = workspaceData.workspace.shareUrl as string;

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

      const snapshotResponse = await fetch(`/api/workspaces/${workspaceToken}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          datasets: datasets.map(stripRows),
          uploadedBlobs: uploadedBlobs.map((blob, index) => ({
            url: blob.url,
            pathname: blob.pathname,
            originalName: files[index]?.name ?? blob.pathname,
            size: files[index]?.size ?? 0,
            contentType: files[index]?.type || 'text/csv'
          }))
        })
      });
      const snapshotData = await snapshotResponse.json();
      if (!snapshotResponse.ok || !snapshotData.ok) {
        throw new Error(snapshotData.error || 'スナップショット保存に失敗しました。');
      }

      setMessage(`限定リンクを発行しました。 ${shareUrl}`);
      window.location.assign(shareUrl);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="shell-header">
        <div>
          <p className="hero-kicker">GA4 Learning Lab</p>
          <h1 className="hero-title">自分の GA4 データを読みながら、次に見るべき画面を学ぶ。</h1>
          <p className="hero-copy">
            CSV をアップロードすると、定量サマリー、見るべき GA4 レポート、初心者向けの読み方をひとつの画面に整理します。
          </p>
        </div>

        <aside className="status-card">
          <span className={`status-dot ${initialHealth.persistenceConfigured ? 'online' : 'offline'}`} />
          <div>
            <strong>{initialHealth.persistenceConfigured ? '保存機能を利用できます' : '保存機能は未設定です'}</strong>
            <p className="status-copy">
              {initialHealth.aiConfigured
                ? 'OpenAI 連携あり。保存後のワークスペースでAIガイドを表示します。'
                : 'OpenAI 未設定でもローカル解析で利用できます。'}
            </p>
          </div>
        </aside>
      </header>

      <main>
        <section className="grid-2">
          <section className="glass-panel">
            <p className="section-kicker">Step 1</p>
            <h2 className="panel-title">GA4 CSV を読み込む</h2>
            <p className="panel-description">
              集客、ページ、イベント、ブラウザなど複数の GA4 CSV をまとめて読み込めます。
            </p>

            <label className={`dropzone ${isParsing ? 'dragging' : ''}`} htmlFor="csv-input">
              <strong>CSV をドラッグするか、クリックして選択</strong>
              <span className="muted">GA4 からエクスポートした CSV をそのまま読み込めます</span>
            </label>
            <input
              id="csv-input"
              className="hidden-file-input"
              type="file"
              accept=".csv"
              multiple
              onChange={(event) => handleFiles(Array.from(event.target.files || []))}
            />

            <div className="files-list" style={{ marginTop: 16 }}>
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
                <div className="center-empty">まだファイルは選択されていません。</div>
              )}
            </div>

            <div className="button-row" style={{ marginTop: 18 }}>
              <button className="primary-button" onClick={() => handleFiles(files)} disabled={isParsing || !files.length}>
                {isParsing ? '解析中...' : 'ローカル解析を更新'}
              </button>
              <button className="secondary-button" onClick={handleSaveWorkspace} disabled={isSaving || !analysis}>
                {isSaving ? '保存中...' : '限定リンクを発行して保存'}
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  setFiles([]);
                  setDatasets([]);
                  setMessage(null);
                  setErrorMessage(null);
                }}
                disabled={isSaving}
              >
                クリア
              </button>
            </div>

            {message ? <p className="inline-success" style={{ marginTop: 16 }}>{message}</p> : null}
            {errorMessage ? <p className="inline-error" style={{ marginTop: 16 }}>{errorMessage}</p> : null}
          </section>

          <section className="glass-panel">
            <p className="section-kicker">Step 2</p>
            <h2 className="panel-title">今の目的を教えてください</h2>
            <p className="panel-description">この回答をもとに、見るべき GA4 レポートと読み方を切り替えます。</p>

            <div className="field-grid">
              <label className="field">
                <span>今いちばん知りたいこと</span>
                <select
                  value={answers.focus}
                  onChange={(event) => setAnswers((current) => ({ ...current, focus: event.target.value as UserAnswers['focus'] }))}
                >
                  <option value="overview">まず全体像をつかみたい</option>
                  <option value="acquisition">集客の良し悪しを見たい</option>
                  <option value="engagement">ページや行動の質を見たい</option>
                  <option value="conversion">問い合わせや購入に近い動きを見たい</option>
                  <option value="tech">ブラウザや計測の問題を見たい</option>
                </select>
              </label>

              <label className="field">
                <span>サイトのタイプ</span>
                <select
                  value={answers.businessType}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      businessType: event.target.value as UserAnswers['businessType']
                    }))
                  }
                >
                  <option value="lead">問い合わせ獲得型サイト</option>
                  <option value="commerce">EC / 予約 / 申込みサイト</option>
                  <option value="content">メディア / ブログ</option>
                  <option value="service">SaaS / 会員サービス</option>
                </select>
              </label>

              <label className="field">
                <span>GA4 の慣れ具合</span>
                <select
                  value={answers.experience}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      experience: event.target.value as UserAnswers['experience']
                    }))
                  }
                >
                  <option value="beginner">ほぼ初心者</option>
                  <option value="basic">基本的なレポートは見られる</option>
                  <option value="intermediate">探索も少し使える</option>
                </select>
              </label>

              <label className="field">
                <span>気になっている課題</span>
                <textarea
                  value={answers.concern}
                  placeholder="例: 広告流入はあるのに問い合わせにつながっていない気がする / Safari だけ数字が弱い気がする"
                  onChange={(event) => setAnswers((current) => ({ ...current, concern: event.target.value }))}
                />
              </label>
            </div>
          </section>
        </section>

        {analysis ? (
          <section className="section-block">
            <AnalysisView analysis={analysis} datasets={datasets} />
          </section>
        ) : (
          <section className="section-block">
            <div className="glass-panel">
              <p className="section-kicker">Preview</p>
              <h2 className="panel-title">CSV を読み込むとここに解析結果が出ます</h2>
              <p className="panel-description">
                まずは 1 つ以上の CSV を選択してください。ローカル解析は OpenAI 未設定でも動作します。
              </p>
            </div>
          </section>
        )}
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
