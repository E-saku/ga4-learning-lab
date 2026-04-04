import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLocalWorkspaceAnalysis } from '@/lib/ga4/insights';
import { parseGA4CSV } from '@/lib/ga4/parser';
import type { UserAnswers } from '@/lib/ga4/types';

const trafficCsvPath = fileURLToPath(
  new URL('../../トラフィック獲得_セッションのメインのチャネル_グループ（デフォルト_チャネル_グループ） (1).csv', import.meta.url)
);
const browserCsvPath = fileURLToPath(new URL('../../ユーザーの環境の詳細_ブラウザ.csv', import.meta.url));

const answers: UserAnswers = {
  focus: 'acquisition',
  businessType: 'lead',
  experience: 'beginner',
  concern: '広告流入の質を見たい'
};

describe('buildLocalWorkspaceAnalysis', () => {
  it('builds summary, findings and local coach from dataset summaries', () => {
    const traffic = parseGA4CSV(readFileSync(trafficCsvPath, 'utf8'), 'traffic.csv');
    const browser = parseGA4CSV(readFileSync(browserCsvPath, 'utf8'), 'browser.csv');
    const analysis = buildLocalWorkspaceAnalysis([traffic, browser], answers);

    expect(analysis.workspaceSummary.cards.length).toBeGreaterThan(2);
    expect(analysis.quantitativeFindings.some((finding) => finding.title.includes('依存'))).toBe(true);
    expect(analysis.reportGuidance.some((guide) => guide.report.includes('トラフィック獲得'))).toBe(true);
    expect(analysis.localCoach.nextQuestions.length).toBeGreaterThan(0);
    expect(analysis.localCoach.dataQuality.some((item) => item.includes('キーイベント'))).toBe(true);
  });
});
