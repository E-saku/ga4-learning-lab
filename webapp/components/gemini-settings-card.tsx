'use client';

import { useState } from 'react';
import type { AiStatus } from '@/lib/ga4/types';

type GeminiSettingsCardProps = {
  initialStatus: AiStatus;
  sectionId?: string;
  kicker?: string;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' }
];

export function GeminiSettingsCard({
  initialStatus,
  sectionId,
  kicker = 'AI Settings'
}: GeminiSettingsCardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(initialStatus.model ?? DEFAULT_MODEL);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSave() {
    if (!apiKey.trim()) {
      setErrorMessage('Gemini API キーを入力してください。');
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: model.trim() || DEFAULT_MODEL
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Gemini API キーの保存に失敗しました。');
      }

      setStatus(data.status);
      setApiKey('');
      setMessage('Gemini API キーをこのブラウザ専用の暗号化 cookie に保存しました。');
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/settings/gemini', {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Gemini API キーの削除に失敗しました。');
      }

      setStatus(data.status);
      setApiKey('');
      setMessage('このブラウザに保存していた Gemini API キーを削除しました。');
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="glass-panel" id={sectionId}>
      <p className="section-kicker">{kicker}</p>
      <h2 className="panel-title">Gemini API キー設定</h2>
      <p className="panel-description">
        これは任意設定です。入れると説明が厚くなりますが、未設定でもサイト確認とローカル解析は使えます。キーは共有リンクやデータベースには保存せず、暗号化された HttpOnly cookie にのみ保存します。
      </p>

      <div className="field-grid" style={{ marginTop: 16 }}>
        <div className="field">
          <span>現在の状態</span>
          <div className="center-empty" style={{ padding: 18, textAlign: 'left' }}>
            <strong>{statusLabel(status)}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {status.model ? `使用モデル: ${status.model}` : 'AI キーは未設定です。'}
            </div>
          </div>
        </div>

        <label className="field">
          <span>Gemini API キー</span>
          <input
            type="password"
            value={apiKey}
            placeholder="AIza..."
            autoComplete="off"
            onChange={(event) => setApiKey(event.target.value)}
          />
          <span className="muted">Google AI Studio で発行したキーをそのまま貼り付けます。</span>
        </label>

        <label className="field">
          <span>モデル</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {MODEL_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="button-row" style={{ marginTop: 16 }}>
        <button className="primary-button" type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '保存中...' : 'このブラウザに保存'}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || status.source !== 'cookie'}
        >
          {isDeleting ? '削除中...' : 'ブラウザ保存を削除'}
        </button>
      </div>

      {message ? <p className="inline-success" style={{ marginTop: 14 }}>{message}</p> : null}
      {errorMessage ? <p className="inline-error" style={{ marginTop: 14 }}>{errorMessage}</p> : null}
    </section>
  );
}

function statusLabel(status: AiStatus) {
  if (status.source === 'cookie') {
    return 'このブラウザ専用の Gemini キーを使用中';
  }

  if (status.source === 'env') {
    return 'サーバー環境変数の Gemini キーを使用中';
  }

  return 'Gemini キー未設定';
}
