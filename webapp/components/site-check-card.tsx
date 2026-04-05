'use client';

import { useState } from 'react';
import type { SiteCheckResult } from '@/lib/ga4/types';

export function SiteCheckCard() {
  const [siteUrl, setSiteUrl] = useState('');
  const [result, setResult] = useState<SiteCheckResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const openableSiteUrl = createOpenableUrl(siteUrl);
  const nextSteps = result ? buildNextSteps(result) : [];

  async function handleCheck() {
    if (!siteUrl.trim()) {
      setErrorMessage('確認したいサイト URL を入力してください。');
      return;
    }

    setIsChecking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/site-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'サイト確認に失敗しました。');
      }

      setResult(data.result);
      setMessage('公開ページの計測準備チェックを更新しました。');
    } catch (error) {
      setResult(null);
      setErrorMessage((error as Error).message);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <section className="glass-panel" id="site-check">
      <p className="section-kicker">Step 1</p>
      <h2 className="panel-title">公開サイトの計測状態を先に確認</h2>
      <p className="panel-description">
        サイト URL を入れると、GA4 / GTM タグの有無、title、canonical、robots などを確認します。CSV がまだなくても使える、最初の確認用ステップです。
      </p>

      <div className="field-grid" style={{ marginTop: 16 }}>
        <label className="field">
          <span>計測したいサイト URL</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
          />
          <span className="muted">確認できるのは公開 URL のみです。`localhost` や社内向け URL は対象外です。</span>
        </label>
      </div>

      <div className="button-row" style={{ marginTop: 16 }}>
        <button className="primary-button" type="button" onClick={handleCheck} disabled={isChecking}>
          {isChecking ? '確認中...' : '計測状態を確認する'}
        </button>
        <a
          className="ghost-button inline-link-button"
          href={openableSiteUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!openableSiteUrl}
          onClick={(event) => {
            if (!openableSiteUrl) {
              event.preventDefault();
            }
          }}
        >
          入力したサイトを開く
        </a>
        <a
          className="ghost-button inline-link-button"
          href="https://analytics.google.com/analytics/web/"
          target="_blank"
          rel="noreferrer"
        >
          Google Analytics を開く
        </a>
        <a className="ghost-button inline-link-button" href="#csv-lab">
          CSV 解析へ進む
        </a>
      </div>

      {message ? <p className="inline-success" style={{ marginTop: 14 }}>{message}</p> : null}
      {errorMessage ? <p className="inline-error" style={{ marginTop: 14 }}>{errorMessage}</p> : null}

      {result ? (
        <div className="stack-18" style={{ marginTop: 18 }}>
          <div className="site-check-grid">
            <article className="summary-card">
              <p className="metric-label">測定ID</p>
              <strong>{result.measurementIds.length ? result.measurementIds.join(', ') : '未検出'}</strong>
              <p className="muted">HTML 内で検出できた GA4 の測定IDです。</p>
            </article>
            <article className="summary-card">
              <p className="metric-label">タグ検出</p>
              <strong>{result.hasGtag ? 'gtag.js あり' : result.hasGtm ? 'GTM あり' : '未検出'}</strong>
              <p className="muted">gtag.js / GTM / dataLayer の有無を見ています。</p>
            </article>
            <article className="summary-card">
              <p className="metric-label">HTTP 状態</p>
              <strong>{result.statusCode}</strong>
              <p className="muted">公開ページへ到達したときのレスポンスです。</p>
            </article>
            <article className="summary-card">
              <p className="metric-label">robots</p>
              <strong>{result.robots ?? '未設定'}</strong>
              <p className="muted">noindex があると集客評価の前提が変わります。</p>
            </article>
          </div>

          <div className="card-grid-2">
            <article className="glass-panel">
              <p className="small-label">Page Basics</p>
              <h3 className="panel-title">ページ基本情報</h3>
              <ul className="bullet-list" style={{ marginTop: 14 }}>
                <li>最終URL: {result.finalUrl}</li>
                <li>title: {result.title ?? '未設定'}</li>
                <li>description: {result.description ?? '未設定'}</li>
                <li>canonical: {result.canonicalUrl ?? '未設定'}</li>
              </ul>
            </article>

            <article className="glass-panel">
              <p className="small-label">What To Do Next</p>
              <h3 className="panel-title">次にやること</h3>
              <ul className="bullet-list" style={{ marginTop: 14 }}>
                {nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>

            <article className="glass-panel">
              <p className="small-label">Detected Checks</p>
              <h3 className="panel-title">今見えた確認ポイント</h3>
              <div className="stack-18" style={{ marginTop: 14 }}>
                {result.findings.map((finding) => (
                  <div className={`finding-row ${finding.level}`} key={`${finding.level}-${finding.title}`}>
                    <strong>{finding.title}</strong>
                    <p>{finding.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function createOpenableUrl(input: string) {
  const value = input.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function buildNextSteps(result: SiteCheckResult) {
  const steps: string[] = [];

  if (result.measurementIds.length > 0) {
    steps.push('Google Analytics の管理画面で、検出した測定IDがこのサイト用のデータストリームか確認する。');
  } else if (result.hasGtm) {
    steps.push('GTM を使っている可能性が高いので、GA4 設定タグと発火トリガーを確認する。');
  } else {
    steps.push('このページに GA4 または GTM タグが入っているか、実装側で設置状況を確認する。');
  }

  if (result.robots?.toLowerCase().includes('noindex')) {
    steps.push('noindex が意図した設定か確認する。意図しない場合は公開設定や meta robots を見直す。');
  }

  if (!result.title || !result.description) {
    steps.push('title と description を整えて、流入評価の前提になるページ情報を揃える。');
  }

  steps.push('サイト確認の後は、この下で GA4 CSV を読み込んで数値の傾向を見る。');
  return steps;
}
