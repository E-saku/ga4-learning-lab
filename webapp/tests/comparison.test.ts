import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildSnapshotComparison } from '@/lib/ga4/comparison';
import { parseGA4CSV } from '@/lib/ga4/parser';

const trafficCsvAPath = fileURLToPath(
  new URL('../../トラフィック獲得_セッションのメインのチャネル_グループ（デフォルト_チャネル_グループ） (1).csv', import.meta.url)
);
const trafficCsvBPath = fileURLToPath(
  new URL('../../トラフィック獲得_セッションのメインのチャネル_グループ（デフォルト_チャネル_グループ） (2).csv', import.meta.url)
);

describe('buildSnapshotComparison', () => {
  it('compares rows by reportName + primaryDimension + label', () => {
    const previousDataset = parseGA4CSV(readFileSync(trafficCsvAPath, 'utf8'), 'traffic-a.csv');
    const currentDataset = parseGA4CSV(readFileSync(trafficCsvBPath, 'utf8'), 'traffic-b.csv');
    const comparison = buildSnapshotComparison('snp_current', [currentDataset], 'snp_prev', [previousDataset]);

    expect(comparison?.comparedSnapshotId).toBe('snp_prev');
    expect(comparison?.datasets[0]?.comparable).toBe(true);
    expect(comparison?.datasets[0]?.metrics.some((metric) => metric.rowLabel === 'Direct')).toBe(true);
  });
});
