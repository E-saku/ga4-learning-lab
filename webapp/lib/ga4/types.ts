export type FocusMode =
  | 'overview'
  | 'acquisition'
  | 'engagement'
  | 'conversion'
  | 'tech';

export type BusinessType = 'lead' | 'commerce' | 'content' | 'service';
export type ExperienceLevel = 'beginner' | 'basic' | 'intermediate';

export type UserAnswers = {
  focus: FocusMode;
  businessType: BusinessType;
  experience: ExperienceLevel;
  concern: string;
};

export type MetricAliasId =
  | 'sessions'
  | 'activeUsers'
  | 'newUsers'
  | 'engagedSessions'
  | 'engagementRate'
  | 'eventCount'
  | 'keyEvents'
  | 'sessionKeyEventRate'
  | 'revenue'
  | 'engagementTime'
  | 'metric';

export type NumericSummary = {
  total: number;
  average: number;
  min: number;
  max: number;
};

export type TopRowSummary = {
  label: string;
  primaryValue: number;
  share: number;
  engagementRate: number | null;
  keyEvents: number;
};

export type DatasetType =
  | 'acquisition'
  | 'engagement'
  | 'conversion'
  | 'tech'
  | 'general';

export type DatasetSummary = {
  fileName: string;
  reportName: string;
  account: string;
  property: string;
  startDate: string;
  endDate: string;
  headers: string[];
  rows: Record<string, string>[];
  type: DatasetType;
  primaryDimension: string;
  primaryMetric: {
    id: MetricAliasId;
    label: string;
  };
  avgEngagementRate: number | null;
  keyEventsTotal: number;
  revenueTotal: number;
  numericTotals: Record<string, NumericSummary>;
  topRows: TopRowSummary[];
  chart: {
    labels: string[];
    primaryLabel: string;
    primaryValues: number[];
    engagementValues: Array<number | null>;
  };
};

export type SummaryCard = {
  label: string;
  value: string;
  help: string;
};

export type WorkspaceSummary = {
  cards: SummaryCard[];
  caption: string;
};

export type AiStatus = {
  configured: boolean;
  source: 'cookie' | 'env' | 'none';
  model: string | null;
};

export type SiteCheckFinding = {
  level: 'good' | 'warn' | 'info';
  title: string;
  detail: string;
};

export type SiteCheckResult = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  hasGtag: boolean;
  hasGtm: boolean;
  hasDataLayer: boolean;
  measurementIds: string[];
  findings: SiteCheckFinding[];
};

export type QuantitativeFinding = {
  title: string;
  evidence: string;
  action: string;
};

export type ReportGuidance = {
  report: string;
  whatToCheck: string;
  why: string;
};

export type LocalCoachAnalysis = {
  overview: string;
  findings: Array<{
    title: string;
    evidence: string;
    whyItMatters: string;
  }>;
  reportGuidance: ReportGuidance[];
  nextQuestions: string[];
  nextActions: string[];
  dataQuality: string[];
};

export type LocalWorkspaceAnalysis = {
  workspaceSummary: WorkspaceSummary;
  quantitativeFindings: QuantitativeFinding[];
  reportGuidance: ReportGuidance[];
  localCoach: LocalCoachAnalysis;
};

export type ComparisonMetricDelta = {
  key: string;
  label: string;
  rowLabel: string;
  currentValue: number;
  previousValue: number;
  absoluteDelta: number;
  relativeDelta: number | null;
};

export type ComparisonDatasetDelta = {
  reportName: string;
  primaryDimension: string;
  comparable: boolean;
  note: string;
  metrics: ComparisonMetricDelta[];
};

export type SnapshotComparison = {
  comparedSnapshotId: string | null;
  datasets: ComparisonDatasetDelta[];
};

export type UploadedBlobInput = {
  url: string;
  pathname: string;
  originalName: string;
  size: number;
  contentType: string;
};

export type PendingUploadPayload = {
  workspaceId: string;
  originalName: string;
  size: number;
  contentType: string;
};

export type WorkspaceView = {
  workspace: {
    id: string;
    shareUrl: string;
    createdAt: string;
    expiresAt: string;
    lastAccessedAt: string | null;
  };
  snapshots: Array<{
    id: string;
    createdAt: string;
    answers: UserAnswers;
    localAnalysis: LocalWorkspaceAnalysis;
    aiAnalysis: LocalCoachAnalysis | null;
    comparison: SnapshotComparison | null;
    files: Array<{
      id: string;
      blobPath: string;
      originalName: string;
      reportName: string;
      fileSizeBytes: number;
      summary: DatasetSummary;
    }>;
  }>;
  notes: Array<{
    id: string;
    snapshotId: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
  }>;
};
