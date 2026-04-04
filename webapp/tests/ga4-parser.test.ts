import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseGA4CSV } from '@/lib/ga4/parser';

const trafficCsvPath = fileURLToPath(
  new URL('../../トラフィック獲得_セッションのメインのチャネル_グループ（デフォルト_チャネル_グループ） (1).csv', import.meta.url)
);
const browserCsvPath = fileURLToPath(new URL('../../ユーザーの環境の詳細_ブラウザ.csv', import.meta.url));

describe('parseGA4CSV', () => {
  it('parses acquisition csv metadata and top rows', () => {
    const content = readFileSync(trafficCsvPath, 'utf8');
    const result = parseGA4CSV(content, 'traffic.csv');

    expect(result.reportName).toContain('トラフィック獲得');
    expect(result.type).toBe('acquisition');
    expect(result.primaryMetric.label).toBe('セッション');
    expect(result.topRows[0]?.label).toBe('Paid Search');
    expect(result.topRows[0]?.primaryValue).toBe(313);
    expect(result.avgEngagementRate).toBeGreaterThan(0);
  });

  it('parses tech csv and detects browser report type', () => {
    const content = readFileSync(browserCsvPath, 'utf8');
    const result = parseGA4CSV(content, 'browser.csv');

    expect(result.type).toBe('tech');
    expect(result.primaryDimension).toBe('ブラウザ');
    expect(result.topRows[0]?.label).toBe('Chrome');
    expect(result.numericTotals['アクティブ ユーザー']?.total).toBe(119);
  });
});
