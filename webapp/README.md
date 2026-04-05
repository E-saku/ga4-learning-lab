# GA4 Learning Lab

GA4 の CSV を読み込みながら、初心者向けに「次にどこを見れば良いか」を案内し、限定リンクで保存・再訪できる Next.js Web アプリです。

## 主な機能

- 複数の GA4 CSV をブラウザ内で即時解析
- 目的別の定量サマリーと GA4 レポート案内
- 限定リンクワークスペースの作成と再訪
- スナップショット比較とメモ管理
- Vercel Blob private storage への CSV 保存
- Neon Postgres へのメタデータ保存
- Google Gemini API による初心者向け AI ガイド
- Gemini API 未設定時のローカル解析フォールバック

## ローカル起動

```bash
cd /Users/kouraeisaku/GA4_dashboard/webapp
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 必須環境変数

`.env.local` に次を設定してください。

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
BLOB_READ_WRITE_TOKEN=
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
WORKSPACE_TOKEN_SECRET=
CRON_SECRET=
```

- `GEMINI_API_KEY` と `GEMINI_MODEL` は任意です。未設定でも、アプリ画面から Gemini API キーを入力するとそのブラウザ専用の暗号化 HttpOnly cookie に保存されます。
- `WORKSPACE_TOKEN_SECRET` はワークスペーストークンの hash 化と、ブラウザ保存した Gemini API キーの暗号化に使います。
- `CRON_SECRET` は cleanup エンドポイント保護用です。未設定でもビルドは可能ですが、本番では設定を推奨します。

## Vercel 設定

- Project Root Directory: `webapp`
- Blob Storage: private store を作成
- Database: Neon Postgres を接続
- Cron: `vercel.json` で `/api/internal/cleanup` を毎日実行

## テスト

```bash
npm run test
```

## 補足

- raw CSV は Blob に保存しますが、Gemini API へ送るのは CSV 要約 JSON のみです。
- Gemini API キーを画面から入力した場合、キー自体は共有リンクや DB に保存せず、クライアント JavaScript から読めない暗号化 HttpOnly cookie にのみ保存します。
- ワークスペース URL は限定リンク方式です。リンクを知っている人は閲覧・追加入力・ノート編集ができます。
