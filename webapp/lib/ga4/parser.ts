import type { DatasetSummary, DatasetType, MetricAliasId } from '@/lib/ga4/types';

type MetricAlias = {
  id: MetricAliasId;
  label: string;
  keys: string[];
};

const METRIC_ALIASES: MetricAlias[] = [
  { id: 'sessions', label: 'セッション', keys: ['セッション', 'sessions', 'session'] },
  {
    id: 'activeUsers',
    label: 'アクティブユーザー',
    keys: ['アクティブ ユーザー', 'アクティブユーザー', 'active users', 'users']
  },
  { id: 'newUsers', label: '新規ユーザー数', keys: ['新規ユーザー数', 'new users'] },
  {
    id: 'engagedSessions',
    label: 'エンゲージのあったセッション数',
    keys: ['エンゲージのあったセッション数', 'エンゲージメントのあったセッション数', 'engaged sessions']
  },
  { id: 'engagementRate', label: 'エンゲージメント率', keys: ['エンゲージメント率', 'engagement rate'] },
  { id: 'eventCount', label: 'イベント数', keys: ['イベント数', 'event count', 'events'] },
  { id: 'keyEvents', label: 'キーイベント', keys: ['キーイベント', 'コンバージョン', 'key events', 'conversions'] },
  {
    id: 'sessionKeyEventRate',
    label: 'セッション キーイベント率',
    keys: ['セッション キーイベント率', 'キーイベント率', 'conversion rate']
  },
  { id: 'revenue', label: '合計収益', keys: ['合計収益', 'total revenue', 'purchase revenue'] },
  { id: 'engagementTime', label: '平均エンゲージメント時間', keys: ['平均エンゲージメント時間', 'engagement time'] }
];

export function parseGA4CSV(text: string, fileName: string): DatasetSummary {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/^\uFEFF/, '').trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    throw new Error('CSV が空です。');
  }

  const metadata = {
    reportName: '',
    account: '',
    property: '',
    startDate: '',
    endDate: ''
  };

  let headerIndex = -1;

  lines.forEach((line, index) => {
    if (headerIndex !== -1) return;

    if (line.startsWith('#')) {
      const cleaned = line.replace(/^#\s*/, '');
      if (
        !metadata.reportName &&
        cleaned &&
        !cleaned.startsWith('-') &&
        !cleaned.startsWith('アカウント:') &&
        !cleaned.startsWith('プロパティ:') &&
        !cleaned.startsWith('開始日:') &&
        !cleaned.startsWith('終了日:') &&
        cleaned !== 'すべてのユーザー'
      ) {
        metadata.reportName = cleaned;
      }
      if (cleaned.startsWith('アカウント:')) metadata.account = cleaned.replace('アカウント:', '').trim();
      if (cleaned.startsWith('プロパティ:')) metadata.property = cleaned.replace('プロパティ:', '').trim();
      if (cleaned.startsWith('開始日:')) metadata.startDate = cleaned.replace('開始日:', '').trim();
      if (cleaned.startsWith('終了日:')) metadata.endDate = cleaned.replace('終了日:', '').trim();
      return;
    }

    const cells = parseCSVLine(line);
    if (cells.length >= 2) {
      headerIndex = index;
    }
  });

  if (headerIndex === -1) {
    throw new Error('CSV のヘッダー行を見つけられませんでした。');
  }

  const headers = parseCSVLine(lines[headerIndex]).map(cleanCell);
  const rows: Record<string, string>[] = [];

  lines.slice(headerIndex + 1).forEach((line) => {
    if (line.startsWith('#')) return;
    const values = parseCSVLine(line);
    if (values.length < 2) return;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cleanCell(values[index] ?? '');
    });
    rows.push(row);
  });

  if (!rows.length) {
    throw new Error('CSV にデータ行がありませんでした。');
  }

  return summarizeDataset({
    fileName,
    headers,
    rows,
    reportName: metadata.reportName || inferReportName(fileName, headers),
    account: metadata.account,
    property: metadata.property,
    startDate: metadata.startDate,
    endDate: metadata.endDate
  });
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

export function formatMetricValue(
  value: number | null | undefined,
  options: {
    percent?: boolean;
    currency?: boolean;
    compact?: boolean;
  } = {}
): string {
  if (value == null || Number.isNaN(value)) return '—';
  const { percent = false, currency = false, compact = false } = options;

  if (percent) {
    const normalized = value > 1 ? value : value * 100;
    return `${normalized.toFixed(1)}%`;
  }

  if (currency) {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(value);
  }

  if (compact) {
    return new Intl.NumberFormat('ja-JP', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  }

  return new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(value);
}

function summarizeDataset(dataset: {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  reportName: string;
  account: string;
  property: string;
  startDate: string;
  endDate: string;
}): DatasetSummary {
  const numericHeaders = dataset.headers.filter((header) => isMostlyNumeric(dataset.rows, header));
  const dimensionHeaders = dataset.headers.filter((header) => !numericHeaders.includes(header));
  const primaryDimension = dimensionHeaders[0] || dataset.headers[0];
  const primaryMetricAlias = detectPrimaryMetric(numericHeaders);
  const primaryMetricHeader = findMatchingHeader(numericHeaders, primaryMetricAlias?.keys) || numericHeaders[0];
  const engagementHeader = findMatchingHeader(numericHeaders, detectMetricById('engagementRate')?.keys);
  const keyEventHeader = findMatchingHeader(numericHeaders, detectMetricById('keyEvents')?.keys);
  const revenueHeader = findMatchingHeader(numericHeaders, detectMetricById('revenue')?.keys);

  const dataRows = dataset.rows.filter((row) => {
    const value = String(row[primaryDimension] || '').trim().toLowerCase();
    return !['total', '合計'].includes(value);
  });

  const numericTotals = Object.fromEntries(
    numericHeaders.map((header) => {
      const values = dataRows.map((row) => parseMetricValue(row[header])).filter((value) => !Number.isNaN(value));
      const total = values.reduce((sum, value) => sum + value, 0);
      return [
        header,
        {
          total,
          average: values.length ? total / values.length : 0,
          min: values.length ? Math.min(...values) : 0,
          max: values.length ? Math.max(...values) : 0
        }
      ];
    })
  );

  const primaryTotal = numericTotals[primaryMetricHeader]?.total || 0;
  const avgEngagementRate = calculateWeightedRate(dataRows, primaryMetricHeader, engagementHeader);

  const topRows = dataRows
    .map((row) => {
      const primaryValue = parseMetricValue(row[primaryMetricHeader]);
      const engagementRate = parseMetricValue(row[engagementHeader]);
      const keyEvents = parseMetricValue(row[keyEventHeader]);
      return {
        label: String(row[primaryDimension] || '不明'),
        primaryValue: Number.isNaN(primaryValue) ? 0 : primaryValue,
        share: primaryTotal ? (Number.isNaN(primaryValue) ? 0 : primaryValue / primaryTotal) : 0,
        engagementRate: Number.isNaN(engagementRate) ? null : normalizeRate(engagementRate),
        keyEvents: Number.isNaN(keyEvents) ? 0 : keyEvents
      };
    })
    .sort((a, b) => b.primaryValue - a.primaryValue)
    .slice(0, 8);

  return {
    ...dataset,
    type: detectDatasetType(dataset.reportName, dataset.headers),
    primaryDimension,
    primaryMetric: {
      id: primaryMetricAlias?.id ?? 'metric',
      label: primaryMetricHeader || '主要指標'
    },
    avgEngagementRate,
    keyEventsTotal: keyEventHeader ? numericTotals[keyEventHeader]?.total || 0 : 0,
    revenueTotal: revenueHeader ? numericTotals[revenueHeader]?.total || 0 : 0,
    numericTotals,
    topRows,
    chart: {
      labels: topRows.map((row) => row.label),
      primaryLabel: primaryMetricHeader || '主要指標',
      primaryValues: topRows.map((row) => row.primaryValue),
      engagementValues: topRows.map((row) =>
        row.engagementRate == null ? null : Number((row.engagementRate * 100).toFixed(1))
      )
    }
  };
}

function detectPrimaryMetric(numericHeaders: string[]): MetricAlias | null {
  const priority: MetricAliasId[] = ['sessions', 'activeUsers', 'engagedSessions', 'eventCount', 'keyEvents', 'revenue'];
  for (const id of priority) {
    const metric = detectMetricById(id);
    if (metric && numericHeaders.some((header) => matchesExactly(header, metric.keys))) {
      return metric;
    }
  }

  return (
    priority
      .map((id) => detectMetricById(id))
      .find(
        (metric): metric is MetricAlias =>
          Boolean(metric && numericHeaders.some((header) => includesAny(header, metric.keys)))
      ) ?? null
  );
}

function detectMetricById(id: MetricAliasId): MetricAlias | null {
  return METRIC_ALIASES.find((metric) => metric.id === id) ?? null;
}

function inferReportName(fileName: string, headers: string[]): string {
  if (fileName) return fileName.replace(/\.csv$/i, '');
  return headers[0] || 'GA4 レポート';
}

function detectDatasetType(reportName: string, headers: string[]): DatasetType {
  const source = `${reportName} ${headers.join(' ')}`.toLowerCase();
  if (/(チャネル|source|medium|traffic|campaign|参照元)/.test(source)) return 'acquisition';
  if (/(browser|ブラウザ|device|デバイス|os|platform)/.test(source)) return 'tech';
  if (/(ページ|page|screen|landing)/.test(source)) return 'engagement';
  if (/(event|イベント|key event|conversion|purchase|収益)/.test(source)) return 'conversion';
  return 'general';
}

function parseMetricValue(value: string | undefined): number {
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/秒/g, '')
    .trim();

  if (!cleaned || cleaned === '—') return Number.NaN;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function cleanCell(value: string): string {
  return String(value || '').replace(/^"|"$/g, '').trim();
}

function includesAny(header: string, candidates: string[] = []): boolean {
  const normalizedHeader = normalizeLookup(header);
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeLookup(candidate);
    return (
      normalizedHeader === normalizedCandidate ||
      normalizedHeader.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedHeader)
    );
  });
}

function isMostlyNumeric(rows: Record<string, string>[], header: string): boolean {
  const values = rows.map((row) => row[header]).filter(Boolean);
  if (!values.length) return false;
  const numericCount = values.filter((value) => !Number.isNaN(parseMetricValue(value))).length;
  return numericCount / values.length >= 0.7;
}

function findMatchingHeader(headers: string[], keys: string[] = []): string {
  return headers.find((header) => matchesExactly(header, keys)) || headers.find((header) => includesAny(header, keys)) || '';
}

function calculateWeightedRate(
  rows: Record<string, string>[],
  weightHeader: string,
  rateHeader: string
): number | null {
  if (!rateHeader) return null;
  let totalWeight = 0;
  let weightedRate = 0;

  rows.forEach((row) => {
    const rateValue = parseMetricValue(row[rateHeader]);
    if (Number.isNaN(rateValue)) return;
    const normalizedRate = normalizeRate(rateValue);
    const weight = weightHeader ? parseMetricValue(row[weightHeader]) : 1;
    const safeWeight = Number.isNaN(weight) ? 1 : weight;
    totalWeight += safeWeight;
    weightedRate += normalizedRate * safeWeight;
  });

  return totalWeight ? weightedRate / totalWeight : null;
}

function normalizeRate(value: number): number {
  return value > 1 ? value / 100 : value;
}

function normalizeLookup(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_（）()【】\[\]-]+/g, '');
}

function matchesExactly(header: string, candidates: string[] = []): boolean {
  const normalizedHeader = normalizeLookup(header);
  return candidates.some((candidate) => normalizedHeader === normalizeLookup(candidate));
}
