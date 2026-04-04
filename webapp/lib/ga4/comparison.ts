import type {
  ComparisonDatasetDelta,
  ComparisonMetricDelta,
  DatasetSummary,
  SnapshotComparison
} from '@/lib/ga4/types';

type ComparableRow = {
  reportName: string;
  primaryDimension: string;
  label: string;
  primaryValue: number;
  engagementRate: number | null;
  keyEvents: number;
};

export function buildSnapshotComparison(
  currentSnapshotId: string,
  currentDatasets: DatasetSummary[],
  previousSnapshotId: string | null,
  previousDatasets: DatasetSummary[]
): SnapshotComparison | null {
  if (!previousSnapshotId || !previousDatasets.length) {
    return {
      comparedSnapshotId: null,
      datasets: currentDatasets.map((dataset) => ({
        reportName: dataset.reportName,
        primaryDimension: dataset.primaryDimension,
        comparable: false,
        note: '比較対象のスナップショットがまだありません。',
        metrics: []
      }))
    };
  }

  const previousIndex = createRowIndex(previousDatasets);
  const datasets: ComparisonDatasetDelta[] = currentDatasets.map((dataset) => {
    const metrics: ComparisonMetricDelta[] = [];
    dataset.topRows.forEach((row) => {
      const key = createComparisonKey(dataset.reportName, dataset.primaryDimension, row.label);
      const previous = previousIndex.get(key);
      if (!previous) return;

      metrics.push(
        createDelta(row.label, 'primaryValue', dataset.primaryMetric.label, row.primaryValue, previous.primaryValue),
        createDelta(
          row.label,
          'engagementRate',
          'エンゲージメント率',
          row.engagementRate ?? 0,
          previous.engagementRate ?? 0
        ),
        createDelta(row.label, 'keyEvents', 'キーイベント', row.keyEvents, previous.keyEvents)
      );
    });

    const comparable = metrics.length > 0;
    return {
      reportName: dataset.reportName,
      primaryDimension: dataset.primaryDimension,
      comparable,
      note: comparable
        ? '同じ reportName + primaryDimension + label の行で差分を出しています。'
        : '一致する比較対象がないため、最新値のみ表示します。',
      metrics: metrics
        .sort((left, right) => Math.abs(right.absoluteDelta) - Math.abs(left.absoluteDelta))
        .slice(0, 9)
    };
  });

  return {
    comparedSnapshotId: previousSnapshotId,
    datasets
  };
}

function createRowIndex(datasets: DatasetSummary[]): Map<string, ComparableRow> {
  const map = new Map<string, ComparableRow>();
  datasets.forEach((dataset) => {
    dataset.topRows.forEach((row) => {
      map.set(createComparisonKey(dataset.reportName, dataset.primaryDimension, row.label), {
        reportName: dataset.reportName,
        primaryDimension: dataset.primaryDimension,
        label: row.label,
        primaryValue: row.primaryValue,
        engagementRate: row.engagementRate,
        keyEvents: row.keyEvents
      });
    });
  });
  return map;
}

function createComparisonKey(reportName: string, primaryDimension: string, label: string): string {
  return `${reportName}__${primaryDimension}__${label}`.toLowerCase();
}

function createDelta(
  rowLabel: string,
  key: string,
  label: string,
  currentValue: number,
  previousValue: number
): ComparisonMetricDelta {
  const absoluteDelta = currentValue - previousValue;
  const relativeDelta = previousValue === 0 ? null : absoluteDelta / previousValue;
  return {
    key,
    label,
    rowLabel,
    currentValue,
    previousValue,
    absoluteDelta,
    relativeDelta
  };
}
